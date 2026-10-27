import { describe, expect, it } from "vitest";

import {
  parseShopListState,
  serializeShopListState,
  shopListStateSchema,
} from "@/lib/catalog/shop-list-state";
import { buildSearchParams, parseShopFilters } from "@/components/shop/types";
import { listStateToSearchString, parseListState } from "@/lib/list-state";

/**
 * Snapshot of storefront query strings that must stay identical after the
 * list-state migration (SEO / shareable URLs / catalog results).
 */
const URL_SNAPSHOTS: Array<{ name: string; query: string }> = [
  { name: "empty", query: "" },
  { name: "search", query: "q=pearl" },
  { name: "category", query: "category=bracelets" },
  { name: "availability", query: "availability=in-stock" },
  { name: "sort newest", query: "sort=newest" },
  { name: "featured omitted", query: "sort=featured" },
  { name: "combo", query: "q=gold&category=rings&productType=stud&collection=heritage&tag=oak&material=silver&finish=matte&origin=pt&certified=handmade&availability=in-stock&sort=price-asc" },
  { name: "invalid sort dropped", query: "sort=hacked&category=bracelets" },
  { name: "invalid availability dropped", query: "availability=out-of-stock" },
  { name: "legacy department ignored", query: "department=women&category=necklaces" },
];

describe("shop list-state URL snapshots", () => {
  for (const { name, query } of URL_SNAPSHOTS) {
    it(`preserves identity for ${name}: ${query || "(empty)"}`, () => {
      const params = new URLSearchParams(query);
      const viaLegacy = parseShopFilters(params);
      const viaSchema = parseShopListState(params);
      expect(viaSchema).toEqual(viaLegacy);

      const encoded = serializeShopListState(viaSchema);
      const reparsed = parseShopListState(new URLSearchParams(encoded));
      expect(reparsed).toEqual(viaSchema);

      // Featured never appears in the shareable string.
      expect(encoded.includes("sort=featured")).toBe(false);
      expect(encoded.includes("department=")).toBe(false);
    });
  }

  it("matches buildSearchParams wrapper", () => {
    const state = parseShopListState({
      q: "oak",
      category: "bracelets",
      sort: "name-asc",
    });
    expect(buildSearchParams(state)).toBe(serializeShopListState(state));
    expect(buildSearchParams(state)).toBe(
      listStateToSearchString(shopListStateSchema, state),
    );
  });

  it("SSR record parse equals client URLSearchParams parse", () => {
    const query = "q=silver&sort=newest&availability=in-stock";
    const params = new URLSearchParams(query);
    const record: Record<string, string> = {};
    params.forEach((value, key) => {
      record[key] = value;
    });
    expect(parseListState(shopListStateSchema, record)).toEqual(
      parseListState(shopListStateSchema, params),
    );
  });
});
