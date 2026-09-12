import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  autosaveProductDraftAction: vi.fn(),
  saveProductAction: vi.fn(),
  getShopifyCategoryAttributesAction: vi.fn(),
}));

vi.mock("@/app/admin/actions/products", () => ({
  autosaveProductDraftAction: mocks.autosaveProductDraftAction,
  saveProductAction: mocks.saveProductAction,
}));

vi.mock("@/app/admin/actions/taxonomy", () => ({
  searchShopifyTaxonomyCategoriesAction: vi.fn().mockResolvedValue({ categories: [] }),
  getShopifyCategoryAttributesAction: mocks.getShopifyCategoryAttributesAction,
}));

import { CreateProductForm } from "@/components/admin/products/product-create-form";
import type { CollectionOption } from "@/components/admin/products/product-types";

const collections: CollectionOption[] = [
  { id: "col-1", slug: "lava-collection", name: "Lava Collection", isPrimaryNav: false, navSortOrder: 0 },
  { id: "col-2", slug: "jewelry", name: "Jewelry", isPrimaryNav: true, navSortOrder: 0 },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.autosaveProductDraftAction.mockResolvedValue({});
  mocks.getShopifyCategoryAttributesAction.mockResolvedValue({ attributes: [] });
});

describe("CreateProductForm", () => {
  it("renders the core Shopify-backed fields and the gallery manager", async () => {
    render(<CreateProductForm collections={collections} />);

    expect(screen.getByRole("heading", { name: "Create product" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Slug/)).toBeInTheDocument();
    expect(screen.getByLabelText(/SKU/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Price EUR/)).toBeInTheDocument();
    expect(screen.getByText("Product gallery")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Lava Collection" })).toBeInTheDocument();
    await act(async () => {});
  });

  it("only offers primary-nav collections in the department select", async () => {
    render(<CreateProductForm collections={collections} />);

    const departmentSelect = screen.getByLabelText("Department");
    expect(departmentSelect).toHaveTextContent("Jewelry");
    expect(departmentSelect).not.toHaveTextContent("Lava Collection");
    await act(async () => {});
  });

  it("provides real English and Portuguese product copy tabs", async () => {
    const user = userEvent.setup();
    render(<CreateProductForm collections={collections} />);

    expect(screen.getByRole("tab", { name: "English" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Português" }));

    expect(screen.getByRole("tab", { name: "Português" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Product name (PT)")).toBeInTheDocument();
    expect(screen.getByLabelText("Portuguese translation reviewed")).toBeInTheDocument();
  });

  it("opens the confirmation modal after filling required fields and saves on confirm", async () => {
    mocks.saveProductAction.mockResolvedValue({ success: "Product saved.", created: true, product: undefined });
    const user = userEvent.setup();
    render(<CreateProductForm collections={collections} />);
    await act(async () => {});

    await user.type(screen.getByLabelText(/Name/), "Lava Ring");
    await user.type(screen.getByLabelText(/Slug/), "lava-ring");
    await user.type(screen.getByLabelText(/SKU/), "LAVA-1");
    await user.type(screen.getByLabelText(/Price EUR/), "45.00");

    await user.click(screen.getAllByRole("button", { name: "Save product" })[0]);
    await user.click(await screen.findByRole("button", { name: "Continue and save" }));

    expect(mocks.saveProductAction).toHaveBeenCalledTimes(1);
  });

  it("keeps the create form available when the save action rejects", async () => {
    mocks.saveProductAction.mockRejectedValue(new Error("Database write failed"));
    const user = userEvent.setup();
    render(<CreateProductForm collections={collections} />);
    await act(async () => {});

    await user.type(screen.getByLabelText(/Name/), "Lava Ring");
    await user.type(screen.getByLabelText(/Slug/), "lava-ring");
    await user.type(screen.getByLabelText(/SKU/), "LAVA-1");
    await user.type(screen.getByLabelText(/Price EUR/), "45.00");
    await user.click(screen.getAllByRole("button", { name: "Save product" })[0]);
    await user.click(await screen.findByRole("button", { name: "Continue and save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Product could not be saved. Reload this page before trying again.",
    );
    expect(screen.getByRole("heading", { name: "Create product", level: 2 })).toBeInTheDocument();
  });
});
