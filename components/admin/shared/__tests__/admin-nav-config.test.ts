import { describe, expect, it } from "vitest";

import {
  adminHrefMatches,
  adminHrefUnder,
  buildAdminNavItems,
  issueToNavHref,
  pageSlugFromAdminHref,
  resolveAdminNavItemSignal,
  resolveAdminNavSignal,
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

  it("builds Pages + Header & Footer trees and leaves Catalog flat", () => {
    const items = buildAdminNavItems({
      pages: [
        { slug: "home", title: "Home" },
        { slug: "about", title: "About" },
      ],
      issueCount: 3,
      syncCount: 2,
    });

    const pages = items.find((item) => item.id === "pages");
    const settings = items.find((item) => item.id === "settings");
    const catalog = items.find((item) => item.id === "products");
    const problems = items.find((item) => item.id === "issues");

    expect(pages?.children).toHaveLength(2);
    expect(pages?.children?.[0]).toMatchObject({ href: "/admin/pages/home", label: "Home" });
    expect(settings?.children?.some((child) => child.href.includes("#copy-header-main"))).toBe(
      true,
    );
    expect(catalog?.children).toBeUndefined();
    expect(problems?.badge).toEqual({ kind: "issues", count: 3 });
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
  });
});
