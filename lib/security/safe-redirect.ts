/**
 * Validates that `value` is a same-origin, path-only redirect target — never
 * an absolute URL to another host — so a client-supplied `redirectTo`/`returnTo`
 * form or query value can never turn a `redirect()` call into an open redirect.
 *
 * Parses against a fixed dummy origin: if the parsed result's origin doesn't
 * match, `value` was an absolute URL (`https://evil.example`) or a
 * protocol-relative one (`//evil.example`), and `fallback` is returned instead.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback: string,
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(value, "https://safe-redirect.invalid");
    return url.origin === "https://safe-redirect.invalid"
      ? `${url.pathname}${url.search}${url.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}
