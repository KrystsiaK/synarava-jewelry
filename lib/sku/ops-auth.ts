import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { getSkuServiceConfig } from "@/lib/sku/config";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export type SkuOpsAuthorization =
  | { readonly ok: true }
  | { readonly ok: false; readonly status: 401 | 503 };

/** Authenticate internal ops callers without exposing the shared service token. */
export function authorizeSkuOpsRequest(request: Request): SkuOpsAuthorization {
  const config = getSkuServiceConfig();
  if (!config.configured) return { ok: false, status: 503 };

  const authorization = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!authorization.startsWith(prefix)) return { ok: false, status: 401 };

  const supplied = authorization.slice(prefix.length);
  return timingSafeEqual(digest(supplied), digest(config.serviceToken))
    ? { ok: true }
    : { ok: false, status: 401 };
}
