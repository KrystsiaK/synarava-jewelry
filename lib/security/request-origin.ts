/**
 * Resolve a trusted absolute origin for same-site redirects (e.g. Buy again).
 * Prefer the connection `Host` header; accept `x-forwarded-*` only when the
 * host is on an allowlist (APP_URL / loopback) and the protocol is http(s).
 */

function configuredAppOrigin(): string | null {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function allowedHosts(appOrigin: string | null): Set<string> {
  const hosts = new Set<string>([
    "127.0.0.1:3000",
    "localhost:3000",
    "127.0.0.1",
    "localhost",
  ]);
  if (appOrigin) hosts.add(new URL(appOrigin).host);
  return hosts;
}

function firstHeaderValue(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  return first || null;
}

function trustedProto(
  forwardedProto: string | null,
  host: string,
  appOrigin: string | null,
): "http" | "https" {
  if (forwardedProto === "http" || forwardedProto === "https") return forwardedProto;
  if (host.startsWith("127.0.0.1") || host.startsWith("localhost")) return "http";
  if (appOrigin) return new URL(appOrigin).protocol === "http:" ? "http" : "https";
  return "https";
}

export function getTrustedRequestOrigin(request: Request): string {
  const appOrigin = configuredAppOrigin();
  const allowed = allowedHosts(appOrigin);

  const host = firstHeaderValue(request.headers.get("host"));
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"))?.toLowerCase() ?? null;

  const trustedHost =
    (host && allowed.has(host) ? host : null) ??
    (forwardedHost && allowed.has(forwardedHost) ? forwardedHost : null);

  if (trustedHost) {
    return `${trustedProto(forwardedProto, trustedHost, appOrigin)}://${trustedHost}`;
  }

  if (appOrigin) return appOrigin;
  return new URL(request.url).origin;
}
