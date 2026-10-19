import type { ServiceNodeStatusRecord } from "@/lib/mission-control/status";
import { getPublicSiteUrl } from "@/lib/seo/site-url";

const NODE_KEY = "site-health";
const HEALTH_PATH = "/api/health";
/** Latency above this is warn even when the body says ok. */
export const SITE_HEALTH_WARN_LATENCY_MS = 2000;

export type SiteHealthDeps = {
  baseUrl?: string;
  now?: Date;
  fetchFn?: typeof fetch;
  /** Override measured latency (unit tests). */
  latencyMsOverride?: number;
};

function record(
  partial: Omit<ServiceNodeStatusRecord, "nodeKey" | "href" | "checkedAt" | "updatedAt"> & {
    checkedAt: Date;
  },
): ServiceNodeStatusRecord {
  return {
    nodeKey: NODE_KEY,
    href: HEALTH_PATH,
    updatedAt: partial.checkedAt,
    ...partial,
  };
}

/**
 * HTTP check of this app's own `/api/health` at request time.
 * Does not write `ServiceNodeStatus` (persistence = Stage 5).
 */
export async function getSiteHealthStatus(
  deps: SiteHealthDeps = {},
): Promise<ServiceNodeStatusRecord> {
  const now = deps.now ?? new Date();
  const fetchFn = deps.fetchFn ?? fetch;

  let baseUrl = deps.baseUrl;
  if (baseUrl === undefined) {
    try {
      baseUrl = getPublicSiteUrl();
    } catch {
      baseUrl = "";
    }
  }

  if (!baseUrl) {
    return record({
      level: "unknown",
      message: "APP_URL missing — cannot ping health",
      counters: null,
      checkedAt: now,
    });
  }

  const url = `${baseUrl.replace(/\/$/, "")}${HEALTH_PATH}`;

  try {
    const started = Date.now();
    const response = await fetchFn(url, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = deps.latencyMsOverride ?? Date.now() - started;

    let bodyOk: boolean | undefined;
    try {
      const body = (await response.json()) as { ok?: unknown };
      bodyOk = typeof body.ok === "boolean" ? body.ok : undefined;
    } catch {
      bodyOk = undefined;
    }

    if (!response.ok || bodyOk === false) {
      return record({
        level: "down",
        message: `health unavailable (${response.status})`,
        counters: { latencyMs },
        checkedAt: now,
      });
    }

    if (bodyOk !== true) {
      return record({
        level: "unknown",
        message: "health response shape unexpected",
        counters: { latencyMs },
        checkedAt: now,
      });
    }

    if (latencyMs >= SITE_HEALTH_WARN_LATENCY_MS) {
      return record({
        level: "warn",
        message: `health ok but slow (${latencyMs}ms)`,
        counters: { latencyMs },
        checkedAt: now,
      });
    }

    return record({
      level: "ok",
      message: "pong",
      counters: { latencyMs },
      checkedAt: now,
    });
  } catch {
    return record({
      level: "unknown",
      message: "health fetch failed",
      counters: null,
      checkedAt: now,
    });
  }
}
