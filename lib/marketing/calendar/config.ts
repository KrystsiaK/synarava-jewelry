import { parseGoogleServiceAccountJson } from "@/lib/marketing/calendar/google-auth";

export type GoogleCalendarEnv = {
  calendarId: string | null;
  serviceAccountJson: string | null;
};

export function readGoogleCalendarEnv(
  env: NodeJS.ProcessEnv = process.env,
): GoogleCalendarEnv {
  return {
    calendarId: env.GOOGLE_CALENDAR_ID?.trim() || null,
    serviceAccountJson: env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() || null,
  };
}

/** Feature off when either env var is missing / invalid. */
export function isGoogleCalendarSyncEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const { calendarId, serviceAccountJson } = readGoogleCalendarEnv(env);
  if (!calendarId || !serviceAccountJson) return false;
  return parseGoogleServiceAccountJson(serviceAccountJson) != null;
}
