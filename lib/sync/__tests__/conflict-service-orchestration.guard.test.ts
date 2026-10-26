import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Conflict apply/preview/signals orchestration: ONE service; actions stay thin. */

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

function extractFunction(source: string, name: string): string {
  const start = source.search(new RegExp(`(?:export\\s+)?async function ${name}\\s*\\(`));
  if (start < 0) throw new Error(`Function ${name} not found`);
  let depth = 0;
  let paramClose = -1;
  for (let i = source.indexOf("(", start); i < source.length; i += 1) {
    if (source[i] === "(") depth += 1;
    else if (source[i] === ")") {
      depth -= 1;
      if (depth === 0) { paramClose = i; break; }
    }
  }
  const braceStart = source.indexOf("{", paramClose);
  depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Unbalanced braces for ${name}`);
}

const CONFLICT_ACTIONS = [
  "loadCatalogConflictSignalsAction",
  "loadCollectionConflictSignalsAction",
  "loadProductCatalogConflictAction",
  "loadCollectionCatalogConflictAction",
  "previewCatalogConflictResolutionAction",
  "previewCollectionConflictResolutionAction",
  "applyCatalogConflictResolutionAction",
  "applyCollectionConflictResolutionAction",
] as const;

describe("conflict service orchestration guard", () => {
  const syncActions = read("app/admin/actions/sync.ts");
  const service = read("lib/sync/conflicts/service.ts");

  it("service owns after-save, revalidation, and apply messages", () => {
    expect(service).toMatch(/runAfterSaveCatalogConflictCheck\s*\(/);
    expect(service).toMatch(/revalidatePath\s*\(/);
    expect(service).toMatch(/None of the selected changes could be applied/);
    expect(syncActions).not.toMatch(/None of the selected changes could be applied/);
  });

  it("conflict actions are thin auth wrappers without try/catch orchestration", () => {
    expect(syncActions).toMatch(/from\s+"@\/lib\/sync\/conflicts\/service"/);
    for (const name of CONFLICT_ACTIONS) {
      const body = extractFunction(syncActions, name);
      expect(body).toMatch(/requireAdminSession/);
      expect(body).not.toMatch(/\btry\s*\{/);
      expect(body).not.toMatch(/runAfterSaveCatalogConflictCheck/);
      expect(body).not.toMatch(/revalidatePath\s*\(/);
      expect(body).not.toMatch(/hasShopifyAdminConfig/);
    }
  });
});

