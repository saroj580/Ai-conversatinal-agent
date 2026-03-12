import { prisma } from "@/lib/db/prisma";
import { getConnectorById } from "@/lib/apps/registry";
import {
  Intent,
  type DetectedIntent,
  type IntentName,
  IntentParameterSchemas,
} from "@/lib/ai/intentDetector";
import {
  getEvents,
  checkAvailability,
  createEvent,
} from "@/services/calendarService";
import type { z } from "zod";

// Result types

export type ToolResultStatus = "success" | "error" | "skipped";

export interface ToolResult {
  status: ToolResultStatus;
  intent: IntentName;
  data: string | null;
}

// Intent → app mapping

const INTENT_APP_MAP: Partial<Record<IntentName, string>> = {
  [Intent.CHECK_EVENTS]: "google-calendar",
  [Intent.CHECK_AVAILABILITY]: "google-calendar",
  [Intent.CREATE_EVENT]: "google-calendar",
};

// Guard: verify the user has the required app connected

async function ensureAppConnected(userId: string, appId: string): Promise<boolean> {
  const app = await prisma.connectedApp.findUnique({
    where: { userId_appId: { userId, appId } },
    include: { credentials: true },
  });
  return app?.status === "connected" && app.credentials.length > 0;
}

// Individual intent handlers — delegate to calendarService

type CheckEventsParams = z.infer<typeof IntentParameterSchemas.CHECK_EVENTS>;
type CheckAvailabilityParams = z.infer<typeof IntentParameterSchemas.CHECK_AVAILABILITY>;
type CreateEventParams = z.infer<typeof IntentParameterSchemas.CREATE_EVENT>;

async function handleCheckEvents(
  userId: string,
  params: CheckEventsParams,
): Promise<string> {
  const events = await getEvents(userId, params.dateStart);

  if (events.length === 0) return "No events found in that time range.";

  const lines = events.map(
    (e) => `- ${e.title} (${e.start})`,
  );

  return `Found ${events.length} event(s):\n${lines.join("\n")}`;
}

async function handleCheckAvailability(
  userId: string,
  params: CheckAvailabilityParams,
): Promise<string> {
  const result = await checkAvailability(userId, {
    startISO: params.dateStart,
    endISO: params.dateEnd,
  });

  if (result.available) {
    return `You are free from ${params.dateStart} to ${params.dateEnd}.`;
  }

  const lines = result.busy.map(
    (slot) => `- Busy: ${slot.start} → ${slot.end}`,
  );

  return `You have ${result.busy.length} busy slot(s) in that range:\n${lines.join("\n")}`;
}

async function handleCreateEvent(
  userId: string,
  params: CreateEventParams,
): Promise<string> {
  const event = await createEvent(userId, {
    title: params.title,
    startISO: params.dateStart,
    endISO: params.dateEnd,
    description: params.description,
  });

  const link = event.htmlLink ?? "";
  return `Created event **${event.title}**. ${link}`;
}

// Handler dispatch table

type IntentHandler<T extends IntentName> = (
  userId: string,
  params: z.infer<(typeof IntentParameterSchemas)[T]>,
) => Promise<string>;

const handlers: Partial<Record<IntentName, IntentHandler<IntentName>>> = {
  [Intent.CHECK_EVENTS]: handleCheckEvents as IntentHandler<IntentName>,
  [Intent.CHECK_AVAILABILITY]: handleCheckAvailability as IntentHandler<IntentName>,
  [Intent.CREATE_EVENT]: handleCreateEvent as IntentHandler<IntentName>,
};

// Public API

const CONFIDENCE_THRESHOLD = 0.75;

/**
 * Invoke the right service for a detected intent.
 *
 * Returns a structured `ToolResult` that the orchestrator can embed
 * into the system prompt for the final LLM response.
 */
export async function invokeTool(
  detected: DetectedIntent,
  userId: string,
): Promise<ToolResult> {
  // Non-actionable intents → skip
  if (detected.intent === Intent.GENERAL || detected.confidence < CONFIDENCE_THRESHOLD) {
    return { status: "skipped", intent: detected.intent, data: null };
  }

  // Resolve required app
  const appId = INTENT_APP_MAP[detected.intent];
  if (!appId) {
    return { status: "skipped", intent: detected.intent, data: null };
  }

  // Verify the connector exists
  const connector = getConnectorById(appId);
  if (!connector) {
    return {
      status: "error",
      intent: detected.intent,
      data: `App "${appId}" is not registered.`,
    };
  }

  // Verify the user has the app connected
  const connected = await ensureAppConnected(userId, appId);
  if (!connected) {
    return {
      status: "error",
      intent: detected.intent,
      data: `Google Calendar is not connected. Please connect it first in Settings.`,
    };
  }

  // Dispatch to the intent-specific handler
  const handler = handlers[detected.intent];
  if (!handler) {
    return {
      status: "error",
      intent: detected.intent,
      data: `No handler registered for intent "${detected.intent}".`,
    };
  }

  try {
    const data = await handler(userId, detected.parameters);
    return { status: "success", intent: detected.intent, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      status: "error",
      intent: detected.intent,
      data: `[${appId}] ${message}`,
    };
  }
}
