import { describe, expect, it } from "vitest";

import {
  parseShopListState,
  serializeShopListState,
  shopListStateSchema,
} from "@/lib/catalog/shop-list-state";
import { buildSearchParams, parseShopFilters } from "@/components/shop/types";
import { listStateToSearchString, parseListState } from "@/lib/list-state";

/**
 * Locked shareable query strings — before/after the list-state migration
 * these serialize identically (SEO / catalog / share links).
 */
const URL_IDENTITY_CASES: Array<{
  name: string;
  query: string;
  /** Exact serialized form after parse→serialize (defaults omitted). */
  serialized: string;
}> = [
  { name: "empty", query: "", serialized: "" },
  { name: "sort", query: "sort=newest", serialized: "sort=newest" },
  { name: "category", query: "category=bracelets", serialized: "category=bracelets" },
  { name: "collection", query: "collection=heritage", serialized: "collection=heritage" },
  { name: "tag", query: "tag=oak", serialized: "tag=oak" },
  { name: "material", query: "material=silver", serialized: "material=silver" },
  { name: "finish", query: "finish=matte", serialized: "finish=matte" },
  { name: "origin", query: "origin=pt", serialized: "origin=pt" },
  {
    name: "combined",
    query:
      "q=gold&category=rings&productType=stud&collection=heritage&tag=oak&material=silver&finish=matte&origin=pt&certified=handmade&availability=in-stock&sort=price-asc",
    serialized:
      "q=gold&availability=in-stock&category=rings&productType=stud&collection=heritage&tag=oak&material=silver&finish=matte&origin=pt&certified=handmade&sort=price-asc",
  },
  { name: "search", query: "q=pearl", serialized: "q=pearl" },
  { name: "availability", query: "availability=in-stock", serialized: "availability=in-stock" },
  { name: "featured omitted", query: "sort=featured", serialized: "" },
  { name: "invalid sort dropped", query: "sort=hacked&category=bracelets", serialized: "category=bracelets" },
  { name: "invalid availability dropped", query: "availability=out-of-stock", serialized: "" },
  { name: "legacy department ignored", query: "department=women&category=necklaces", serialized: "category=necklaces" },
];

describe("shop list-state URL snapshots", () => {
  for (const { name, query, serialized } of URL_IDENTITY_CASES) {
    it(`preserves identity for ${name}: ${query || "(empty)"}`, () => {
      const params = new URLSearchParams(query);
      const viaLegacy = parseShopFilters(params);
      const viaSchema = parseShopListState(params);
      expect(viaSchema).toEqual(viaLegacy);

      const encoded = serializeShopListState(viaSchema);
      expect(encoded).toBe(serialized);

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
