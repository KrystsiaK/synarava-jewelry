import { describe, expect, it } from "vitest";

import {
  adminHrefMatches,
  adminHrefUnder,
  buildAdminNavItems,
  pageSlugFromAdminHref,
  resolveAdminNavItemSignal,
  resolveAdminNavSignal,
  syncDifferenceToNavHref,
} from "@/components/admin/shared/admin-nav-config";
import { countAdminNavSyncBySection } from "@/lib/sync/nav-counts";

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

  it("reads page slugs from admin hrefs", () => {
    expect(pageSlugFromAdminHref("/admin/pages/care")).toBe("care");
    expect(pageSlugFromAdminHref("/admin/pages/new")).toBeNull();
    expect(pageSlugFromAdminHref("/en/home")).toBe("home");
  });

  it("builds Pages + Shared trees and leaves Catalog flat", () => {
    const items = buildAdminNavItems({
      pages: [
        { slug: "home", title: "Home" },
        { slug: "about", title: "About" },
      ],
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
    const translations = items.find((item) => item.id === "translations");
    const infrastructure = items.find((item) => item.id === "infrastructure");
    const help = items.find((item) => item.id === "help");

    expect(pages?.children).toHaveLength(2);
    expect(pages?.children?.[0]).toMatchObject({ href: "/admin/pages/home", label: "Home" });
    expect(pages?.badge).toEqual({ kind: "sync", count: 2 });
    expect(settings?.children?.map((child) => child.label)).toEqual([
      "Header",
      "Footer",
      "Home",
      "Cookies",
      "Contact",
      "Reviews",
      "Taxonomy",
      "SKU policy",
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
    expect(problems).toBeUndefined();
    expect(translations).toMatchObject({ label: "Translations", badge: { kind: "sync", count: 9 } });
    expect(infrastructure).toMatchObject({ href: "/admin/infrastructure", label: "Infrastructure" });
    expect(help).toMatchObject({ href: "/admin/help", label: "Help", code: "HELP" });
    expect(items.at(-1)?.id).toBe("help");
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

  it("bubbles child sync signals to the parent", () => {
    const items = buildAdminNavItems({
      pages: [{ slug: "care", title: "Care" }],
    });
    const pages = items.find((item) => item.id === "pages")!;
    const syncHrefs = new Set(["/admin/pages/care"]);

    expect(resolveAdminNavSignal("/admin/pages/care", syncHrefs)).toBe("sync");
    expect(resolveAdminNavItemSignal(pages, syncHrefs)).toBe("sync");
    expect(resolveAdminNavItemSignal(pages, new Set())).toBeUndefined();
  });
});
