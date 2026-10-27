import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * STRUCTURAL: Admin API 2026-07 collection mutation shape.
 * - collectionUpdate / collectionCreate use `collection:` (not deprecated `input:`).
 * - Exactly one production mutation string may call collectionUpdate(collection:).
 * - collectionAddProducts / V2 must not appear (migrated to source deltas).
 * - collectionRemoveProducts only in the final-source stopgap (collection-sync.ts).
 *
 * @see https://shopify.dev/docs/apps/build/product-merchandising/products-and-collections/migrate-to-flexible-collections
 */

const root = process.cwd();
const HELPER = "lib/shopify/collection-update.ts";
const REMOVE_STOPGAP = "lib/shopify/collection-sync.ts";
const UPDATE_INLINE = "collectionUpdate(collection:";
const UPDATE_LEGACY = "collectionUpdate(input:";
const CREATE_LEGACY = "collectionCreate(input:";
/** GraphQL call sites only — comments / error copy may name the mutations. */
const ADD_PRODUCTS = "collectionAddProducts(";
const ADD_PRODUCTS_V2 = "collectionAddProductsV2(";
const REMOVE_PRODUCTS = "collectionRemoveProducts(";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "__tests__") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(name) && !name.includes(".test.")) out.push(full);
  }
  return out;
}

describe("collection mutation API shape guard (2026-07)", () => {
  it("forbids legacy input:/AddProducts and pins Update + RemoveProducts hosts", () => {
    const files = [...walk(join(root, "lib")), ...walk(join(root, "app"))];
    const updateLegacyHits: string[] = [];
    const createLegacyHits: string[] = [];
    const updateInlineHosts: string[] = [];
    const addProductsHits: string[] = [];
    const removeProductsHosts: string[] = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const rel = relative(root, file);
      if (src.includes(UPDATE_LEGACY)) updateLegacyHits.push(rel);
      if (src.includes(CREATE_LEGACY)) createLegacyHits.push(rel);
      if (src.includes(UPDATE_INLINE)) updateInlineHosts.push(rel);
      if (src.includes(ADD_PRODUCTS) || src.includes(ADD_PRODUCTS_V2)) {
        addProductsHits.push(rel);
      }
      if (src.includes(REMOVE_PRODUCTS)) removeProductsHosts.push(rel);
    }

    expect(
      updateLegacyHits,
      `legacy collectionUpdate(input:) in: ${updateLegacyHits.join(", ")}`,
    ).toEqual([]);
    expect(
      createLegacyHits,
      `legacy collectionCreate(input:) in: ${createLegacyHits.join(", ")}`,
    ).toEqual([]);
    expect(updateInlineHosts).toEqual([HELPER]);
    expect(
      addProductsHits,
      `deprecated collectionAddProducts in: ${addProductsHits.join(", ")}`,
    ).toEqual([]);
    expect(
      removeProductsHosts,
      `collectionRemoveProducts hosts: ${removeProductsHosts.join(", ")}`,
    ).toEqual([REMOVE_STOPGAP]);
  });
});
