import type { AppConnector } from "@/lib/apps/base";
import { prisma } from "@/lib/db/prisma";
import { generateGoogleAuthUrl, revokeGoogleTokens } from "@/lib/apps/google-calendar/oauth";
import { createEventFromText, listUpcomingEventsFromText } from "@/lib/apps/google-calendar/actions";

export const googleCalendarConnector: AppConnector = {
  id: "google-calendar",
  name: "Google Calendar",

  async connect(_userId: string) {
    // Connection is initiated by redirecting user to OAuth URL (see /api/apps/google-calendar/connect).
    // This method is kept for interface completeness; actual connect flow is handled in route.
    return;
  },

  async disconnect(userId: string) {
    // Revoke tokens at Google before clearing local state
    await revokeGoogleTokens(userId);

    await prisma.connectedApp.updateMany({
      where: { userId, appId: "google-calendar" },
      data: { status: "disconnected" },
    });
  },

  getCapabilities() {
    return ["create_event", "list_events"];
  },

  async handleIntent(input: string, userId: string) {
    const app = await prisma.connectedApp.findUnique({
      where: { userId_appId: { userId, appId: "google-calendar" } },
      include: { credentials: true },
    });

    const isConnected = app?.status === "connected" && app.credentials.length > 0;
    if (!isConnected) return null;

    // Minimal routing. Orchestrator decides "calendar intent" vs not; connector decides which action.
    const lower = input.toLowerCase();
    if (lower.includes("list") || lower.includes("show") || lower.includes("upcoming")) {
      return listUpcomingEventsFromText({ userId, input });
    }
    if (
      lower.includes("create") ||
      lower.includes("schedule") ||
      lower.includes("meeting") ||
      lower.includes("event")
    ) {
      return createEventFromText({ userId, input });
    }

    return null;
  },
};

export async function getGoogleCalendarConnectUrl(userId: string) {
  return generateGoogleAuthUrl({ userId });
}


