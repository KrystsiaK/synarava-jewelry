import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Import-based one-compare guards:
 * - `diffShopifyProjections` is the low-level commerce window diff used BY
 *   `compareSyncState` (and informational refresh status) — Apply must not
 *   import it for a second compare.
 * - Apply / conflict-apply modules must not import `inspectProductSyncState`
 *   (its `differences` were the second compare).
 * - `fetchShopifyProduct` / `refresh*State` have an explicit caller allowlist.
 *
 * Prefer path allowlists over function-name matching inside bodies.
 */

const root = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "dist" || name === ".next" || name === "graphify-out") {
      continue;
    }
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function productionFiles(): string[] {
  return walk(root)
    .map((file) => relative(root, file))
    .filter((rel) => {
      if (rel.includes("/__tests__/") || rel.includes(".test.") || rel.includes(".stories.")) return false;
      if (rel.startsWith("docs/") || rel.startsWith("prisma/")) return false;
      return rel.startsWith("lib/") || rel.startsWith("app/") || rel.startsWith("components/");
    });
}

const DIFF_SHOPIFY_PROJECTIONS_ALLOW = new Set([
  "lib/shopify/shopify-projection-diff.ts", // definition
  "lib/sync/compare.ts", // ONE compare
  "lib/shopify/product-sync.ts", // refresh/inspect informational status + strip snapshot
  "lib/shopify/collection-commerce-projection.ts", // collection window helper used by compare path
  "lib/shopify/local-commerce-projection.ts",
]);

const FETCH_SHOPIFY_PRODUCT_ALLOW = new Set([
  "lib/shopify/product-sync.ts", // definition + refresh/push/pull/inspect
  "lib/shopify/commerce-field-apply.ts", // single-variant pairing for write (not compare)
]);

const REFRESH_PRODUCT_STATE_ALLOW = new Set([
  "lib/shopify/product-sync.ts", // definition + callers inside module
  "lib/sync/refresh-shopify-state.ts", // waterfall
  "app/api/shopify/webhooks/products/route.ts",
]);

const REFRESH_COLLECTION_STATE_ALLOW = new Set([
  "lib/shopify/collection-presence-server.ts", // definition + human apply helpers
  "lib/sync/refresh-shopify-state.ts", // waterfall
  "lib/shopify/collection-commerce-field-apply.ts", // post-push window refresh (write path)
]);

const APPLY_MODULES = [
  "lib/shopify/catalog-conflict-apply.ts",
  "lib/shopify/collection-conflict-apply.ts",
  "lib/shopify/commerce-field-apply.ts",
  "lib/shopify/collection-commerce-field-apply.ts",
];

describe("one-compare import allowlists", () => {
  const files = productionFiles();

  it("diffShopifyProjections is only imported by the one-compare allowlist", () => {
    const violations: string[] = [];
    for (const rel of files) {
      const source = readFileSync(join(root, rel), "utf8");
      if (!/\bdiffShopifyProjections\b/.test(stripComments(source))) continue;
      if (DIFF_SHOPIFY_PROJECTIONS_ALLOW.has(rel)) continue;
      // Re-exports / other projection helpers that only mention in comments already stripped.
      violations.push(rel);
    }
    expect(violations).toEqual([]);
  });

  it("fetchShopifyProduct is only imported by product-sync + commerce write variant pairing", () => {
    const violations: string[] = [];
    for (const rel of files) {
      const source = readFileSync(join(root, rel), "utf8");
      if (!/\bfetchShopifyProduct\b/.test(stripComments(source))) continue;
      if (FETCH_SHOPIFY_PRODUCT_ALLOW.has(rel)) continue;
      violations.push(rel);
    }
    expect(violations).toEqual([]);
  });

  it("refreshShopifyProductState callers stay on waterfall / webhook / definition", () => {
    const violations: string[] = [];
    for (const rel of files) {
      const source = stripComments(readFileSync(join(root, rel), "utf8"));
      if (!/\brefreshShopifyProductState\b/.test(source)) continue;
      if (REFRESH_PRODUCT_STATE_ALLOW.has(rel)) continue;
      violations.push(rel);
    }
    expect(violations).toEqual([]);
  });

  it("refreshShopifyCollectionState callers stay on waterfall / presence / collection field write", () => {
    const violations: string[] = [];
    for (const rel of files) {
      const source = stripComments(readFileSync(join(root, rel), "utf8"));
      if (!/\brefreshShopifyCollectionState\b/.test(source)) continue;
      if (REFRESH_COLLECTION_STATE_ALLOW.has(rel)) continue;
      violations.push(rel);
    }
    expect(violations).toEqual([]);
  });

  it("Apply modules must not import inspectProductSyncState or diffShopifyProjections", () => {
    const violations: string[] = [];
    for (const rel of APPLY_MODULES) {
      const source = stripComments(readFileSync(join(root, rel), "utf8"));
      if (/\binspectProductSyncState\b/.test(source)) {
        violations.push(`${rel} imports/calls inspectProductSyncState`);
      }
      if (/\bdiffShopifyProjections\b/.test(source)) {
        violations.push(`${rel} imports/calls diffShopifyProjections`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("commerce-field-apply verifies via recheckEntityConflictLeaves, not inspection.differences", () => {
    const source = stripComments(readFileSync(join(root, "lib/shopify/commerce-field-apply.ts"), "utf8"));
    expect(source).toMatch(/recheckEntityConflictLeaves/);
    expect(source).not.toMatch(/\.differences\b/);
    expect(source).not.toMatch(/syncStatus\s*:\s*["']SYNCED["']/);
  });
});

describe("no-second-compare allowlist does not excuse Apply second compare", () => {
  it("lib/sync remains the home of compare — Apply uses recheck helper from there", () => {
    // Architecture: a second compare is banned by Apply-module import rules above,
    // not by removing lib/sync from the counter-definition allowlist (lib/sync owns
    // compareSyncState / selectSyncCounts).
    const helper = readFileSync(join(root, "lib/sync/recheck-entity-leaves.ts"), "utf8");
    expect(helper).toMatch(/runSyncWaterfall/);
    expect(helper).toMatch(/skipRefresh:\s*false/);
    expect(stripComments(helper)).not.toMatch(/inspectProductSyncState/);
    expect(stripComments(helper)).not.toMatch(/diffShopifyProjections/);
  });
});
