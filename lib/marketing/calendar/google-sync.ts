import {
  assertGoogleCalendarUrlAllowed,
  fetchGoogleCalendarAccessToken,
  parseGoogleServiceAccountJson,
  type GoogleServiceAccount,
} from "@/lib/marketing/calendar/google-auth";
import {
  isGoogleCalendarSyncEnabled,
  readGoogleCalendarEnv,
} from "@/lib/marketing/calendar/config";
import {
  buildGoogleCalendarEvent,
  type IdeaForCalendarEvent,
} from "@/lib/marketing/calendar/event-payload";

export type CalendarSyncResult =
  | {
      ok: true;
      skipped: true;
      reason: "disabled";
    }
  | {
      ok: true;
      skipped?: false;
      action: "insert" | "patch" | "delete";
      eventId: string | null;
    }
  | {
      ok: false;
      skipped?: false;
      action: "insert" | "patch" | "delete";
      error: string;
      eventId: string | null;
    };

function eventsUrl(calendarId: string, eventId?: string): string {
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base;
}

async function authorizedFetch(input: {
  sa: GoogleServiceAccount;
  url: string;
  method: string;
  body?: unknown;
  fetchFn: typeof fetch;
}): Promise<Response> {
  assertGoogleCalendarUrlAllowed(input.url);
  const token = await fetchGoogleCalendarAccessToken({
    sa: input.sa,
    fetchFn: input.fetchFn,
  });
  return input.fetchFn(input.url, {
    method: input.method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });
}

function safeErrorMessage(status: number, bodyText: string): string {
  const trimmed = bodyText.replace(/\s+/g, " ").trim().slice(0, 200);
  // Never echo tokens / keys if Google somehow echoed them.
  const scrubbed = trimmed
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/-----BEGIN[\s\S]*?PRIVATE KEY-----/gi, "[redacted-key]");
  return `Google Calendar API ${status}${scrubbed ? `: ${scrubbed}` : ""}`;
}

export async function syncIdeaToGoogleCalendar(input: {
  idea: IdeaForCalendarEvent & { calendarEventId?: string | null };
  productNameById: ReadonlyMap<string, string>;
  /** insert | patch when approving / updating date; delete when rejecting */
  op: "upsert" | "delete";
  env?: NodeJS.ProcessEnv;
  fetchFn?: typeof fetch;
}): Promise<CalendarSyncResult> {
  const env = input.env ?? process.env;
  if (!isGoogleCalendarSyncEnabled(env)) {
    return { ok: true, skipped: true, reason: "disabled" };
  }
  const { calendarId, serviceAccountJson } = readGoogleCalendarEnv(env);
  const sa = parseGoogleServiceAccountJson(serviceAccountJson);
  if (!calendarId || !sa) {
    return { ok: true, skipped: true, reason: "disabled" };
  }

  const fetchFn = input.fetchFn ?? fetch;
  const existingId = input.idea.calendarEventId ?? null;

  try {
    if (input.op === "delete") {
      if (!existingId) {
        return { ok: true, action: "delete", eventId: null };
      }
      const res = await authorizedFetch({
        sa,
        url: eventsUrl(calendarId, existingId),
        method: "DELETE",
        fetchFn,
      });
      if (!res.ok && res.status !== 404) {
        const text = await res.text().catch(() => "");
        return {
          ok: false,
          action: "delete",
          eventId: existingId,
          error: safeErrorMessage(res.status, text),
        };
      }
      return { ok: true, action: "delete", eventId: null };
    }

    const payload = buildGoogleCalendarEvent({
      idea: input.idea,
      productNameById: input.productNameById,
    });

    if (existingId) {
      const res = await authorizedFetch({
        sa,
        url: eventsUrl(calendarId, existingId),
        method: "PATCH",
        body: payload,
        fetchFn,
      });
      if (res.ok) {
        return { ok: true, action: "patch", eventId: existingId };
      }
      // Event deleted in Google — recover by inserting a fresh event.
      if (res.status !== 404 && res.status !== 410) {
        const text = await res.text().catch(() => "");
        return {
          ok: false,
          action: "patch",
          eventId: existingId,
          error: safeErrorMessage(res.status, text),
        };
      }
    }

    const res = await authorizedFetch({
      sa,
      url: eventsUrl(calendarId),
      method: "POST",
      body: payload,
      fetchFn,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        action: "insert",
        eventId: null,
        error: safeErrorMessage(res.status, text),
      };
    }
    const body = (await res.json()) as { id?: unknown };
    const eventId = typeof body.id === "string" ? body.id : null;
    if (!eventId) {
      return {
        ok: false,
        action: "insert",
        eventId: null,
        error: "Google Calendar insert returned no event id",
      };
    }
    return { ok: true, action: "insert", eventId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 200) : "Calendar sync failed";
    return {
      ok: false,
      action: input.op === "delete" ? "delete" : existingId ? "patch" : "insert",
      eventId: existingId,
      error: message
        .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
        .replace(/-----BEGIN[\s\S]*?PRIVATE KEY-----/gi, "[redacted-key]"),
    };
  }
}
