import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin/help-docs", () => ({
  listHelpArticles: vi.fn().mockResolvedValue([
    {
      slug: "add-a-product",
      title: "Add a product",
      section: "Catalog",
      status: "draft",
      verifiedOn: null,
      updatedOn: "2026-10-23",
    },
  ]),
}));

import AdminHelpPage from "@/app/admin/(admin)/help/page";

describe("AdminHelpPage", () => {
  it("renders articles grouped by section", async () => {
    render(await AdminHelpPage());
    expect(screen.getByRole("heading", { name: "Catalog" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Add a product/i })).toHaveAttribute(
      "href",
      "/admin/help/add-a-product",
    );
  });
});
