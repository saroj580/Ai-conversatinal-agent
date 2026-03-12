import { openai } from "@ai-sdk/openai";
import { streamText, type CoreMessage } from "ai";
import { prisma } from "@/lib/db/prisma";
import { getConnectorById } from "@/lib/apps/registry";
import { detectIntent, Intent, type DetectedIntent } from "@/lib/ai/intentDetector";

/**
 * Orchestrator:
 * 1) Load connected apps for the user
 * 2) Run intent detection (classify + extract parameters)
 * 3) If an actionable intent is detected → route to the matching connector
 * 4) Stream a conversational response, incorporating any connector result
 */

/** Maps detected intents to connector capabilities */
const INTENT_TO_CAPABILITY: Record<string, { appId: string; capability: string }> = {
  [Intent.CHECK_EVENTS]: { appId: "google-calendar", capability: "list_events" },
  [Intent.CHECK_AVAILABILITY]: { appId: "google-calendar", capability: "list_events" },
  [Intent.CREATE_EVENT]: { appId: "google-calendar", capability: "create_event" },
};

export async function orchestrate({
  userId,
  messages,
  latestUserInput,
}: {
  userId: string;
  messages: CoreMessage[];
  latestUserInput: string;
}) {
  // Load connected apps
  const connected = await prisma.connectedApp.findMany({
    where: { userId, status: "connected" },
  });

  const apps = connected
    .map((a) => {
      const connector = getConnectorById(a.appId);
      if (!connector) return null;
      return {
        id: connector.id,
        name: connector.name,
        capabilities: connector.getCapabilities(),
      };
    })
    .filter(Boolean) as Array<{ id: string; name: string; capabilities: string[] }>;

  const connectedAppIds = apps.map((a) => a.id);

  // Detect intent
  const detected: DetectedIntent = await detectIntent(latestUserInput, connectedAppIds);

  // Route to connector if actionable
  let connectorResult: string | null = null;

  if (detected.intent !== Intent.GENERAL && detected.confidence >= 0.75) {
    const mapping = INTENT_TO_CAPABILITY[detected.intent];
    if (mapping && connectedAppIds.includes(mapping.appId)) {
      const connector = getConnectorById(mapping.appId);
      if (connector) {
        try {
          connectorResult = await connector.handleIntent(latestUserInput, userId);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          connectorResult = `[Error from ${mapping.appId}]: ${msg}`;
        }
      }
    }
  }

  // Stream response
  const system = buildSystemPrompt(apps, detected, connectorResult);

  return streamText({
    model: openai("gpt-4o-mini"),
    system,
    messages,
  });
}

function buildSystemPrompt(
  apps: Array<{ id: string; name: string; capabilities: string[] }>,
  detected: DetectedIntent,
  connectorResult: string | null,
) {
  const appList =
    apps.length === 0
      ? "No connected apps."
      : apps
          .map(
            (a) =>
              `- ${a.name} (id: ${a.id}) capabilities: ${a.capabilities.join(", ")}`,
          )
          .join("\n");

  const intentContext =
    detected.intent !== Intent.GENERAL
      ? `\n\nDetected intent: ${detected.intent} (confidence: ${detected.confidence.toFixed(2)})\nExtracted parameters: ${JSON.stringify(detected.parameters)}`
      : "";

  const toolContext = connectorResult
    ? `\n\nA connected app returned this result:\n${connectorResult}\n\nUse it to answer the user faithfully. Format dates/times in a human-friendly way.`
    : "";

  return `You are Synapto, a helpful productivity assistant that connects to the user's apps.

Connected apps:
${appList}
${intentContext}
If the user asks for something an app can do, the system may call it. If an app result is provided, incorporate it faithfully.
Keep responses concise, friendly, and actionable.${toolContext}`;
}


