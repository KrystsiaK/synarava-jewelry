/**
 * Phase 2 — admin Server Action auth inventory guards.
 * Findings: docs/audits/2026-10-28-server-auth.md
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ACTIONS_DIR = join(process.cwd(), "app/admin/actions");
const ACCOUNT_ACTIONS = join(process.cwd(), "app/admin/account/actions.ts");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function listActionModules(): string[] {
  const files = readdirSync(ACTIONS_DIR)
    .filter((name) => name.endsWith(".ts") && !name.includes(".test."))
    .map((name) => join(ACTIONS_DIR, name));
  return [...files, ACCOUNT_ACTIONS];
}

/** Exported async functions that must gate with requireAdminSession. */
const MUST_REQUIRE_ADMIN = [
  // Verified missing today — SYNC-AUTH findings (it.fails below until fixed)
  "saveSkuPolicyDraftAction",
  "publishSkuPolicyAction",
  "loadSkuPolicyEditorPayload",
  "getSavedProductPayload",
  "getSavedCollectionPayload",
  "getSavedPagePayload",
  // High-value mutations that already gate (regression lock)
  "saveProductAction",
  "deleteProductAction",
  "saveCollectionAction",
  "deleteCollectionAction",
  "savePageAction",
  "deletePageAction",
  "applyCatalogConflictResolutionAction",
  "pushSingleProductToShopifyAction",
  "pullSingleProductFromShopifyAction",
  "assignProductSkuAction",
  "uploadProductMediaAction",
] as const;

const INTENTIONALLY_PUBLIC = new Set([
  // login lives outside actions/; listed for clarity only
]);

function exportedAsyncNames(source: string): string[] {
  const names: string[] = [];
  const re = /export\s+async\s+function\s+([A-Za-z0-9_]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) names.push(match[1]!);
  return names;
}

function functionBody(source: string, name: string): string | null {
  const start = source.search(new RegExp(`export\\s+async\\s+function\\s+${name}\\s*\\(`));
  if (start < 0) return null;
  const paramOpen = source.indexOf("(", start);
  if (paramOpen < 0) return null;
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
  if (paramClose < 0) return null;
  const brace = source.indexOf("{", paramClose);
  if (brace < 0) return null;
  depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(brace, i + 1);
    }
  }
  return null;
}

describe("adversarial: admin action requireAdminSession inventory", () => {
  const modules = listActionModules().map((path) => ({
    path,
    source: stripComments(readFileSync(path, "utf8")),
  }));

  it("every listed high-value mutation exists as an exported async function", () => {
    const all = new Set(modules.flatMap((mod) => exportedAsyncNames(mod.source)));
    for (const name of MUST_REQUIRE_ADMIN) {
      if (INTENTIONALLY_PUBLIC.has(name)) continue;
      expect(all.has(name), name).toBe(true);
    }
  });

  it("save/delete/sync mutation actions call requireAdminSession in-body", () => {
    const locked = [
      "saveProductAction",
      "deleteProductAction",
      "saveCollectionAction",
      "deleteCollectionAction",
      "savePageAction",
      "deletePageAction",
      "applyCatalogConflictResolutionAction",
      "pushSingleProductToShopifyAction",
      "pullSingleProductFromShopifyAction",
      "assignProductSkuAction",
      "uploadProductMediaAction",
    ] as const;
    for (const name of locked) {
      const mod = modules.find((item) => exportedAsyncNames(item.source).includes(name));
      expect(mod, name).toBeDefined();
      const body = functionBody(mod!.source, name);
      expect(body, name).toBeTruthy();
      expect(body!, name).toMatch(/requireAdminSession\s*\(/);
    }
  });

  /**
   * AUTH-ADV-001 — SKU policy mutations lack requireAdminSession.
   * @see docs/audits/2026-10-28-server-auth.md#AUTH-ADV-001
   */
  it.fails("sku-policy mutations requireAdminSession (AUTH-ADV-001)", () => {
    const mod = modules.find((item) => item.path.endsWith("sku-policy.ts"));
    expect(mod).toBeDefined();
    for (const name of ["saveSkuPolicyDraftAction", "publishSkuPolicyAction", "loadSkuPolicyEditorPayload"] as const) {
      const body = functionBody(mod!.source, name);
      expect(body, name).toBeTruthy();
      expect(body!, name).toMatch(/requireAdminSession\s*\(/);
    }
  });

  /**
   * AUTH-ADV-002 — getSaved*Payload refresh helpers lack requireAdminSession.
   * @see docs/audits/2026-10-28-server-auth.md#AUTH-ADV-002
   */
  it.fails("getSaved*Payload helpers requireAdminSession (AUTH-ADV-002)", () => {
    const pairs: Array<[string, string]> = [
      ["products.ts", "getSavedProductPayload"],
      ["collections.ts", "getSavedCollectionPayload"],
      ["pages.ts", "getSavedPagePayload"],
    ];
    for (const [file, name] of pairs) {
      const mod = modules.find((item) => item.path.endsWith(file));
      expect(mod, file).toBeDefined();
      const body = functionBody(mod!.source, name);
      expect(body, name).toBeTruthy();
      expect(body!, name).toMatch(/requireAdminSession\s*\(/);
    }
  });
});
