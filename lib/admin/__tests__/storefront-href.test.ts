import { describe, expect, it } from "vitest";

import {
  assembleHrefSearchResult,
  buildCustomPathHit,
  filterHitsByQuery,
  flattenHrefHits,
  formatHrefDetail,
  hasExactHrefMatch,
  hrefForCollection,
  hrefForPage,
  hrefForProduct,
  listStaticRouteHits,
  looksLikePath,
  parseHrefSearchQuery,
  hrefTargetWarning,
  statusLabelForCollection,
  statusLabelForProduct,
} from "@/lib/admin/storefront-href";

describe("storefront-href helpers", () => {
  it("maps page/product/collection slugs to locale-free paths", () => {
    expect(hrefForPage("home")).toBe("/");
    expect(hrefForPage("shop")).toBe("/shop");
    expect(hrefForPage("about")).toBe("/about");
    expect(hrefForProduct("oak-ring")).toBe("/products/oak-ring");
    expect(hrefForCollection("axis")).toBe("/collections/axis");
  });

  it("detects path-like queries for the custom segment", () => {
    expect(looksLikePath("/shop")).toBe(true);
    expect(looksLikePath("https://example.com")).toBe(true);
    expect(looksLikePath("shop")).toBe(false);
    expect(buildCustomPathHit("oak")).toBeNull();
    expect(buildCustomPathHit("/custom")).toEqual({
      id: "custom:/custom",
      segment: "custom",
      label: "Use custom path",
      href: "/custom",
      detail: "/custom",
    });
  });

  it("lists built-in routes including Home at /", () => {
    const routes = listStaticRouteHits();
    expect(routes.find((hit) => hit.label === "Home")?.href).toBe("/");
    expect(routes.find((hit) => hit.label === "Shop")?.href).toBe("/shop");
  });

  it("filters route hits by query and hides empty segments when assembling", () => {
    const routes = filterHitsByQuery(listStaticRouteHits(), "shop");
    expect(routes.every((hit) => hit.href.includes("shop") || hit.label.toLowerCase().includes("shop"))).toBe(true);

    const result = assembleHrefSearchResult({
      routes,
      pages: [],
      products: [
        {
          id: "product:1",
          segment: "products",
          label: "Oak",
          href: "/products/oak",
          detail: "/products/oak",
        },
      ],
    });

    expect(result.segments.map((segment) => segment.id)).toEqual(["routes", "products"]);
    expect(flattenHrefHits(result)).toHaveLength(routes.length + 1);
  });

  it("formats status in the detail line and recognizes exact matches", () => {
    expect(formatHrefDetail("/shop")).toBe("/shop");
    expect(formatHrefDetail("/shop", "DRAFT")).toBe("/shop · draft");
    expect(statusLabelForProduct("ACTIVE", "PUBLIC")).toBe("PUBLISHED");
    expect(statusLabelForCollection("DRAFT", "PRIVATE")).toBe("DRAFT");

    const result = assembleHrefSearchResult({
      routes: listStaticRouteHits().filter((hit) => hit.href === "/shop"),
    });
    expect(hasExactHrefMatch(result, "/shop")).toBe(true);
    expect(hasExactHrefMatch(result, "/nope")).toBe(false);
  });

  it("parses /products and /collections prefixes for drill-in search", () => {
    expect(parseHrefSearchQuery("/products")).toEqual({
      raw: "/products",
      term: "",
      scope: "products",
      browseProducts: true,
      browseCollections: false,
    });
    expect(parseHrefSearchQuery("/products/oak-ring")).toMatchObject({
      term: "oak-ring",
      scope: "products",
      browseProducts: true,
    });
    expect(parseHrefSearchQuery("/collections")).toMatchObject({
      term: "",
      browseCollections: true,
    });
    expect(parseHrefSearchQuery("/collections/axis")).toMatchObject({
      term: "axis",
      scope: "collections",
      browseCollections: true,
    });
    expect(parseHrefSearchQuery("oak")).toMatchObject({
      term: "oak",
      scope: "all",
      browseProducts: false,
    });
  });

  it("builds soft warnings for draft and unlisted targets", () => {
    expect(hrefTargetWarning("DRAFT")).toMatch(/draft/i);
    expect(hrefTargetWarning("UNLISTED")).toMatch(/unlisted/i);
    expect(hrefTargetWarning("PUBLISHED")).toBeUndefined();
    expect(hrefTargetWarning(undefined)).toBeUndefined();
  });
});
