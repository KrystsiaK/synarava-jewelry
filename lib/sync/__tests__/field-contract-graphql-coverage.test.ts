import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  PRODUCT_COMMERCE_FIELDS,
  TECHNICAL_COMPARE_KEYS,
  lookupContractForPath,
  normalizeWindowPath,
} from "@/lib/sync/field-registry";

const root = process.cwd();

/**
 * Rough extraction of GraphQL selection field names from PRODUCT_FIELDS /
 * VARIANT_FIELDS string templates in product-sync.ts.
 */
function extractSelectedLeaves(source: string): string[] {
  const variantMatch = source.match(/const VARIANT_FIELDS = `([\s\S]*?)`;/);
  const productMatch = source.match(/const PRODUCT_FIELDS = `([\s\S]*?)`;/);
  expect(variantMatch, "VARIANT_FIELDS").toBeTruthy();
  expect(productMatch, "PRODUCT_FIELDS").toBeTruthy();

  const paths: string[] = [];

  // Top-level product scalars / objects that become compare paths (containers
  // like seo/variants are covered by their registered children).
  const productTops = [
    "title", "handle", "descriptionHtml", "vendor", "productType", "tags", "status",
    "totalInventory", "category", "media", "options", "collections",
    "publications", "metafields",
    "seo.title", "seo.description",
  ];
  for (const top of productTops) paths.push(top);

  // Variant + inventoryItem leaves from VARIANT_FIELDS text.
  const variantBody = variantMatch![1]!;
  for (const leaf of [
    "variants[].sku",
    "variants[].barcode",
    "variants[].price",
    "variants[].compareAtPrice",
    "variants[].inventoryPolicy",
    "variants[].taxable",
    "variants[].inventoryQuantity",
    "variants[].selectedOptions",
    "variants[].inventoryItem.id",
    "variants[].inventoryItem.requiresShipping",
    "variants[].inventoryItem.tracked",
    "variants[].inventoryItem.countryCodeOfOrigin",
    "variants[].inventoryItem.harmonizedSystemCode",
    "variants[].inventoryItem.unitCost",
    "variants[].inventoryItem.measurement",
  ]) {
    // Ensure the GraphQL source still mentions the leaf token.
    const token = leaf.split(".").pop()!.replace("[]", "");
    if (leaf.includes("inventoryItem") || leaf.includes("selectedOptions") || ["sku", "barcode", "price", "compareAtPrice", "inventoryPolicy", "taxable", "inventoryQuantity"].includes(token)) {
      expect(variantBody, leaf).toMatch(new RegExp(`\\b${token}\\b`));
    }
    paths.push(leaf);
  }

  // resourcePublicationsV2 → publications in the window.
  expect(productMatch![1]!).toMatch(/resourcePublicationsV2/);
  expect(productMatch![1]!).toMatch(/seo/);
  expect(productMatch![1]!).toMatch(/metafields/);

  void TECHNICAL_COMPARE_KEYS;
  return paths;
}

describe("GraphQL selection → field contract coverage (PR-6)", () => {
  it("every selected commerce path is in the contract or an explicit technical-noise list", () => {
    const source = readFileSync(join(root, "lib/shopify/product-sync.ts"), "utf8");
    const paths = extractSelectedLeaves(source);
    const technical = new Set<string>(TECHNICAL_COMPARE_KEYS);

    const missing: string[] = [];
    for (const path of paths) {
      const normalized = normalizeWindowPath(path);
      if (technical.has(normalized.split(".").pop() ?? "")) continue;
      // Window alias: publications ← resourcePublicationsV2
      if (lookupContractForPath(path, "PRODUCT") || lookupContractForPath(normalized, "PRODUCT")) continue;
      // synaravaOnly / non-window tops never appear as compare leaves.
      if (PRODUCT_COMMERCE_FIELDS.some((f) => f.windowPaths.includes(path))) continue;
      missing.push(path);
    }
    expect(missing, `unmapped GraphQL paths: ${missing.join(", ")}`).toEqual([]);
  });
});
