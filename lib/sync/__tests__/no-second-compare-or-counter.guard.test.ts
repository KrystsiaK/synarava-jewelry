import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard: no second compare function and no second counter outside lib/sync.
 * Allowed: lib/sync itself, thin re-exports, tests, docs, and low-level
 * projection diff (canonicalize / diffShopifyProjections) which compare imports.
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
];

/** Paths that may keep a deprecated thin wrapper that re-exports or delegates to lib/sync. */
const THIN_WRAPPER_ALLOWLIST = new Set([
  // Deleted in this PR — listed so a resurrected file fails the guard.
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
});
