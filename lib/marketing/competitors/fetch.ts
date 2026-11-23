import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import {
  isAllowedCompetitorHost,
  normalizeCompetitorHost,
  type CompetitorTarget,
} from "@/lib/marketing/competitors/targets";

export const RESEARCH_UA = "SynaravaResearchBot/1.0 (+https://shop.synarava.com)";
export const FETCH_TIMEOUT_MS = 20_000;
export const MAX_RESPONSE_BYTES = 3 * 1024 * 1024;

export class OffHostRedirectError extends Error {
  readonly code = "off_host_redirect" as const;
  constructor(message: string) {
    super(message);
    this.name = "OffHostRedirectError";
  }
}

export class SsrfGuardError extends Error {
  readonly code = "ssrf_rejected" as const;
  constructor(message: string) {
    super(message);
    this.name = "SsrfGuardError";
  }
}

/** True for loopback / private / link-local / metadata ranges (IPv4 + IPv6). */
export function isBlockedResolvedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === undefined || b === undefined) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
    if (lower.startsWith("fe80:")) return true;
    // IPv4-mapped (::ffff:x.x.x.x)
    if (lower.startsWith("::ffff:")) {
      const mapped = lower.slice("::ffff:".length);
      if (isIP(mapped) === 4) return isBlockedResolvedIp(mapped);
    }
    return false;
  }
  return true;
}

async function assertResolvedIpSafe(hostname: string): Promise<void> {
  // Literal IP in the URL host — check directly.
  if (isIP(hostname)) {
    if (isBlockedResolvedIp(hostname)) {
      throw new SsrfGuardError(`Blocked IP literal: ${hostname}`);
    }
    return;
  }
  let address: string;
  try {
    const result = await lookup(hostname, { all: false });
    address = result.address;
  } catch {
    throw new SsrfGuardError(`DNS lookup failed for ${hostname}`);
  }
  if (isBlockedResolvedIp(address)) {
    throw new SsrfGuardError(`Resolved to blocked IP ${address} for ${hostname}`);
  }
}

/** Reject non-https or host outside the target allowlist. */
export function assertSafeTargetUrl(url: string, targetHost: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SsrfGuardError(`Invalid URL: ${url}`);
  }
  if (parsed.protocol !== "https:") {
    throw new SsrfGuardError(`Only https allowed: ${url}`);
  }
  const host = normalizeCompetitorHost(parsed.hostname);
  if (!isAllowedCompetitorHost(host) || host !== normalizeCompetitorHost(targetHost)) {
    throw new SsrfGuardError(`Host not in competitor allowlist: ${parsed.hostname}`);
  }
  return parsed;
}

async function readCappedBody(res: Response): Promise<Buffer> {
  const reader = res.body?.getReader();
  if (!reader) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_RESPONSE_BYTES) {
      throw new Error(`Response exceeds ${MAX_RESPONSE_BYTES} bytes`);
    }
    return buf;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // ignore
        }
        throw new Error(`Response exceeds ${MAX_RESPONSE_BYTES} bytes`);
      }
      chunks.push(value);
    }
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

/**
 * Fetch with manual redirects; every hop must stay on the target host (SSRF guard).
 * DNS resolution is checked against private/metadata ranges before each request.
 */
export async function fetchCompetitorUrl(
  url: string,
  target: CompetitorTarget,
  init?: { signal?: AbortSignal },
): Promise<{ status: number; body: Buffer; finalUrl: string }> {
  let current = assertSafeTargetUrl(url, target.host).toString();
  const deadline = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const signal = init?.signal
    ? AbortSignal.any([deadline, init.signal])
    : deadline;

  for (let hop = 0; hop < 8; hop += 1) {
    const parsed = new URL(current);
    await assertResolvedIpSafe(parsed.hostname);

    const res = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: {
        "user-agent": RESEARCH_UA,
        accept: "text/html,application/xml,application/json,*/*",
      },
      signal,
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) {
        return { status: res.status, body: Buffer.alloc(0), finalUrl: current };
      }
      const next = new URL(loc, current);
      if (normalizeCompetitorHost(next.hostname) !== target.host || next.protocol !== "https:") {
        throw new OffHostRedirectError(
          `Redirect left target host: ${current} → ${next.toString()}`,
        );
      }
      current = next.toString();
      continue;
    }

    const body = res.status === 204 ? Buffer.alloc(0) : await readCappedBody(res);
    return { status: res.status, body, finalUrl: current };
  }

  throw new OffHostRedirectError(`Too many redirects for ${url}`);
}
