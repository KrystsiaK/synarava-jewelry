import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductRecord } from "@/components/admin/products/product-types";

const mocks = vi.hoisted(() => ({
  saveProductAction: vi.fn(),
  deleteProductAction: vi.fn(),
  getSavedProductPayload: vi.fn(),
  inspectProductSyncAction: vi.fn(),
  pullSingleProductFromShopifyAction: vi.fn(),
  pushSingleProductToShopifyAction: vi.fn(),
  checkProductConflictsAction: vi.fn(),
  getShopifyCategoryAttributesAction: vi.fn(),
  buildOurCommerceStoreAction: vi.fn(),
  fetchShopifyCommerceStoreAction: vi.fn(),
  compareAndPersistCommerceStoresAction: vi.fn(),
  listCustomProductMetafieldDefinitionsAction: vi.fn(),
  createProductMetafieldDefinitionAction: vi.fn(),
}));

vi.mock("@/app/admin/actions/products", () => ({
  saveProductAction: mocks.saveProductAction,
  deleteProductAction: mocks.deleteProductAction,
  getSavedProductPayload: mocks.getSavedProductPayload,
}));

vi.mock("@/app/admin/actions/sync", () => ({
  inspectProductSyncAction: mocks.inspectProductSyncAction,
  pullSingleProductFromShopifyAction: mocks.pullSingleProductFromShopifyAction,
  pushSingleProductToShopifyAction: mocks.pushSingleProductToShopifyAction,
  checkProductConflictsAction: mocks.checkProductConflictsAction,
  buildOurCommerceStoreAction: mocks.buildOurCommerceStoreAction,
  fetchShopifyCommerceStoreAction: mocks.fetchShopifyCommerceStoreAction,
  compareAndPersistCommerceStoresAction: mocks.compareAndPersistCommerceStoresAction,
  listCustomProductMetafieldDefinitionsAction: mocks.listCustomProductMetafieldDefinitionsAction,
  createProductMetafieldDefinitionAction: mocks.createProductMetafieldDefinitionAction,
}));

vi.mock("@/app/admin/actions/taxonomy", () => ({
  searchShopifyTaxonomyCategoriesAction: vi.fn().mockResolvedValue({ categories: [] }),
  getShopifyCategoryAttributesAction: mocks.getShopifyCategoryAttributesAction,
}));

vi.mock("@/app/admin/actions/product-organization", () => ({
  listShopifyProductOrganizationAction: vi.fn().mockResolvedValue({ options: [] }),
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
    shopifySnapshot: null,
    workingSnapshot: null,
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
  mocks.checkProductConflictsAction.mockResolvedValue({
    signals: { state: "ready", totalCount: 0, checkedAt: null, products: {}, recentlyUpdatedProducts: {} },
    success: "Conflict check complete. No conflicts found.",
  });
  mocks.buildOurCommerceStoreAction.mockResolvedValue({ our: { version: 1, products: {} } });
  mocks.fetchShopifyCommerceStoreAction.mockResolvedValue({ shopify: { version: 1, products: {} } });
  mocks.compareAndPersistCommerceStoresAction.mockResolvedValue({
    conflicts: [],
    debug: { ourProductCount: 0, shopifyProductCount: 0, conflictCount: 0 },
  });
  mocks.listCustomProductMetafieldDefinitionsAction.mockResolvedValue({ definitions: [] });
  mocks.createProductMetafieldDefinitionAction.mockResolvedValue({ success: "Created." });
  // The active-locale tab is remembered in sessionStorage per product sku, so
  // tests sharing a sku (they all use "LAVA-1") would otherwise leak their
  // tab state across `it()` blocks.
  sessionStorage.clear();
});

describe("EditProductForm", () => {
  it("renders existing product values without checking Shopify when unlinked", async () => {
    const product = makeProduct();
    render(<EditProductForm product={product} collections={[]} />);
    await act(async () => {});

    expect(screen.getByRole("heading", { name: "Choose an area to edit" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Title \* Shopify/ })).toHaveValue("Lava Ring");
    expect(screen.getByLabelText(/SKU/)).not.toBeVisible();
    expect(mocks.inspectProductSyncAction).not.toHaveBeenCalled();
  });

  it("shows SKU and inventory location table on the Inventory tab", async () => {
    mocks.inspectProductSyncAction.mockResolvedValue({
      inspection: { state: "SYNCED", remoteUpdatedAt: null, publications: [], differences: [] },
    });
    const user = userEvent.setup();
    render(<EditProductForm product={makeProduct({
      shopifyProductId: "gid://shopify/Product/1",
      variants: [{ id: "variant-1", shopifyVariantId: "gid://shopify/ProductVariant/1", title: "Default Title", sku: "LAVA-1", barcode: null, priceCents: 4500, compareAtCents: null, costCents: null, stockOnHand: 1, weightGrams: 22, taxable: true, requiresShipping: true, tracked: true, selectedOptions: [], shopifyInventoryItemId: null, imageUrl: null } as ProductRecord["variants"][number]],
      shopifySnapshot: {
        variants: [{ id: "gid://shopify/ProductVariant/1", inventoryPolicy: "DENY", inventoryItem: { inventoryLevels: [{ location: { id: "gid://shopify/Location/1", name: "Shop location" }, quantities: [{ name: "available", quantity: 2 }, { name: "committed", quantity: 0 }, { name: "on_hand", quantity: 2 }] }] } }],
      },
    })} collections={[]} />);
    await act(async () => {});

    await user.click(screen.getByRole("tab", { name: /Inventory/ }));
    expect(screen.getByLabelText(/^SKU/)).toBeVisible();
    expect(screen.getByRole("spinbutton", { name: /Available quantity/ })).toBeVisible();
    expect(screen.getAllByText("Shop location").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Shipping" })).toBeInTheDocument();
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

  it("shows editable Shopify fields and the pulled metafields", async () => {
    mocks.inspectProductSyncAction.mockResolvedValue({
      inspection: { state: "SYNCED", remoteUpdatedAt: null, publications: [], differences: [] },
    });
    render(<EditProductForm product={makeProduct({
      shopifyProductId: "gid://shopify/Product/1",
      vendor: "Synarava",
      productType: "Necklace",
      variants: [{ id: "variant-1", shopifyVariantId: "gid://shopify/ProductVariant/1", title: "Default Title", sku: "LAVA-1", barcode: null, priceCents: 4500, compareAtCents: null, costCents: null, stockOnHand: 1, weightGrams: 22, taxable: true, requiresShipping: true, tracked: true, selectedOptions: [] } as ProductRecord["variants"][number]],
      shopifySnapshot: {
        metafields: [{ namespace: "custom", key: "pearl_grade", type: "single_line_text_field", value: "AAA" }],
        variants: [{ id: "gid://shopify/ProductVariant/1", inventoryItem: { inventoryLevels: [{ location: { id: "gid://shopify/Location/1" }, quantities: [{ name: "available", quantity: 1 }, { name: "committed", quantity: 0 }, { name: "on_hand", quantity: 1 }] }] } }],
      },
    })} collections={[]} />);

    expect(screen.getByLabelText(/^Vendor/)).toHaveValue("Synarava");
    expect(screen.getByLabelText(/Product type/)).toHaveValue("Necklace");
    expect(screen.getAllByText("custom.pearl_grade").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("AAA").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Inventory by location").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Location 1").length).toBeGreaterThanOrEqual(1);
    await act(async () => {});
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

  it("reopens the EN tab and blocks the confirm dialog when a required EN field is blank while PT is active", async () => {
    const user = userEvent.setup();
    render(<EditProductForm product={makeProduct()} collections={[]} />);
    await act(async () => {});

    await user.clear(screen.getByRole("textbox", { name: /Title \* Shopify/ }));
    await user.click(screen.getByRole("tab", { name: "Português" }));
    expect(screen.getByRole("textbox", { name: /Title \* Shopify/, hidden: true })).not.toBeVisible();

    await user.click(screen.getAllByRole("button", { name: "Save product" })[0]);

    // Client-side validate() catches the blank required Title even while its
    // panel is hidden (jsdom, like real browsers, computes `validity` from
    // the constraint itself, not from whether the field is rendered) — so
    // the confirm dialog never opens...
    expect(screen.queryByRole("button", { name: "Yes, save changes" })).not.toBeInTheDocument();
    expect(mocks.saveProductAction).not.toHaveBeenCalled();
    // ...and the EN tab reopens so the user can actually see the error
    // instead of being stuck looking at the PT panel.
    expect(await screen.findByRole("textbox", { name: /Title \* Shopify/ })).toBeVisible();
  });

  it("keeps shared Vendor and Product type visible on the PT tab", async () => {
    const user = userEvent.setup();
    render(<EditProductForm product={makeProduct({ vendor: "Synarava", productType: "Necklace" })} collections={[]} />);
    await act(async () => {});

    expect(screen.getByLabelText(/^Vendor/)).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Português" }));
    expect(screen.getByLabelText(/^Vendor/)).toBeVisible();
    expect(screen.getByLabelText(/Product type/)).toBeVisible();
  });

  it("switches the same Short description field's value with the locale tab", async () => {
    const user = userEvent.setup();
    const product = makeProduct({
      shortDescription: "A refined piece.",
      translations: [{
        id: "translation-pt", locale: "pt", title: "Anel de Lava", localizedHandle: null,
        shortDescription: "Uma peça refinada.", description: null, materialLine: null,
        symbolismLabel: null, symbolismTitle: null, symbolismBody: null, symbolismBody2: null,
        details: null, seoTitle: null, seoDescription: null, reviewStatus: "DRAFT", reviewedAt: null,
        syncStatus: "PENDING", syncError: null, contentHash: null, lastSyncedAt: null,
        createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"), productId: "product-1",
      }],
    });
    render(<EditProductForm product={product} collections={[]} />);
    await act(async () => {});

    await user.click(screen.getByRole("tab", { name: /Product page/i }));
    expect(screen.getByText("A refined piece.")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Português" }));
    expect(screen.getByText("Uma peça refinada.")).toBeInTheDocument();
    expect(screen.queryByText("A refined piece.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "English" }));
    expect(screen.getByText("A refined piece.")).toBeInTheDocument();
  });

  it("keeps locale tabs above section tabs and always visible", async () => {
    render(<EditProductForm product={makeProduct({ shopifyProductId: "gid://shopify/Product/1" })} collections={[]} />);
    await act(async () => {});

    expect(screen.getByRole("tablist", { name: "Content language" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "English" })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Product editor sections" })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /Passport/ }));
    expect(screen.getByRole("tablist", { name: "Content language" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Português" })).toBeInTheDocument();
  });

  it("shows the legacy cover image on Media when the gallery is empty", async () => {
    const user = userEvent.setup();
    render(<EditProductForm product={makeProduct({ imageUrl: "/media/lava.jpg", media: [] })} collections={[]} />);
    await act(async () => {});

    await user.click(screen.getByRole("tab", { name: /Media/ }));
    expect(screen.getByAltText("Lava Ring")).toHaveAttribute("src", expect.stringContaining("lava.jpg"));
    expect(screen.getByText(/Legacy cover image/i)).toBeInTheDocument();
  });

  it("marks a section dirty when edited while linked", async () => {
    mocks.inspectProductSyncAction.mockResolvedValue({
      inspection: { state: "SYNCED", remoteUpdatedAt: null, publications: [], differences: [] },
    });
    const user = userEvent.setup();
    render(<EditProductForm product={makeProduct({ shopifyProductId: "gid://shopify/Product/1" })} collections={[]} />);
    await act(async () => {});

    await user.type(screen.getByRole("textbox", { name: /Title \* Shopify/ }), " Updated");
    expect(screen.getByLabelText("Product has unsaved edits")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save this branch" })).not.toBeInTheDocument();
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
    expect(screen.getByRole("heading", { name: "Choose an area to edit" })).toBeInTheDocument();
  });
});
