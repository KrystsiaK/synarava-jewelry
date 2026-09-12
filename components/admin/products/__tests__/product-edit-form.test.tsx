import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductRecord } from "@/components/admin/products/product-types";

const mocks = vi.hoisted(() => ({
  saveProductAction: vi.fn(),
  deleteProductAction: vi.fn(),
  inspectProductSyncAction: vi.fn(),
  pullSingleProductFromShopifyAction: vi.fn(),
  pushSingleProductToShopifyAction: vi.fn(),
  getShopifyCategoryAttributesAction: vi.fn(),
}));

vi.mock("@/app/admin/actions/products", () => ({
  saveProductAction: mocks.saveProductAction,
  deleteProductAction: mocks.deleteProductAction,
}));

vi.mock("@/app/admin/actions/sync", () => ({
  inspectProductSyncAction: mocks.inspectProductSyncAction,
  pullSingleProductFromShopifyAction: mocks.pullSingleProductFromShopifyAction,
  pushSingleProductToShopifyAction: mocks.pushSingleProductToShopifyAction,
}));

vi.mock("@/app/admin/actions/taxonomy", () => ({
  searchShopifyTaxonomyCategoriesAction: vi.fn().mockResolvedValue({ categories: [] }),
  getShopifyCategoryAttributesAction: mocks.getShopifyCategoryAttributesAction,
}));

import { EditProductForm } from "@/components/admin/products/product-edit-form";

function makeProduct(overrides: Partial<ProductRecord> = {}): ProductRecord {
  return {
    id: "product-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-02"),
    publishedAt: null,
    slug: "lava-ring",
    sku: "LAVA-1",
    name: "Lava Ring",
    seriesLabel: null,
    shortDescription: null,
    description: null,
    materialLine: null,
    symbolismLabel: null,
    symbolismTitle: null,
    symbolismBody: null,
    symbolismBody2: null,
    details: null,
    imageUrl: null,
    primaryAssetId: null,
    priceCents: 4500,
    status: "DRAFT",
    visibility: "PRIVATE",
    shopifyProductId: null,
    shopifyHandle: null,
    shopifyCategoryId: null,
    shopifyCategoryName: null,
    shopifyUpdatedAt: null,
    lastSyncedAt: null,
    syncStatus: "UNLINKED",
    syncError: null,
    media: [],
    characteristics: [],
    variants: [],
    collections: [],
    tags: [],
    ...overrides,
  } as ProductRecord;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getShopifyCategoryAttributesAction.mockResolvedValue({ attributes: [] });
});

describe("EditProductForm", () => {
  it("renders existing product values without checking Shopify when unlinked", async () => {
    const product = makeProduct();
    render(<EditProductForm product={product} collections={[]} />);
    await act(async () => {});

    expect(screen.getByRole("heading", { name: "Lava Ring" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toHaveValue("Lava Ring");
    expect(screen.getByLabelText(/SKU/)).toHaveValue("LAVA-1");
    expect(mocks.inspectProductSyncAction).not.toHaveBeenCalled();
  });

  it("checks Shopify sync state on mount when linked", async () => {
    mocks.inspectProductSyncAction.mockResolvedValue({
      inspection: { state: "SYNCED", remoteUpdatedAt: null, publications: [], differences: [] },
    });
    const product = makeProduct({ shopifyProductId: "gid://shopify/Product/1" });
    render(<EditProductForm product={product} collections={[]} />);

    await act(async () => {});
    expect(mocks.inspectProductSyncAction).toHaveBeenCalledWith("product-1");
  });

  it("opens the delete confirmation and calls the delete action on confirm", async () => {
    mocks.deleteProductAction.mockResolvedValue({ success: "Deleted.", deletedProductId: "product-1" });
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    render(<EditProductForm product={makeProduct()} collections={[]} onDeleted={onDeleted} />);
    await act(async () => {});

    await user.click(screen.getByRole("button", { name: "Delete product" }));
    await user.click(await screen.findByRole("button", { name: "Yes, delete permanently" }));

    expect(mocks.deleteProductAction).toHaveBeenCalledTimes(1);
    expect(onDeleted).toHaveBeenCalledWith("product-1");
  });

  it("keeps the editor available when the save action rejects", async () => {
    mocks.saveProductAction.mockRejectedValue(new Error("Database write failed"));
    const user = userEvent.setup();
    render(<EditProductForm product={makeProduct()} collections={[]} />);
    await act(async () => {});

    await user.click(screen.getAllByRole("button", { name: "Save product" })[0]);
    await user.click(await screen.findByRole("button", { name: "Yes, save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Product could not be saved. Reload this page before trying again.",
    );
    expect(screen.getByRole("heading", { name: "Lava Ring" })).toBeInTheDocument();
  });
});
