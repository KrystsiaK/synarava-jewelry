import { isIP } from "node:net";

type HeaderReader = { get(name: string): string | null };

function validIp(value: string | null | undefined) {
  const candidate = value?.trim();
  return candidate && isIP(candidate) ? candidate : null;
}

/**
 * Client IP for rate limits.
 *
 * Prefer platform identity headers (Cloudflare / Fly / Railway `x-real-ip`) —
 * those are set by the edge and are not attacker-controlled.
 *
 * For `x-forwarded-for`, proxies append to the right. Trust the hop
 * `TRUSTED_PROXY_HOPS` from the right (default 1 = nearest / rightmost).
 * Railway typically terminates TLS once and sets `x-real-ip`; if a CDN sits
 * in front, set `TRUSTED_PROXY_HOPS=2` so the limiter keys on the browser IP
 * rather than the CDN edge.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-For
 */
export function getTrustedClientIp(headers: HeaderReader) {
  for (const name of ["cf-connecting-ip", "fly-client-ip", "x-real-ip"]) {
    const candidate = validIp(headers.get(name));
    if (candidate) return candidate;
  }

  const hopsRaw = Number(process.env.TRUSTED_PROXY_HOPS ?? "1");
  const hops = Number.isFinite(hopsRaw) && hopsRaw >= 1 ? Math.floor(hopsRaw) : 1;
  const forwarded = headers.get("x-forwarded-for")?.split(",").map((part) => part.trim()) ?? [];
  if (forwarded.length === 0) return "unknown";

  const index = Math.max(0, forwarded.length - hops);
  for (let i = index; i >= 0; i -= 1) {
    const candidate = validIp(forwarded[i]);
    if (candidate) return candidate;
  }

  return "unknown";
}
