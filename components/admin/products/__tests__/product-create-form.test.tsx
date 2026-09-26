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

vi.mock("@/app/admin/actions/product-organization", () => ({
  listShopifyProductOrganizationAction: vi.fn().mockResolvedValue({ options: [] }),
}));

import { CreateProductForm } from "@/components/admin/products/product-create-form";
import type { CollectionOption } from "@/components/admin/products/product-types";

const collections: CollectionOption[] = [
  {
    id: "col-1",
    slug: "lava-collection",
    name: "Lava Collection",
    isStorefrontDefault: false,
    shopifyCollectionId: null,
    status: "ACTIVE",
    visibility: "PUBLIC",
  },
  {
    id: "col-2",
    slug: "featured",
    name: "Featured",
    isStorefrontDefault: true,
    shopifyCollectionId: null,
    status: "ACTIVE",
    visibility: "PUBLIC",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.autosaveProductDraftAction.mockResolvedValue({});
  mocks.getShopifyCategoryAttributesAction.mockResolvedValue({ attributes: [] });
  // The active-locale tab is remembered in sessionStorage per product sku
  // (all create-form tests share the "new" key), so tests would otherwise
  // leak their tab state across `it()` blocks.
  sessionStorage.clear();
});

describe("CreateProductForm", () => {
  it("renders the core Shopify-backed fields and the gallery manager", async () => {
    const user = userEvent.setup();
    render(<CreateProductForm collections={collections} />);

    expect(screen.getByRole("heading", { name: "Build the product one area at a time" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Title \* Shopify/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Slug/)).toBeInTheDocument();
    expect(screen.getByLabelText(/SKU/)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Price Sell/i }));
    expect(screen.getByRole("spinbutton", { name: /Price/ })).toBeInTheDocument();
    expect(screen.getByText("Compare-at price")).toBeInTheDocument();
    expect(screen.getByText("Cost")).toBeInTheDocument();
    expect(screen.getAllByText("Not set").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole("spinbutton", { name: /Compare-at price/ })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Charge tax on this product/ })).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: /^Cost/ })).not.toBeInTheDocument();
    expect(screen.getByText("Product gallery")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Catalog/ }));
    expect(screen.getByRole("option", { name: "Lava Collection" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Featured" })).not.toBeInTheDocument();
    await act(async () => {});
  });

  it("keeps draft collections in the Collection select with a Draft label", async () => {
    const user = userEvent.setup();
    render(
      <CreateProductForm
        collections={[
          ...collections,
          {
            id: "col-draft",
            slug: "obsidian",
            name: "Obsidian",
            isStorefrontDefault: false,
            shopifyCollectionId: null,
            status: "DRAFT",
            visibility: "PRIVATE",
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("tab", { name: /Catalog/ }));
    expect(screen.getByRole("option", { name: "Obsidian (Draft)" })).toBeInTheDocument();
    await act(async () => {});
  });

  it("provides real English and Portuguese product copy tabs", async () => {
    const user = userEvent.setup();
    render(<CreateProductForm collections={collections} />);

    // One shared locale strip for the whole product workspace.
    expect(screen.getByRole("tab", { name: "English" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Português" }));

    expect(screen.getByRole("tab", { name: "Português" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Product name (Português)")).toBeInTheDocument();
    expect(screen.getByLabelText("Português translation reviewed")).toBeInTheDocument();
  });

  it("opens the confirmation modal after filling required fields and saves on confirm", async () => {
    mocks.saveProductAction.mockResolvedValue({ success: "Product saved.", created: true, product: undefined });
    const user = userEvent.setup();
    render(<CreateProductForm collections={collections} />);
    await act(async () => {});

    await user.type(screen.getByRole("textbox", { name: /Title \* Shopify/ }), "Lava Ring");
    await user.type(screen.getByLabelText(/Slug/), "lava-ring");
    await user.type(screen.getByLabelText(/SKU/), "LAVA-1");
    await user.click(screen.getByRole("tab", { name: /Price Sell/i }));
    await user.type(screen.getByRole("spinbutton", { name: /Price/ }), "45.00");

    await user.click(screen.getAllByRole("button", { name: "Save product" })[0]);
    await user.click(await screen.findByRole("button", { name: "Continue and save" }));

    expect(mocks.saveProductAction).toHaveBeenCalledTimes(1);
  }, 15_000);

  it("keeps the create form available when the save action rejects", async () => {
    mocks.saveProductAction.mockRejectedValue(new Error("Database write failed"));
    const user = userEvent.setup();
    render(<CreateProductForm collections={collections} />);
    await act(async () => {});

    await user.type(screen.getByRole("textbox", { name: /Title \* Shopify/ }), "Lava Ring");
    await user.type(screen.getByLabelText(/Slug/), "lava-ring");
    await user.type(screen.getByLabelText(/SKU/), "LAVA-1");
    await user.click(screen.getByRole("tab", { name: /Price Sell/i }));
    await user.type(screen.getByRole("spinbutton", { name: /Price/ }), "45.00");
    await user.click(screen.getAllByRole("button", { name: "Save product" })[0]);
    await user.click(await screen.findByRole("button", { name: "Continue and save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Product could not be saved. Reload this page before trying again.",
    );
    expect(screen.getByRole("heading", { name: "Build the product one area at a time", level: 2 })).toBeInTheDocument();
  }, 15_000);
});
