import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { intentClassificationPrompt, parameterExtractionPrompt } from "@/lib/ai/prompts";

// Intent definitions

/**
 * Every intent the system can detect. Adding a new intent means:
 * 1. Add a value to this enum
 * 2. Add its parameter schema to `IntentParameterSchemas`
 * 3. (Optional) map it to a connector capability in the orchestrator
 */
export const Intent = {
  CHECK_EVENTS: "CHECK_EVENTS",
  CHECK_AVAILABILITY: "CHECK_AVAILABILITY",
  CREATE_EVENT: "CREATE_EVENT",
  GENERAL: "GENERAL",
} as const;

export type IntentName = (typeof Intent)[keyof typeof Intent];

// Per-intent parameter schemas

const CheckEventsParams = z.object({
  dateStart: z.string().describe("ISO 8601 date or datetime for range start"),
  dateEnd: z.string().describe("ISO 8601 date or datetime for range end"),
});

const CheckAvailabilityParams = z.object({
  dateStart: z.string().describe("ISO 8601 datetime for range start"),
  dateEnd: z.string().describe("ISO 8601 datetime for range end"),
});

const CreateEventParams = z.object({
  title: z.string().describe("Short event title"),
  dateStart: z.string().describe("ISO 8601 datetime for event start"),
  dateEnd: z.string().describe("ISO 8601 datetime for event end"),
  description: z.string().optional().describe("Optional event description"),
  attendees: z.array(z.string()).optional().describe("Optional email addresses or names"),
});

const GeneralParams = z.object({});

// Map intent name → its Zod parameter schema.
export const IntentParameterSchemas = {
  CHECK_EVENTS: CheckEventsParams,
  CHECK_AVAILABILITY: CheckAvailabilityParams,
  CREATE_EVENT: CreateEventParams,
  GENERAL: GeneralParams,
} as const satisfies Record<IntentName, z.ZodObject<z.ZodRawShape>>;

// Detection result type

export type DetectedIntent<T extends IntentName = IntentName> = {
  intent: T;
  confidence: number;
  parameters: z.infer<(typeof IntentParameterSchemas)[T]>;
};

// Step 1: Classify — lightweight LLM call to pick the intent + confidence

const ClassificationSchema = z.object({
  intent: z
    .enum(["CHECK_EVENTS", "CHECK_AVAILABILITY", "CREATE_EVENT", "GENERAL"])
    .describe("The detected user intent"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("How confident the classification is (0–1)"),
});

type ClassificationResult = z.infer<typeof ClassificationSchema>;

async function classifyIntent(
  userMessage: string,
  connectedApps: string[],
): Promise<ClassificationResult> {
  const hasCalendar = connectedApps.includes("google-calendar");

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: ClassificationSchema,
    prompt: intentClassificationPrompt(userMessage, hasCalendar),
  });

  return object;
}

// Step 2: Extract — if intent is non-GENERAL, extract structured parameters

async function extractParameters<T extends IntentName>(
  intent: T,
  userMessage: string,
): Promise<z.infer<(typeof IntentParameterSchemas)[T]>> {
  if (intent === "GENERAL") {
    return {} as z.infer<(typeof IntentParameterSchemas)[T]>;
  }

  const schema = IntentParameterSchemas[intent];

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema,
    prompt: parameterExtractionPrompt(intent, userMessage),
  });

  return object as z.infer<(typeof IntentParameterSchemas)[T]>;
}

// Public API

/**
 * Detect intent and extract parameters from a user message.
 *
 * This is a two-step process:
 * 1. **Classify** — fast, cheap call to determine the intent + confidence
 * 2. **Extract** — only if intent is actionable (non-GENERAL), parse parameters
 *
 * The two-step design avoids wasting tokens on parameter extraction for
 * messages that are clearly general conversation.
 */
export async function detectIntent(
  userMessage: string,
  connectedApps: string[],
): Promise<DetectedIntent> {
  const classification = await classifyIntent(userMessage, connectedApps);

  // Skip parameter extraction for general messages or low-confidence matches
  if (classification.intent === "GENERAL" || classification.confidence < 0.7) {
    return {
      intent: "GENERAL",
      confidence: classification.confidence,
      parameters: {},
    };
  }

  const parameters = await extractParameters(
    classification.intent,
    userMessage,
  );

  return {
    intent: classification.intent,
    confidence: classification.confidence,
    parameters,
  };
}
