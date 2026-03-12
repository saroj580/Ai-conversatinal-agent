import type { AppConnector } from "@/lib/apps/base";
import { googleCalendarConnector } from "@/lib/apps/google-calendar";

/**
 * Central registry.
 *
 * Adding a new app:
 * - Create `/lib/apps/<your-app>/index.ts` implementing `AppConnector`
 * - Register it here
 * - The rest of the system (UI + orchestrator) discovers it automatically
 */
const connectors: AppConnector[] = [googleCalendarConnector];

export function getAllConnectors() {
  return connectors;
}

export function getConnectorById(id: string) {
  return connectors.find((c) => c.id === id) ?? null;
}


