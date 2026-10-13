#!/usr/bin/env node
/**
 * Dry-run catalog auditor (Этап 5 Slice A).
 *
 * Reads a fixture (or prepared Shopify export) of { externalVariantId, sku },
 * POSTs /v1/workspaces/{key}/audit/catalog, and writes a local checkpoint so
 * identical re-runs do not "notify" again. Does not create SKUs or mutate the ledger.
 *
 * Usage:
 *   SKU_API_URL=… SKU_API_TOKEN=… pnpm --filter @synarava/sku-api audit:catalog
 *   pnpm --filter @synarava/sku-api audit:catalog -- --fixture ./fixtures/catalog-audit-sample.json
 *
 * Docs: docs/runbooks/sku-catalog-audit-staging.md
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

function argValue(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

const fixturePath = resolve(
  root,
  argValue("--fixture", "fixtures/catalog-audit-sample.json"),
);
const checkpointPath = resolve(
  root,
  argValue("--checkpoint", ".sku-audit-checkpoint.json"),
);
const baseUrl = (process.env.SKU_API_URL ?? "http://127.0.0.1:8787").replace(
  /\/$/,
  "",
);
const token = process.env.SKU_API_TOKEN ?? process.env.SKU_API_DEV_TOKEN ?? "";
const workspaceKey =
  process.env.SKU_API_WORKSPACE ??
  JSON.parse(readFileSync(fixturePath, "utf8")).workspaceKey ??
  "synarava-shop";

if (!token) {
  console.error(
    "Set SKU_API_TOKEN (or SKU_API_DEV_TOKEN for local) before running audit:catalog.",
  );
  process.exit(1);
}

const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const items = (fixture.items ?? []).map((row) => ({
  externalVariantId: row.externalVariantId,
  sku: row.sku ?? "",
}));

let previousDigest = null;
if (existsSync(checkpointPath)) {
  try {
    previousDigest = JSON.parse(readFileSync(checkpointPath, "utf8")).digest ?? null;
  } catch {
    previousDigest = null;
  }
}

const correlationId = `catalog-audit-${randomUUID()}`;
const res = await fetch(
  `${baseUrl}/v1/workspaces/${encodeURIComponent(workspaceKey)}/audit/catalog`,
  {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      items,
      previousDigest,
      correlationId,
    }),
  },
);

const body = await res.json();
if (!res.ok) {
  console.error(JSON.stringify({ ok: false, status: res.status, body }, null, 2));
  process.exit(1);
}

mkdirSync(dirname(checkpointPath), { recursive: true });
writeFileSync(
  checkpointPath,
  JSON.stringify(
    {
      digest: body.digest,
      updatedAt: new Date().toISOString(),
      correlationId,
      deviationCount: body.deviationCount,
    },
    null,
    2,
  ),
);

const summary = {
  ok: true,
  shouldNotify: body.shouldNotify,
  deviationCount: body.deviationCount,
  itemCount: body.itemCount,
  durationMs: body.durationMs,
  llmEnabled: body.llmEnabled,
  digest: body.digest,
  previousDigest,
  checkpointPath,
  correlationId,
  deviations: body.deviations,
};

console.log(JSON.stringify(summary, null, 2));
if (body.shouldNotify) {
  console.error(
    `[catalog-audit] NOTIFY: ${body.deviationCount} deviation(s); digest changed.`,
  );
  process.exitCode = 2;
} else {
  console.error(
    `[catalog-audit] no new notification (deviations=${body.deviationCount}).`,
  );
}
