/**
 * Phase 5 — reliability inventory locks.
 * Findings: docs/audits/2026-10-28-reliability.md
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("Phase 5 reliability inventory (REL-*)", () => {
  it.fails(
    "products webhook catches JSON parse errors as 400 (REL-001)",
    () => {
      const src = read("app/api/shopify/webhooks/products/route.ts");
      // Must not call bare JSON.parse(rawBody) outside a try that returns 400.
      expect(src).not.toMatch(/const payload = JSON\.parse\(rawBody\)/);
      expect(src).toMatch(/parseShopifyWebhookJson|try\s*\{[\s\S]*JSON\.parse/);
      expect(src).toMatch(/status:\s*400/);
    },
  );

  it("orders/paid uses safe parser and returns 400 on bad JSON", () => {
    const src = read("app/api/shopify/webhooks/orders/paid/route.ts");
    expect(src).toMatch(/parseShopifyWebhookJson/);
    expect(src).toMatch(/Invalid webhook payload[\s\S]*status:\s*400/);
  });

  it("claimWebhookEvent only reclaims when webhookId is present (REL-003)", () => {
    const src = read("lib/shopify/webhook-event.ts");
    expect(src).toMatch(/!params\.webhookId/);
    expect(src).toMatch(/PROCESSING_LEASE_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/);
    expect(src).toMatch(/status:\s*"FAILED"/);
  });

  it("collector process has no lease/lock before runOnce (REL-004)", () => {
    const entry = read("lib/mission-control/collector/entry.ts");
    const once = read("lib/mission-control/collector/run-once.ts");
    expect(entry).not.toMatch(/lease|advisory|singleFlight|tryAcquire/i);
    expect(once).not.toMatch(/lease|advisory|singleFlight|tryAcquire/i);
    // Catalog check does lease — contrast lock for the audit doc.
    expect(read("lib/shopify/reconciliation-run.ts")).toMatch(/CATALOG_CHECK_LEASE_MS/);
  });

  it("documents in-process throttle pacing limits (REL-005)", () => {
    const admin = read("lib/shopify/admin.ts");
    expect(admin).toMatch(/in-process pacing only/);
    const telemetry = read("lib/shopify/admin-telemetry.ts");
    expect(telemetry).toMatch(/SHOPIFY_THROTTLE_MAX_ATTEMPTS\s*=\s*5/);
    expect(telemetry).toMatch(/SHOPIFY_THROTTLE_MAX_TOTAL_WAIT_MS\s*=\s*30_000/);
  });

  it("recent migrations include intentional non-additive DROPs (REL-006)", () => {
    const dropWorking = read(
      "prisma/migrations/20261026160000_derive_synarava_extras_drop_working_snapshot/migration.sql",
    );
    expect(dropWorking).toMatch(/DROP COLUMN "workingSnapshot"/);
    const dropStore = read(
      "prisma/migrations/20261024100000_drop_commerce_sync_store/migration.sql",
    );
    expect(dropStore).toMatch(/DROP TABLE "CommerceSyncStore"/);
  });

  it("backup/restore scripts cited by runbooks exist (REL-007)", () => {
    const required = [
      "scripts/db-guard.mjs",
      "scripts/db/verify-derived-window.mjs",
      "scripts/db/rollback-working-snapshot.sql",
      "scripts/db/rollback-en-translation-rows.sql",
      "scripts/db/restore-entity-archive.sql",
      "scripts/db/prod-readiness-check.sql",
      "scripts/db/drop-archives.sql.commented",
    ];
    for (const rel of required) {
      expect(existsSync(join(ROOT, rel)), rel).toBe(true);
    }
  });

  it("all webhook route modules verify HMAC before work", () => {
    const root = join(ROOT, "app/api/shopify/webhooks");
    const routes: string[] = [];
    const walk = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name === "route.ts") routes.push(p);
      }
    };
    walk(root);
    expect(routes.length).toBeGreaterThanOrEqual(6);
    for (const file of routes) {
      const src = readFileSync(file, "utf8");
      expect(src, file).toMatch(/verifyShopifyWebhook/);
    }
  });
});
