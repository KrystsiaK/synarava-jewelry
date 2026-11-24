/**
 * Calendar-facing re-exports of the shared service-account auth module.
 */
export {
  GOOGLE_OAUTH_TOKEN_URL,
  GOOGLE_CALENDAR_EVENTS_SCOPE,
  GOOGLE_MARKETING_ALLOWED_HOSTS as GOOGLE_CALENDAR_ALLOWED_HOSTS,
  parseGoogleServiceAccountJson,
  signGoogleServiceAccountJwt as signGoogleServiceAccountJwtWithScope,
  assertGoogleMarketingUrlAllowed as assertGoogleCalendarUrlAllowed,
  fetchGoogleAccessToken,
  clearGoogleTokenCacheForTests as clearGoogleCalendarTokenCacheForTests,
  type GoogleServiceAccount,
} from "@/lib/marketing/google/service-account-auth";

import {
  GOOGLE_CALENDAR_EVENTS_SCOPE,
  fetchGoogleAccessToken,
  signGoogleServiceAccountJwt as signWithScope,
  type GoogleServiceAccount,
} from "@/lib/marketing/google/service-account-auth";

/** Sign JWT for Calendar Events scope. */
export function signGoogleServiceAccountJwt(
  sa: GoogleServiceAccount,
  nowSec?: number,
): string {
  return signWithScope(sa, GOOGLE_CALENDAR_EVENTS_SCOPE, nowSec);
}

export async function fetchGoogleCalendarAccessToken(input: {
  sa: GoogleServiceAccount;
  fetchFn?: typeof fetch;
  nowMs?: number;
  forceRefresh?: boolean;
}): Promise<string> {
  return fetchGoogleAccessToken({
    sa: input.sa,
    scope: GOOGLE_CALENDAR_EVENTS_SCOPE,
    fetchFn: input.fetchFn,
    nowMs: input.nowMs,
    forceRefresh: input.forceRefresh,
  });
}
