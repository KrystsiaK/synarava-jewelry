import { safeRedirectPath } from "@/lib/security/safe-redirect";

/**
 * Short-lived cookie set when an unauthenticated admin request is bounced to
 * login. Survives cases where the query `redirectTo` is lost (e.g. layout
 * auth check with a still-signed but DB-expired session cookie) so post-login
 * navigation can restore the page the user originally opened.
 */
export const ADMIN_RETURN_TO_COOKIE = "synarava-admin-return-to";
export const ADMIN_RETURN_TO_MAX_AGE_SECONDS = 10 * 60;

/** Request headers injected by `proxy.ts` for Server Components / Actions. */
export const REQUEST_PATHNAME_HEADER = "x-pathname";
export const REQUEST_SEARCH_HEADER = "x-search";

/**
 * Validates a client-supplied `redirectTo` for the admin login flow: must be
 * a same-origin path under `/admin`, and never back to the login page itself
 * (which would otherwise loop after a successful login).
 */
export function getSafeAdminRedirect(value: string | null | undefined) {
  const safe = safeRedirectPath(value, "/admin");
  const pathname = safe.split(/[?#]/, 1)[0];
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const isLoginPath = pathname === "/admin/login" || pathname.startsWith("/admin/login/");
  return isAdminPath && !isLoginPath ? safe : "/admin";
}

export function adminReturnCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge,
    ...(maxAge <= 0 ? { expires: new Date(0) } : {}),
  };
}
