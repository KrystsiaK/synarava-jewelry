/**
 * Single gate for optional third-party analytics ids (GTM / Meta / Clarity)
 * passed into PrivacyConsentManager from the root layout.
 *
 * Analytics stay off when:
 * - optional analytics are disabled for the deployment, or
 * - the request path is under `/admin` (proxy `x-pathname`, same as nonce), or
 * - an admin session cookie is present (logged-in team on the storefront).
 *
 * Cookie name: `ADMIN_SESSION_COOKIE` from `@/lib/auth/admin-session` — callers
 * must read that constant; do not duplicate the string.
 * Path channel: `REQUEST_PATHNAME_HEADER` (`x-pathname`) from proxy.
 */

export type OptionalAnalyticsIds = {
  gtmId: string | undefined;
  metaPixelId: string | undefined;
  claritySiteId: string | undefined;
};

export type ResolveOptionalAnalyticsIdsInput = {
  optionalAnalyticsEnabled: boolean;
  /** From proxy-injected `REQUEST_PATHNAME_HEADER` (`x-pathname`). */
  pathname: string | null | undefined;
  /** Raw value of `ADMIN_SESSION_COOKIE` when present. */
  adminSessionCookie: string | undefined;
  gtmId?: string;
  metaPixelId?: string;
  claritySiteId?: string;
};

/** Same `/admin` boundary proxy uses for admin pages. */
export function isAdminRequestPath(pathname: string | null | undefined): boolean {
  return typeof pathname === "string" && pathname.startsWith("/admin");
}

export function shouldSuppressOptionalAnalytics(input: {
  pathname: string | null | undefined;
  adminSessionCookie: string | undefined;
}): boolean {
  return isAdminRequestPath(input.pathname) || Boolean(input.adminSessionCookie);
}

export function resolveOptionalAnalyticsIds(
  input: ResolveOptionalAnalyticsIdsInput,
): OptionalAnalyticsIds {
  if (
    !input.optionalAnalyticsEnabled ||
    shouldSuppressOptionalAnalytics({
      pathname: input.pathname,
      adminSessionCookie: input.adminSessionCookie,
    })
  ) {
    return { gtmId: undefined, metaPixelId: undefined, claritySiteId: undefined };
  }

  return {
    gtmId: input.gtmId,
    metaPixelId: input.metaPixelId,
    claritySiteId: input.claritySiteId,
  };
}
