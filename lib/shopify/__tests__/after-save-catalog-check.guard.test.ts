import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural guard: every product / collection / SKU-assign / push-pull / Apply
 * post-action path must await the shared scoped helper with an entity scope.
 * Full catalog scope is forbidden on post-action paths (top-bar + login only).
 */

const root = join(process.cwd());
const actionsDir = join(root, "app/admin/actions");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

/** Closed set of entity actions that must call runAfterSaveCatalogConflictCheck with scope. */
const REQUIRED_CALL_SITES: Array<{ file: string; fn: string; scopeKind: "product" | "collection" }> = [
  { file: "app/admin/actions/products.ts", fn: "saveProductAction", scopeKind: "product" },
  { file: "app/admin/actions/collections.ts", fn: "saveCollectionAction", scopeKind: "collection" },
  { file: "app/admin/actions/sku-assign.ts", fn: "assignProductSkuAction", scopeKind: "product" },
  { file: "app/admin/actions/sku-assign.ts", fn: "resumePendingSkuAction", scopeKind: "product" },
  { file: "app/admin/actions/sync.ts", fn: "pushSingleProductToShopifyAction", scopeKind: "product" },
  { file: "app/admin/actions/sync.ts", fn: "pullSingleProductFromShopifyAction", scopeKind: "product" },
];

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

describe("after-save scoped conflict check guard", () => {
  it("helper runs scoped waterfall and never schedules after() follow-up", () => {
    const helper = read("lib/shopify/after-save-catalog-check.ts");
    expect(helper).toMatch(/runSyncWaterfall/);
    expect(helper).toMatch(/RefreshShopifyStateScope/);
    expect(helper).toMatch(/alreadyRunning/);
    expect(helper).not.toMatch(/runCatalogConflictCheck/);
    expect(helper).not.toMatch(/\bafter\s*\(/);
    expect(helper).not.toMatch(/from\s+"next\/server"/);
  });

  it("every required entity action awaits scoped runAfterSaveCatalogConflictCheck", () => {
    for (const site of REQUIRED_CALL_SITES) {
      const source = read(site.file);
      expect(
        source,
        `${site.file} must import/use runAfterSaveCatalogConflictCheck`,
      ).toMatch(/runAfterSaveCatalogConflictCheck/);
      const body = extractFunction(source, site.fn);
      expect(
        body,
        `${site.fn} in ${site.file} must await the shared helper`,
      ).toMatch(/await\s+runAfterSaveCatalogConflictCheck\s*\(/);
      expect(body, `${site.fn} must pass entity scope kind:${site.scopeKind}`).toMatch(
        new RegExp(`kind:\\s*"${site.scopeKind}"`),
      );
      expect(body, `${site.fn} must not pass catalog scope`).not.toMatch(/kind:\s*"catalog"/);
      expect(body, `${site.fn} must not fire-and-forget via void`).not.toMatch(
        /void\s+run(Product|Collection|Catalog)ConflictCheck/,
      );
      expect(body, `${site.fn} must not use next/server after() for the check`).not.toMatch(
        /after\s*\(\s*\(\s*\)\s*=>/,
      );
    }
  });

  it("conflict Apply service rechecks each affected entity with scope", () => {
    const service = read("lib/sync/conflicts/service.ts");
    expect(service).toMatch(/runAfterSaveCatalogConflictCheck\s*\(/);
    expect(service).toMatch(/kind:\s*"product"/);
    expect(service).toMatch(/kind:\s*"collection"/);
    expect(service).not.toMatch(/runAfterSaveCatalogConflictCheck\([^,]+\)\s*;/);
  });

  it("language settings do not invoke post-action catalog check", () => {
    const languages = read("app/admin/actions/languages.ts");
    expect(languages).not.toMatch(/runAfterSaveCatalogConflictCheck/);
    expect(languages).not.toMatch(/runCatalogConflictCheck/);
  });

  it("no post-action path schedules a full catalog follow-up via after()", () => {
    const helper = read("lib/shopify/after-save-catalog-check.ts");
    expect(helper).not.toMatch(/after\s*\(\s*\(\s*\)\s*=>\s*[\s\S]*runCatalogConflictCheck/);
    for (const file of ["products.ts", "collections.ts", "sku-assign.ts", "sync.ts"]) {
      const source = read(`app/admin/actions/${file}`);
      expect(source).not.toMatch(/after\s*\(\s*\(\s*\)\s*=>\s*[\s\S]{0,200}runCatalogConflictCheck/);
    }
  });

  it("required call-site count stays explicit (inventory for PR description)", () => {
    expect(REQUIRED_CALL_SITES).toHaveLength(6);
    const actionFiles = readdirSync(actionsDir).filter((name) => name.endsWith(".ts") && !name.includes("__tests__"));
    expect(actionFiles.length).toBeGreaterThan(5);
  });
});
