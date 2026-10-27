import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pathnameState = vi.hoisted(() => ({ value: "/admin" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.value,
}));

import { buildAdminNavItems } from "@/components/admin/shared/admin-nav-config";
import { AdminNavTree } from "@/components/admin/shared/admin-nav-tree";

const manyPages = Array.from({ length: 12 }, (_, index) => ({
  slug: `page-${index + 1}`,
  title: `Page ${index + 1}`,
}));

describe("AdminNavTree", () => {
  beforeEach(() => {
    pathnameState.value = "/admin";
    window.history.replaceState(null, "", "/admin");
  });

  it("keeps Catalog flat and expands Pages from the route", async () => {
    const user = userEvent.setup();
    pathnameState.value = "/admin/pages/page-2";
    window.history.replaceState(null, "", "/admin/pages/page-2");

    render(
      <AdminNavTree
        items={buildAdminNavItems({ pages: manyPages })}
        syncNavHrefs={["/admin/pages/page-2"]}
      />,
    );

    expect(screen.getByRole("link", { name: /Catalog/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Expand Catalog|Collapse Catalog/ }),
    ).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Collapse Pages" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("link", { name: "Page 2" })).toHaveAttribute("data-active", "true");
    expect(
      screen.getByRole("link", { name: "Page 2" }).querySelector("[data-attention='true']"),
    ).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Expand Shared" }));
    expect(screen.getByRole("link", { name: /^Header$/ })).toBeInTheDocument();
  });

  it("reveals a deep-linked child past the Show more fold", async () => {
    pathnameState.value = "/admin/pages/page-10";
    window.history.replaceState(null, "", "/admin/pages/page-10");

    render(<AdminNavTree items={buildAdminNavItems({ pages: manyPages })} />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Page 10" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /Show \d+ more/ })).not.toBeInTheDocument();
  });

  it("opens Shared section from hash deep links", async () => {
    pathnameState.value = "/admin/settings";
    window.history.replaceState(null, "", "/admin/settings#shared-footer");

    render(<AdminNavTree items={buildAdminNavItems({ pages: [] })} />);

    expect(screen.getByRole("button", { name: "Collapse Shared" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /^Footer$/ })).toHaveAttribute(
        "data-active",
        "true",
      );
    });
  });

  it("shows amber conflict badges on Catalog", () => {
    render(
      <AdminNavTree
        items={buildAdminNavItems({
          pages: [],
          syncCounts: { products: 7, collections: 0, pages: 0, settings: 0, total: 7 },
        })}
        syncNavHrefs={["/admin/products"]}
      />,
    );

    const catalog = screen.getByRole("link", { name: /Catalog/ });
    const syncMarker = catalog.querySelector("[data-signal='sync']");
    expect(syncMarker).not.toBeNull();
    expect(syncMarker).toHaveAttribute("title", "Shopify conflicts");
    expect(
      screen.getByLabelText("7 Shopify conflicts in Catalog"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("7 Shopify conflicts to review")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Translations/ }).querySelector("[data-signal]")).toBeNull();
  });
});
