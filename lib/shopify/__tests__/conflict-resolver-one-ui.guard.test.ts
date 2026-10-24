import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard: ONE conflict-resolution UI — components/synarava-cms/conflict-resolver*.
 * Anything else under components/ or app/ that renders Take/Keep choice copy,
 * direction string literals, or calls conflict apply / whole-record pull-push
 * for conflict choice must fail CI.
 */

const root = join(process.cwd());
const CHOICE_STRINGS = [
  /Take Shopify/,
  /Keep ours/,
  /Use Shopify version/,
  /Keep Synarava and push/,
  /Pull Shopify update/,
];

const DIRECTION_LITERALS = [
  /["']SHOPIFY_TO_SYNARAVA["']/,
  /["']SYNARAVA_TO_SHOPIFY["']/,
];

const FORBIDDEN_CALLS = [
  /applyCatalogConflictResolutionAction\s*\(/,
  /applyCollectionConflictResolutionAction\s*\(/,
  /previewCatalogConflictResolutionAction\s*\(/,
  /previewCollectionConflictResolutionAction\s*\(/,
  /pullSingleProductFromShopifyAction\s*\(/,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "graphify-out" || name === "dist") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(full);
  }
  return out;
}

function isAdapter(rel: string): boolean {
  return rel === "components/admin/products/product-conflict-adapter.tsx"
    || rel === "components/admin/collections/collection-conflict-adapter.tsx";
}

describe("ONE ConflictResolver UI guard", () => {
  const files = [
    ...walk(join(root, "components")),
    ...walk(join(root, "app")),
  ].map((full) => ({ full, rel: relative(root, full) }));

  it("no choice copy or direction literals outside conflict-resolver*", () => {
    const offenders: string[] = [];
    for (const { full, rel } of files) {
      if (rel.startsWith("components/synarava-cms/conflict-resolver")) continue;
      if (rel.includes("/__tests__/") || rel.includes(".test.") || rel.includes(".stories.")) continue;
      if (rel.startsWith("lib/") || rel.startsWith("app/admin/actions/") || rel.startsWith("app/admin/api/")) continue;
      const source = readFileSync(full, "utf8");
      for (const pattern of CHOICE_STRINGS) {
        if (pattern.test(source)) offenders.push(`${rel} matches ${pattern}`);
      }
      for (const pattern of DIRECTION_LITERALS) {
        if (pattern.test(source)) offenders.push(`${rel} matches ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("conflict apply/preview and pull-single are only called from resolver or adapters (or justified push path)", () => {
    const offenders: string[] = [];
    for (const { full, rel } of files) {
      if (rel.startsWith("components/synarava-cms/conflict-resolver")) continue;
      if (isAdapter(rel)) continue; // adapters bridge preview/apply into ConflictResolver
      if (rel.includes("/__tests__/") || rel.includes(".test.") || rel.includes(".stories.")) continue;
      if (rel.startsWith("lib/") || rel.startsWith("app/admin/actions/")) continue;
      const source = readFileSync(full, "utf8");
      for (const pattern of FORBIDDEN_CALLS) {
        if (pattern.test(source)) offenders.push(`${rel} calls ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("adapters do not render choice copy or direction string literals", () => {
    const offenders: string[] = [];
    for (const rel of [
      "components/admin/products/product-conflict-adapter.tsx",
      "components/admin/collections/collection-conflict-adapter.tsx",
    ]) {
      const source = readFileSync(join(root, rel), "utf8");
      for (const pattern of CHOICE_STRINGS) {
        if (pattern.test(source)) offenders.push(`${rel} matches ${pattern}`);
      }
      for (const pattern of DIRECTION_LITERALS) {
        if (pattern.test(source)) offenders.push(`${rel} matches ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("pushSingle remains only for non-conflict create/push in product-edit-form", () => {
    const offenders: string[] = [];
    for (const { full, rel } of files) {
      if (rel.includes("/__tests__/") || rel.includes(".test.")) continue;
      if (rel.startsWith("app/admin/actions/")) continue;
      const source = readFileSync(full, "utf8");
      if (!/pushSingleProductToShopifyAction\s*\(/.test(source)) continue;
      if (rel === "components/admin/products/product-edit-form.tsx") continue;
      offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});
