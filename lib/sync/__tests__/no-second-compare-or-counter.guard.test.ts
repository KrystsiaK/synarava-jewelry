import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard: one sync system only.
 * - No second compare / counter outside lib/sync
 * - Deleted dual-store / three-way remnants must not return
 */

const root = process.cwd();

const FORBIDDEN_COMPARE_PATTERNS = [
  /function\s+compareSyncState\b/,
  /export\s+function\s+compareLocalizedFields\b/,
];

const FORBIDDEN_COUNTER_PATTERNS = [
  /function\s+countAdminNavSyncBySection\b/,
  /function\s+commerceFieldCountsFromStore\b/,
  /function\s+productConflictBadgeCount\b/,
  /function\s+buildCatalogConflictSignals\b/,
  // Pre-SoT dual Shopify compares — ConflictResolver uses SyncResult leaves only.
  /function\s+getProductCatalogConflict\b/,
  /function\s+getCollectionCatalogConflict\b/,
  /export\s+(?:async\s+)?function\s+getProductCatalogConflict\b/,
  /export\s+(?:async\s+)?function\s+getCollectionCatalogConflict\b/,
];

/** Symbols / paths removed in sync-unification PR7 — resurrecting them fails the guard. */
const FORBIDDEN_RESURRECTION_PATTERNS = [
  /CommerceSyncStore/,
  /refreshCommerceSyncStore/,
  /lib\/commerce-store/,
  /@\/lib\/commerce-store/,
  /runCommerceStoreConsoleFlow/,
  /applyShopifyProductTypeLabel/,
  /\bKEEP_LOCAL\b/,
  /\bAPPLY_REMOTE\b/,
  /\blocalIsDirty\b/,
  /\bgetProductCatalogConflict\b/,
  /\bgetCollectionCatalogConflict\b/,
];

const FORBIDDEN_RESURRECTION_PATHS = [
  "lib/commerce-store",
  "components/admin/products/commerce-store-console-flow.ts",
  "components/admin/products/product-conflict-badge-count.ts",
  "lib/sync/build-signals.ts",
  "lib/sync/apply",
  "app/admin/api/shopify/reconcile/apply",
];

const ALLOWED_PATH_PREFIXES = [
  "lib/sync/",
  "lib/shopify/shopify-projection-diff.ts", // low-level canonicalize/diff used BY compare
  "lib/i18n/sync-comparison.ts", // two-way helpers; compare owns orchestration
];

const ALLOWED_PATH_SUBSTRINGS = [
  "/__tests__/",
  ".test.ts",
  ".test.tsx",
  ".stories.",
  "docs/",
  "graphify-out/",
  "prisma/migrations/",
];

/** Paths that may keep a deprecated thin wrapper that re-exports or delegates to lib/sync. */
const THIN_WRAPPER_ALLOWLIST = new Set([
  // Deleted in PR7 — listed empty so a resurrected file fails the guard.
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "dist" || name === ".next") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

function isAllowed(rel: string): boolean {
  if (ALLOWED_PATH_PREFIXES.some((prefix) => rel.startsWith(prefix))) return true;
  if (ALLOWED_PATH_SUBSTRINGS.some((part) => rel.includes(part))) return true;
  if (THIN_WRAPPER_ALLOWLIST.has(rel)) return true;
  return false;
}

describe("no second compare or counter outside lib/sync", () => {
  const files = walk(root).map((file) => relative(root, file));

  it("does not redefine compareSyncState / parallel counters outside lib/sync", () => {
    const violations: string[] = [];
    for (const rel of files) {
      if (isAllowed(rel)) continue;
      if (!rel.startsWith("lib/") && !rel.startsWith("app/") && !rel.startsWith("components/")) continue;
      const source = readFileSync(join(root, rel), "utf8");
      for (const pattern of [...FORBIDDEN_COMPARE_PATTERNS, ...FORBIDDEN_COUNTER_PATTERNS]) {
        if (pattern.test(source)) {
          violations.push(`${rel} matches ${pattern}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("selectSyncCounts lives only under lib/sync", () => {
    const definitions = files.filter((rel) => {
      if (!/\.(ts|tsx)$/.test(rel)) return false;
      if (rel.includes("__tests__") || rel.includes(".test.")) return false;
      const source = readFileSync(join(root, rel), "utf8");
      return /export\s+function\s+selectSyncCounts\b/.test(source);
    });
    expect(definitions).toEqual(["lib/sync/select.ts"]);
  });

  it("does not resurrect CommerceSyncStore / three-way pull decisions / dead label apply", () => {
    const violations: string[] = [];
    for (const path of FORBIDDEN_RESURRECTION_PATHS) {
      if (existsSync(join(root, path))) {
        violations.push(`path exists: ${path}`);
      }
    }
    for (const rel of files) {
      if (isAllowed(rel)) continue;
      if (!rel.startsWith("lib/") && !rel.startsWith("app/") && !rel.startsWith("components/")) continue;
      // Prisma schema drop is the only allowed remaining mention in schema.prisma (must be absent).
      const source = readFileSync(join(root, rel), "utf8");
      for (const pattern of FORBIDDEN_RESURRECTION_PATTERNS) {
        if (pattern.test(source)) {
          violations.push(`${rel} matches ${pattern}`);
        }
      }
    }
    // Schema must not declare the model.
    const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
    if (/model\s+CommerceSyncStore\b/.test(schema)) {
      violations.push("prisma/schema.prisma still declares model CommerceSyncStore");
    }
    expect(violations).toEqual([]);
  });

  it("does not re-export deleted dual-path helpers from admin chrome barrels", () => {
    const barrels = [
      "components/admin/shared/admin-nav-config.ts",
      "components/synarava-cms/index.ts",
      "lib/sync/index.ts",
    ];
    const banned = /countAdminNavSyncBySection|buildCatalogConflictSignals|from\s+["'].*\/apply["']/;
    const violations: string[] = [];
    for (const rel of barrels) {
      const source = readFileSync(join(root, rel), "utf8");
      if (banned.test(source)) {
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });
});
