import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  COLLECTION_COMMERCE_FIELDS,
  PRODUCT_COMMERCE_FIELDS,
  isScopedCommerceFieldLabel,
  isScopedCollectionCommerceLabel,
  isScopedProductCommerceLabel,
  labelForWindowPath,
} from "@/lib/sync/field-registry";
import {
  SCOPED_COLLECTION_COMMERCE_FIELD_LABELS,
  SCOPED_COMMERCE_FIELD_LABELS,
} from "@/lib/shopify/catalog-conflict-policy";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("field-registry owns syncable commerce keys (ADR-0009)", () => {
  it("SCOPED labels in catalog-conflict-policy come from field-registry", () => {
    const productScoped = new Set(
      PRODUCT_COMMERCE_FIELDS.filter((f) => f.scopedApply).map((f) => f.label),
    );
    const collectionScoped = new Set(
      COLLECTION_COMMERCE_FIELDS.filter((f) => f.scopedApply).map((f) => f.label),
    );
    expect([...SCOPED_COMMERCE_FIELD_LABELS].toSorted()).toEqual([...productScoped].toSorted());
    expect([...SCOPED_COLLECTION_COMMERCE_FIELD_LABELS].toSorted()).toEqual(
      [...collectionScoped].toSorted(),
    );
    for (const label of SCOPED_COMMERCE_FIELD_LABELS) {
      expect(isScopedProductCommerceLabel(label)).toBe(true);
    }
    for (const label of SCOPED_COLLECTION_COMMERCE_FIELD_LABELS) {
      expect(isScopedCollectionCommerceLabel(label)).toBe(true);
    }
  });

  it("shopify-projection-diff has no parallel PATH_LABELS table", () => {
    const source = stripComments(read("lib/shopify/shopify-projection-diff.ts"));
    expect(source).not.toMatch(/\bPATH_LABELS\b/);
    expect(source).toMatch(/labelForWindowPath/);
    expect(source).toMatch(/from\s+["']@\/lib\/sync\/field-registry["']/);
  });

  it("synaravaOnly fields have empty windowPaths and are never scoped apply", () => {
    for (const field of PRODUCT_COMMERCE_FIELDS.filter((f) => f.scope === "synaravaOnly")) {
      expect(field.windowPaths).toEqual([]);
      expect(field.scopedApply).toBe(false);
      expect(isScopedCommerceFieldLabel(field.label)).toBe(false);
    }
  });

  it("labelForWindowPath covers every registry windowPaths entry", () => {
    for (const field of [...PRODUCT_COMMERCE_FIELDS, ...COLLECTION_COMMERCE_FIELDS]) {
      if (field.scope === "synaravaOnly") continue;
      for (const path of field.windowPaths) {
        const concrete = path.replace("[]", "[0]");
        expect(labelForWindowPath(concrete), path).toBe(field.label);
      }
    }
  });
});
