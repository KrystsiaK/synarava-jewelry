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
