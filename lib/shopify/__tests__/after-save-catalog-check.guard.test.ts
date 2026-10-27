import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural guard: every product / collection / language-setting / SKU-assign
 * save action must await the shared post-save full catalog check helper.
 * Mirrors auto-sync-no-synarava-writers.guard.test.ts style.
 */

const root = join(process.cwd());
const actionsDir = join(root, "app/admin/actions");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

/** Closed set of save actions that must call runAfterSaveCatalogConflictCheck. */
const REQUIRED_CALL_SITES: Array<{ file: string; fn: string }> = [
  { file: "app/admin/actions/products.ts", fn: "saveProductAction" },
  { file: "app/admin/actions/collections.ts", fn: "saveCollectionAction" },
  { file: "app/admin/actions/sku-assign.ts", fn: "assignProductSkuAction" },
  { file: "app/admin/actions/sku-assign.ts", fn: "resumePendingSkuAction" },
  { file: "app/admin/actions/languages.ts", fn: "addLanguageAction" },
  { file: "app/admin/actions/languages.ts", fn: "hideLanguageAction" },
  { file: "app/admin/actions/languages.ts", fn: "restoreLanguageAction" },
  { file: "app/admin/actions/languages.ts", fn: "importLanguageAction" },
  { file: "app/admin/actions/languages.ts", fn: "deleteLanguageDataAction" },
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

describe("after-save catalog check guard", () => {
  it("helper exists and calls runCatalogConflictCheck (full store)", () => {
    const helper = read("lib/shopify/after-save-catalog-check.ts");
    expect(helper).toMatch(/runCatalogConflictCheck/);
    expect(helper).toMatch(/trigger:\s*"MANUAL"/);
    expect(helper).toMatch(/alreadyRunning/);
  });

  it("every required save action awaits runAfterSaveCatalogConflictCheck", () => {
    for (const site of REQUIRED_CALL_SITES) {
      const source = read(site.file);
      expect(
        source,
        `${site.file} must import/use runAfterSaveCatalogConflictCheck`,
      ).toMatch(/runAfterSaveCatalogConflictCheck/);
      const body = extractFunction(source, site.fn);
      const callsHelperDirectly = /runAfterSaveCatalogConflictCheck\s*\(/.test(body);
      const callsLocalWrapper = /await\s+afterLanguageSettingSave\s*\(/.test(body);
      expect(
        callsHelperDirectly || callsLocalWrapper,
        `${site.fn} in ${site.file} must await the shared helper (or its local wrapper)`,
      ).toBe(true);
      if (callsLocalWrapper) {
        const wrapper = extractFunction(source, "afterLanguageSettingSave");
        expect(wrapper).toMatch(/runAfterSaveCatalogConflictCheck\s*\(/);
        expect(wrapper).toMatch(/await\s+runAfterSaveCatalogConflictCheck\s*\(/);
      }
      expect(body, `${site.fn} must not fire-and-forget via void`).not.toMatch(
        /void\s+run(Product|Collection)ConflictCheck/,
      );
      expect(body, `${site.fn} must not use next/server after() for the check`).not.toMatch(
        /after\s*\(\s*\(\s*\)\s*=>/,
      );
    }
  });

  it("legacy scoped void after-save checks are gone from action files", () => {
    for (const file of ["products.ts", "collections.ts", "sku-assign.ts"]) {
      const source = read(`app/admin/actions/${file}`);
      expect(source).not.toMatch(/void\s+runProductConflictCheck/);
      expect(source).not.toMatch(/runCollectionConflictCheck/);
      expect(source).not.toMatch(/runCollectionsConflictCheck/);
    }
  });

  it("required call-site count stays explicit (inventory for PR description)", () => {
    expect(REQUIRED_CALL_SITES).toHaveLength(9);
    const actionFiles = readdirSync(actionsDir).filter((name) => name.endsWith(".ts") && !name.includes("__tests__"));
    expect(actionFiles.length).toBeGreaterThan(5);
  });
});
