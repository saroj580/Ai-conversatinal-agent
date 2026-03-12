import { google, type calendar_v3 } from "googleapis";
import { getGoogleOAuthClientForUser } from "@/lib/apps/google-calendar/oauth";

// Types

export interface CalendarEvent {
  id: string | null;
  title: string;
  description: string | null;
  start: string;
  end: string;
  htmlLink: string | null;
}

export interface CreateEventInput {
  title: string;
  startISO: string;
  endISO: string;
  description?: string;
  location?: string;
  timeZone?: string;
}

export interface DateRange {
  startISO: string;
  endISO: string;
}

export interface AvailabilitySlot {
  start: string;
  end: string;
}

export interface AvailabilityResult {
  busy: AvailabilitySlot[];
  available: boolean;
}

// Helpers

/** Build an authenticated Google Calendar v3 client for the given user. */
async function getCalendarClient(userId: string): Promise<calendar_v3.Calendar> {
  const oauth2 = await getGoogleOAuthClientForUser(userId);
  return google.calendar({ version: "v3", auth: oauth2 });
}

/** Map a raw API event item to our lean CalendarEvent shape. */
function toCalendarEvent(item: calendar_v3.Schema$Event): CalendarEvent {
  return {
    id: item.id ?? null,
    title: item.summary ?? "Untitled",
    description: item.description ?? null,
    start: item.start?.dateTime ?? item.start?.date ?? "",
    end: item.end?.dateTime ?? item.end?.date ?? "",
    htmlLink: item.htmlLink ?? null,
  };
}

// Public API

/**
 * Fetch calendar events for a specific date (full day).
 *
 * @param userId  – authenticated user id
 * @param date    – ISO 8601 date string (e.g. "2026-03-12") or Date object
 * @returns       – list of events occurring on that date
 */
export async function getEvents(
  userId: string,
  date: string | Date,
): Promise<CalendarEvent[]> {
  const d = typeof date === "string" ? new Date(date) : date;

  const dayStart = new Date(d);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(d);
  dayEnd.setHours(23, 59, 59, 999);

  const calendar = await getCalendarClient(userId);

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: dayStart.toISOString(),
    timeMax: dayEnd.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 50,
  });

  return (res.data.items ?? []).map(toCalendarEvent);
}

/**
 * Check whether the user's calendar is free within a date range using
 * the Google Calendar Freebusy API.
 *
 * @returns busy slots and a boolean indicating if the entire range is free.
 */
export async function checkAvailability(
  userId: string,
  range: DateRange,
): Promise<AvailabilityResult> {
  const calendar = await getCalendarClient(userId);

  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: range.startISO,
      timeMax: range.endISO,
      items: [{ id: "primary" }],
    },
  });

  const busySlots: AvailabilitySlot[] = (
    res.data.calendars?.primary?.busy ?? []
  ).map((b) => ({
    start: b.start ?? "",
    end: b.end ?? "",
  }));

  return {
    busy: busySlots,
    available: busySlots.length === 0,
  };
}

/**
 * Create a new event on the user's primary Google Calendar.
 *
 * @returns the newly created event.
 */
export async function createEvent(
  userId: string,
  eventData: CreateEventInput,
): Promise<CalendarEvent> {
  const calendar = await getCalendarClient(userId);

  const requestBody: calendar_v3.Schema$Event = {
    summary: eventData.title,
    description: eventData.description,
    location: eventData.location,
    start: {
      dateTime: eventData.startISO,
      timeZone: eventData.timeZone,
    },
    end: {
      dateTime: eventData.endISO,
      timeZone: eventData.timeZone,
    },
  };

  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody,
  });

  return toCalendarEvent(res.data);
}
