import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ONE SoT architecture guards (sync cleanup items 7):
 * - ConflictResolver field lists come from SyncResult leaves via
 *   `catalogConflictFieldsForEntity` + waterfall `skipRefresh` — not a second
 *   live Shopify compare on open.
 * - Forbidden: resurrect `getProductCatalogConflict` / `getCollectionCatalogConflict`
 *   as Shopify-fetching dual compares.
 * - Forbidden: write `syncStatus: "CONFLICT"` inside refresh / inspect bodies.
 * - Companion: `no-second-compare-or-counter.guard.test.ts` for parallel counters.
 */

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

/** Extract a top-level function body by name (brace-balanced; export optional). */
function extractFunction(source: string, name: string): string {
  const start = source.search(new RegExp(`(?:export\\s+)?async function ${name}\\s*\\(`));
  if (start < 0) throw new Error(`Function ${name} not found`);
  const paramOpen = source.indexOf("(", start);
  let depth = 0;
  let paramClose = -1;
  for (let i = paramOpen; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) {
        paramClose = i;
        break;
      }
    }
  }
  if (paramClose < 0) throw new Error(`No parameter list for ${name}`);
  const braceStart = source.indexOf("{", paramClose);
  if (braceStart < 0) throw new Error(`No body for ${name}`);
  depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Unbalanced braces for ${name}`);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "dist" || name === ".next" || name === "graphify-out") {
      continue;
    }
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const FORBIDDEN_DUAL_COMPARE_SYMBOLS = [
  /\bfunction\s+getProductCatalogConflict\b/,
  /\bexport\s+(?:async\s+)?function\s+getProductCatalogConflict\b/,
  /\bfunction\s+getCollectionCatalogConflict\b/,
  /\bexport\s+(?:async\s+)?function\s+getCollectionCatalogConflict\b/,
];

const FORBIDDEN_DUAL_COMPARE_IMPORTS = [
  /\bgetProductCatalogConflict\b/,
  /\bgetCollectionCatalogConflict\b/,
];

const CONFLICT_STATUS_WRITE = /syncStatus\s*:\s*["']CONFLICT["']/;

describe("ONE SoT — ConflictResolver fields from SyncResult leaves", () => {
  it("product conflict loader maps leaves via catalogConflictFieldsForEntity + skipRefresh waterfall", () => {
    const source = read("lib/shopify/catalog-conflict.ts");
    const code = stripComments(source);
    expect(code).toMatch(/catalogConflictFieldsForEntity/);
    expect(code).toMatch(/from\s+["']@\/lib\/sync["']/);
    expect(code).toMatch(/runSyncWaterfall/);
    expect(code).toMatch(/loadProductConflictFromSyncResult/);
    expect(code).not.toMatch(/\bgetProductCatalogConflict\b/);
    expect(code).not.toMatch(/inspectProductSyncState/);
    expect(code).not.toMatch(/refreshShopifyProductState/);

    const loadBody = extractFunction(source, "loadProductConflictFromSyncResult");
    expect(loadBody).toMatch(/runSyncWaterfall/);
    expect(loadBody).toMatch(/skipRefresh/);
    expect(loadBody).toMatch(/catalogConflictFieldsForEntity/);
    expect(loadBody).not.toMatch(/inspectProductSyncState/);

    const listBody = extractFunction(source, "listConflictedProductIds");
    expect(listBody).toMatch(/runSyncWaterfall/);
    expect(listBody).toMatch(/skipRefresh\s*:\s*true/);
    expect(listBody).toMatch(/result\.leaves/);
    expect(stripComments(listBody)).not.toMatch(/syncStatus/);
  });

  it("collection conflict loader maps leaves via catalogConflictFieldsForEntity + skipRefresh waterfall", () => {
    const source = read("lib/shopify/collection-conflict.ts");
    const code = stripComments(source);
    expect(code).toMatch(/catalogConflictFieldsForEntity/);
    expect(code).toMatch(/from\s+["']@\/lib\/sync["']/);
    expect(code).toMatch(/runSyncWaterfall/);
    expect(code).toMatch(/loadCollectionConflictFromSyncResult/);
    expect(code).not.toMatch(/\bgetCollectionCatalogConflict\b/);
    expect(code).not.toMatch(/refreshShopifyCollectionState/);
    expect(code).not.toMatch(/inspectProductSyncState/);

    const loadBody = extractFunction(source, "loadCollectionConflictFromSyncResult");
    expect(loadBody).toMatch(/runSyncWaterfall/);
    expect(loadBody).toMatch(/skipRefresh/);
    expect(loadBody).toMatch(/catalogConflictFieldsForEntity/);

    const listBody = extractFunction(source, "listConflictedCollectionIds");
    expect(listBody).toMatch(/runSyncWaterfall/);
    expect(listBody).toMatch(/skipRefresh\s*:\s*true/);
    expect(listBody).toMatch(/result\.leaves/);
    expect(stripComments(listBody)).not.toMatch(/syncStatus/);
  });

  it("admin open-conflict actions force skipRefresh (display-only, no Shopify fetch)", () => {
    // The actions are thin wrappers; the conflict service owns the load (one place).
    const actions = read("app/admin/actions/sync.ts");
    expect(extractFunction(actions, "loadProductCatalogConflictAction")).toMatch(/loadEntityConflict\(\s*"product"/);
    expect(extractFunction(actions, "loadCollectionCatalogConflictAction")).toMatch(/loadEntityConflict\(\s*"collection"/);

    const service = read("lib/sync/conflicts/service.ts");
    const load = service.slice(service.indexOf("export async function loadEntityConflict(\n  entity: ConflictEntity"));
    expect(load).toMatch(/loadProductConflictFromSyncResult/);
    expect(load).toMatch(/loadCollectionConflictFromSyncResult/);
    expect(load.match(/skipRefresh\s*:\s*true/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(load).not.toMatch(/inspectProductSyncState/);
  });

  it("apply path may inspect once, then maps leaves with skipRefresh", () => {
    const source = read("lib/shopify/catalog-conflict-apply.ts");
    const body = extractFunction(source, "loadProductConflictForApply");
    expect(body).toMatch(/inspectProductSyncState/);
    expect(body).toMatch(/loadProductConflictFromSyncResult/);
    expect(body).toMatch(/skipRefresh\s*:\s*true/);
    // Must not resurrect the deleted dual-compare helper.
    expect(stripComments(source)).not.toMatch(/\bgetProductCatalogConflict\b/);
  });
});

describe("ONE SoT — forbidden dual get*CatalogConflict resurrection", () => {
  it("does not define or import getProduct/CollectionCatalogConflict outside tests/docs/history", () => {
    const files = walk(root).map((file) => relative(root, file));
    const violations: string[] = [];
    for (const rel of files) {
      if (rel.includes("/__tests__/") || rel.includes(".test.") || rel.includes(".stories.")) continue;
      if (rel.startsWith("docs/history/") || rel.startsWith("docs/proposals/") || rel.startsWith("docs/audits/")) {
        continue;
      }
      if (!rel.startsWith("lib/") && !rel.startsWith("app/") && !rel.startsWith("components/")) continue;
      const source = stripComments(read(rel));
      for (const pattern of FORBIDDEN_DUAL_COMPARE_SYMBOLS) {
        if (pattern.test(source)) violations.push(`${rel} defines ${pattern}`);
      }
      // Mentions of the deleted symbols anywhere in production code are a smell
      // (imports, call sites, re-exports). JSDoc TODOs pointing at deleted APIs
      // also fail — clean them up rather than allowlist.
      for (const pattern of FORBIDDEN_DUAL_COMPARE_IMPORTS) {
        if (pattern.test(source)) violations.push(`${rel} mentions ${pattern}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("deleted dual-compare module paths stay gone", () => {
    // Historical names lived in these modules; ensure no parallel dual-compare file returns.
    for (const path of [
      "lib/shopify/get-product-catalog-conflict.ts",
      "lib/shopify/get-collection-catalog-conflict.ts",
      "lib/sync/build-signals.ts",
      "lib/sync/apply",
    ]) {
      expect(existsSync(join(root, path)), path).toBe(false);
    }
  });
});

describe("ONE SoT — refresh/inspect must not write syncStatus CONFLICT", () => {
  it("refreshShopifyProductState body has no syncStatus CONFLICT write", () => {
    const body = extractFunction(read("lib/shopify/product-sync.ts"), "refreshShopifyProductState");
    expect(stripComments(body)).not.toMatch(CONFLICT_STATUS_WRITE);
    expect(stripComments(body)).not.toMatch(/syncStatus\s*:/);
  });

  it("inspectProductSyncState body has no syncStatus CONFLICT write", () => {
    const body = extractFunction(read("lib/shopify/product-sync.ts"), "inspectProductSyncState");
    expect(stripComments(body)).not.toMatch(CONFLICT_STATUS_WRITE);
    expect(stripComments(body)).not.toMatch(/syncStatus\s*:/);
  });

  it("refreshShopifyCollectionState body has no syncStatus CONFLICT write", () => {
    const body = extractFunction(
      read("lib/shopify/collection-presence-server.ts"),
      "refreshShopifyCollectionState",
    );
    expect(stripComments(body)).not.toMatch(CONFLICT_STATUS_WRITE);
    expect(stripComments(body)).not.toMatch(/syncStatus\s*:/);
  });
});
