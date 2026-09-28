import { describe, expect, it } from "vitest";

import {
  adminHrefMatches,
  adminHrefUnder,
  buildAdminNavItems,
  countAdminNavSyncBySection,
  issueToNavHref,
  pageSlugFromAdminHref,
  resolveAdminNavItemSignal,
  resolveAdminNavSignal,
  syncDifferenceToNavHref,
} from "@/components/admin/shared/admin-nav-config";

describe("admin-nav-config", () => {
  it("matches path and hash for deep links", () => {
    expect(adminHrefMatches("/admin/settings", "/admin/settings#copy-header-main")).toBe(true);
    expect(
      adminHrefMatches("/admin/settings#copy-header-main", "/admin/settings#copy-footer-brand"),
    ).toBe(false);
    expect(adminHrefMatches("/admin/pages/home", "/admin/pages/home")).toBe(true);
  });

  it("detects path ancestry for expansion", () => {
    expect(adminHrefUnder("/admin/pages", "/admin/pages/home")).toBe(true);
    expect(adminHrefUnder("/admin", "/admin/pages", true)).toBe(false);
    expect(adminHrefUnder("/admin", "/admin", true)).toBe(true);
    expect(adminHrefUnder("/admin/products", "/admin/products/abc")).toBe(true);
  });

  it("maps page issues to concrete page hrefs", () => {
    expect(
      issueToNavHref({ entityType: "PAGE", targetHref: "/admin/pages/care" }),
    ).toBe("/admin/pages/care");
    expect(pageSlugFromAdminHref("/admin/pages/new")).toBeNull();
    expect(pageSlugFromAdminHref("/en/home")).toBe("home");
  });

  it("builds Pages + Shared trees and leaves Catalog flat", () => {
    const items = buildAdminNavItems({
      pages: [
        { slug: "home", title: "Home" },
        { slug: "about", title: "About" },
      ],
      issueCount: 3,
      syncCounts: {
        products: 5,
        collections: 1,
        pages: 2,
        settings: 1,
        total: 9,
      },
    });

    const pages = items.find((item) => item.id === "pages");
    const settings = items.find((item) => item.id === "settings");
    const commerce = items.find((item) => item.id === "commerce");
    const catalog = items.find((item) => item.id === "products");
    const collections = items.find((item) => item.id === "collections");
    const problems = items.find((item) => item.id === "issues");
    const localization = items.find((item) => item.id === "translations");
    const infrastructure = items.find((item) => item.id === "infrastructure");

    expect(pages?.children).toHaveLength(2);
    expect(pages?.children?.[0]).toMatchObject({ href: "/admin/pages/home", label: "Home" });
    expect(pages?.badge).toEqual({ kind: "sync", count: 2 });
    expect(settings?.children?.map((child) => child.label)).toEqual([
      "Header",
      "Footer",
      "Cookies",
      "Contact",
      "Reviews",
    ]);
    expect(settings?.badge).toEqual({ kind: "sync", count: 1 });
    expect(commerce).toMatchObject({ href: "/admin/commerce", label: "Cart & account", code: "BAG" });
    const customerAccount = items.find((item) => item.id === "customer-account");
    expect(customerAccount).toMatchObject({ href: "/admin/customer-account", label: "Customer account", code: "CUS" });
    expect(customerAccount?.children?.map((child) => child.label)).toEqual([
      "Frame",
      "Overview",
      "Wishlist",
      "Orders",
      "Reviews",
      "Addresses",
      "Sign-in",
      "Returns",
    ]);
    expect(commerce?.children?.some((child) => child.href.includes("#commerce-cart"))).toBe(true);
    expect(commerce?.badge).toBeUndefined();
    expect(catalog?.children).toBeUndefined();
    expect(catalog?.badge).toEqual({ kind: "sync", count: 5 });
    expect(collections?.badge).toEqual({ kind: "sync", count: 1 });
    expect(problems?.badge).toEqual({ kind: "issues", count: 3 });
    expect(localization?.badge).toEqual({ kind: "sync", count: 9 });
    expect(infrastructure).toMatchObject({ href: "/admin/infrastructure", label: "Infrastructure" });
  });

  it("falls back to syncCount total when syncCounts is omitted", () => {
    const items = buildAdminNavItems({ syncCount: 4 });
    expect(items.find((item) => item.id === "translations")?.badge).toEqual({
      kind: "sync",
      count: 4,
    });
    expect(items.find((item) => item.id === "products")?.badge).toBeUndefined();
  });

  it("tallies sync differences per sidebar section", () => {
    expect(
      countAdminNavSyncBySection([
        { rootEntityType: "PRODUCT" },
        { rootEntityType: "PRODUCT" },
        { rootEntityType: "COLLECTION" },
        { rootEntityType: "PAGE" },
        { rootEntityType: "STOREFRONT_COPY" },
      ]),
    ).toEqual({
      products: 2,
      collections: 1,
      pages: 1,
      settings: 1,
      total: 5,
    });
  });

  it("maps sync differences to nav hrefs", () => {
    const pages = new Map([["page-1", "care"]]);
    expect(
      syncDifferenceToNavHref({ rootEntityType: "PRODUCT", rootEntityId: "p1" }, pages),
    ).toBe("/admin/products");
    expect(
      syncDifferenceToNavHref({ rootEntityType: "PAGE", rootEntityId: "page-1" }, pages),
    ).toBe("/admin/pages/care");
    expect(
      syncDifferenceToNavHref({ rootEntityType: "PAGE", rootEntityId: "missing" }, pages),
    ).toBe("/admin/pages");
  });

  it("bubbles child sync/issue signals to the parent", () => {
    const items = buildAdminNavItems({
      pages: [{ slug: "care", title: "Care" }],
    });
    const pages = items.find((item) => item.id === "pages")!;
    const issueHrefs = new Set(["/admin/pages/care"]);
    const syncHrefs = new Set<string>();

    expect(resolveAdminNavSignal("/admin/pages/care", issueHrefs, syncHrefs)).toBe("issue");
    expect(resolveAdminNavItemSignal(pages, issueHrefs, syncHrefs)).toBe("issue");
    expect(
      resolveAdminNavItemSignal(
        pages,
        new Set(),
        new Set(["/admin/pages/care"]),
      ),
    ).toBe("sync");
    expect(
      resolveAdminNavItemSignal(
        pages,
        new Set(["/admin/pages/care"]),
        new Set(["/admin/pages/care"]),
      ),
    ).toBe("both");
  });
});
