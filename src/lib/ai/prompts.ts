/**
 * Centralized prompt templates for the AI layer.
 *
 * Keeping prompts in a single file makes them easy to iterate on,
 * A/B test, and review without digging through business logic.
 */

export const MODELS = {
  FAST: "gpt-4o-mini" as const,
  CHAT: "gpt-4o-mini" as const,
};

/** Intent classification prompt */
export function intentClassificationPrompt(
  userMessage: string,
  hasCalendar: boolean,
) {
  return `You are an intent classifier for a productivity assistant.

Connected integrations: ${hasCalendar ? "Google Calendar" : "None"}

Possible intents:
- CHECK_EVENTS — user wants to see, list, or query existing calendar events
- CHECK_AVAILABILITY — user wants to know if they are free/busy at a certain time
- CREATE_EVENT — user wants to schedule, book, or create a new event
- GENERAL — anything else (greetings, general questions, non-calendar topics)

Rules:
- Only classify as a calendar intent if Google Calendar is connected.
- If the user message is ambiguous, prefer GENERAL with low confidence.
- Be conservative: only return confidence >= 0.8 when the match is clear.

User message: "${userMessage}"`;
}

/** Parameter extraction prompt */
export function parameterExtractionPrompt(intent: string, userMessage: string) {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();

  return `Extract structured parameters from the user message for intent "${intent}".

Today's date is ${today}.
Current time is ${now}.

Rules:
- All dates/times must be full ISO 8601 strings with timezone.
- If the user says "tomorrow", compute the actual date relative to today.
- If only a date is given with no time, use start-of-day (00:00) and end-of-day (23:59).
- If no duration is specified for CREATE_EVENT, default to 30 minutes.
- For attendees, extract names or emails as-is from the message.

User message: "${userMessage}"`;
}
