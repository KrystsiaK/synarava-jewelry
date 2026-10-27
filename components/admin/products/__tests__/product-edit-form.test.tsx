import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Link from "next/link";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductRecord } from "@/components/admin/products/product-types";

const mocks = vi.hoisted(() => ({
  saveProductAction: vi.fn(),
  deleteProductAction: vi.fn(),
  getSavedProductPayload: vi.fn(),
  getShopifyCategoryAttributesAction: vi.fn(),
  updateProductMediaAltAction: vi.fn(),
  updateWorkingSnapshotMediaAltAction: vi.fn(),
  moveProductMediaAction: vi.fn(),
  removeProductMediaAction: vi.fn(),
  removeWorkingSnapshotMediaAction: vi.fn(),
  setPrimaryProductMediaAction: vi.fn(),
  refreshPreservingScroll: vi.fn(),
  loadSkuAssignContext: vi.fn(),
  previewProductSkuAction: vi.fn(),
  assignProductSkuAction: vi.fn(),
  resumePendingSkuAction: vi.fn(),
}));

vi.mock("@/app/admin/actions/products", () => ({
  saveProductAction: mocks.saveProductAction,
  deleteProductAction: mocks.deleteProductAction,
  getSavedProductPayload: mocks.getSavedProductPayload,
  updateProductMediaAltAction: mocks.updateProductMediaAltAction,
  updateWorkingSnapshotMediaAltAction: mocks.updateWorkingSnapshotMediaAltAction,
  moveProductMediaAction: mocks.moveProductMediaAction,
  removeProductMediaAction: mocks.removeProductMediaAction,
  removeWorkingSnapshotMediaAction: mocks.removeWorkingSnapshotMediaAction,
  setPrimaryProductMediaAction: mocks.setPrimaryProductMediaAction,
}));

vi.mock("@/lib/admin/preserve-scroll", () => ({
  refreshPreservingScroll: (...args: unknown[]) => mocks.refreshPreservingScroll(...args),
}));

vi.mock("@/app/admin/actions/sync", async () => {
  const { adminSyncActionMocks } = await import("@/test/mocks/admin-sync-actions");
  return { ...adminSyncActionMocks };
});

vi.mock("@/app/admin/actions/taxonomy", () => ({
  searchShopifyTaxonomyCategoriesAction: vi.fn().mockResolvedValue({ categories: [] }),
  getShopifyCategoryAttributesAction: mocks.getShopifyCategoryAttributesAction,
}));

vi.mock("@/app/admin/actions/product-organization", () => ({
  listShopifyProductOrganizationAction: vi.fn().mockResolvedValue({ options: [] }),
}));

vi.mock("@/app/admin/actions/sku-assign", () => ({
  loadSkuAssignContext: (...args: unknown[]) => mocks.loadSkuAssignContext(...args),
  previewProductSkuAction: (...args: unknown[]) => mocks.previewProductSkuAction(...args),
  assignProductSkuAction: (...args: unknown[]) => mocks.assignProductSkuAction(...args),
  resumePendingSkuAction: (...args: unknown[]) => mocks.resumePendingSkuAction(...args),
}));

import { EditProductForm } from "@/components/admin/products/product-edit-form";
import { adminSyncActionMocks } from "@/test/mocks/admin-sync-actions";

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
    extras: null,
    media: [],
    characteristics: [],
    variants: [],
    collections: [],
    tags: [],
    ...overrides,
  } as ProductRecord;
}

function primaryVariant(sku: string, shopifyVariantId: string | null = null) {
  return {
    id: "variant-1",
    shopifyVariantId,
    title: "Default Title",
    sku,
    barcode: null,
    priceCents: 4500,
    compareAtCents: null,
    costCents: null,
    stockOnHand: 1,
    weightGrams: null,
    taxable: true,
    requiresShipping: true,
    tracked: true,
    selectedOptions: [],
    shopifyInventoryItemId: null,
    imageUrl: null,
  } as ProductRecord["variants"][number];
}

function productSignals(productId: string, presence: "SYNARAVA_ONLY" | "SHOPIFY_ONLY") {
  return {
    state: "ready" as const,
    totalCount: 1,
    checkedAt: "2026-10-27T10:00:00.000Z",
    products: {
      [productId]: {
        shared: true,
        sharedCount: 0,
        leafCount: 1,
        locales: [],
        presence,
      },
    },
    recentlyUpdatedProducts: {},
  };
}

function unassignedSkuContext(overrides: Record<string, unknown> = {}) {
  return {
    configured: true,
    familyKeys: ["accessory.eyeglasses", "jewelry.earring", "jewelry.necklace"],
    currentSku: "PENDING-abc",
    pending: true,
    pendingReservationSku: null,
    shopifyLinked: false,
    variantId: "variant-1",
    variants: [{
      variantId: "variant-1",
      title: "Default Title",
      sku: "PENDING-abc",
      shopifyVariantId: null,
      pending: true,
      pendingReservationSku: null,
      shopifyLinked: false,
    }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getShopifyCategoryAttributesAction.mockResolvedValue({ attributes: [] });
  mocks.loadSkuAssignContext.mockResolvedValue(unassignedSkuContext());
  adminSyncActionMocks.loadCatalogConflictSignalsAction.mockResolvedValue({
    signals: { state: "ready", totalCount: 0, checkedAt: null, products: {}, recentlyUpdatedProducts: {} },
  });
  adminSyncActionMocks.listCustomProductMetafieldDefinitionsAction.mockResolvedValue({ definitions: [] });
  adminSyncActionMocks.createProductMetafieldDefinitionAction.mockResolvedValue({ success: "Created." });
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
    expect(adminSyncActionMocks.inspectProductSyncAction).not.toHaveBeenCalled();
  });

  it("shows Only in Synarava and blocks Create inline when the SKU is missing on every tab", async () => {
    const user = userEvent.setup();
    const product = makeProduct({ sku: "", variants: [primaryVariant("")] });
    render(
      <EditProductForm
        product={product}
        collections={[]}
        initialConflictSignals={productSignals(product.id, "SYNARAVA_ONLY")}
      />,
    );

    expect(screen.getByText("Only in Synarava")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create in Shopify" })).toBeDisabled();
    expect(screen.getByText("SKU required")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Price/ }));
    expect(screen.getByRole("button", { name: "Create in Shopify" })).toBeDisabled();
    expect(screen.getByText("SKU required")).toBeInTheDocument();
  });

  it("keeps Create in Shopify visible for a pending reservation and becomes In sync after push", async () => {
    const user = userEvent.setup();
    const product = makeProduct({
      sku: "BA-CH-002",
      details: {
        skuAssignmentPendings: {
          "variant-1": {
            reservationId: "res-1",
            sku: "BA-CH-002",
            familyKey: "jewelry.bracelet",
            correlationId: "corr-1",
            idempotencyKey: "idem-1",
            localVariantId: "variant-1",
          },
        },
      },
      variants: [primaryVariant("BA-CH-002")],
    });
    const linked = makeProduct({
      ...product,
      shopifyProductId: "gid://shopify/Product/1",
      syncStatus: "SYNCED",
      variants: [primaryVariant("BA-CH-002", "gid://shopify/ProductVariant/1")],
    });
    adminSyncActionMocks.pushSingleProductToShopifyAction.mockResolvedValue({
      success: "Commerce changes pushed to Shopify.",
      product: linked,
      inspection: { state: "SYNCED", remoteUpdatedAt: null, publications: [], differences: [] },
    });

    render(
      <EditProductForm
        product={product}
        collections={[]}
        initialConflictSignals={productSignals(product.id, "SYNARAVA_ONLY")}
      />,
    );

    const create = screen.getByRole("button", { name: "Create in Shopify" });
    expect(create).toBeEnabled();
    await user.click(create);

    expect(await screen.findByText("In sync")).toBeInTheDocument();
    expect(adminSyncActionMocks.pushSingleProductToShopifyAction).toHaveBeenCalledWith(product.id);
    expect(adminSyncActionMocks.loadCatalogConflictSignalsAction).toHaveBeenCalled();
  });

  it("shows Pull for a Shopify-only product matched to this local row", () => {
    const product = makeProduct({ variants: [primaryVariant("BA-CH-002")] });
    render(
      <EditProductForm
        product={product}
        collections={[]}
        initialConflictSignals={productSignals(product.id, "SHOPIFY_ONLY")}
      />,
    );

    expect(screen.getByText("Only in Shopify")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pull" })).toBeEnabled();
  });

  it("shows SKU and inventory location table on the Inventory tab", async () => {
    adminSyncActionMocks.inspectProductSyncAction.mockResolvedValue({
      inspection: { state: "SYNCED", remoteUpdatedAt: null, publications: [], differences: [] },
    });
    // Real commerce SKU → assign panel shows readonly SKU, not Family select.
    mocks.loadSkuAssignContext.mockResolvedValue({
      configured: false,
      reason: "test",
      familyKeys: [],
      currentSku: "LAVA-1",
      pending: false,
      pendingReservationSku: null,
      shopifyLinked: true,
      variantId: "variant-1",
      variants: [],
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
    // Section body enters via motion opacity; wait until the reveal finishes in jsdom.
    await waitFor(() => {
      expect(screen.getByLabelText(/^SKU/)).toBeVisible();
    });
    expect(screen.getByRole("spinbutton", { name: /Available quantity/ })).toBeVisible();
    expect(screen.getAllByText("Shop location").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Shipping" })).toBeInTheDocument();
  });

  it("keeps SKU Family after native input (mouse/keyboard) without form dirty recompute resetting the select", async () => {
    const user = userEvent.setup();
    const product = makeProduct({
      sku: "PENDING-abc",
      variants: [primaryVariant("PENDING-abc")],
    });
    mocks.loadSkuAssignContext.mockResolvedValue(unassignedSkuContext());

    render(<EditProductForm product={product} collections={[]} />);
    await user.click(screen.getByRole("tab", { name: /Inventory/ }));

    const family = await screen.findByLabelText(/^Family/);
    expect(family).toHaveValue("");
    expect(screen.getByRole("button", { name: "Preview" })).toBeDisabled();

    // Browser order: `input` bubbles to <form onInput> before `change`.
    // Without the closest-guard, dirty recompute re-renders and resets the controlled select to "".
    fireEvent.input(family, { target: { value: "jewelry.necklace" } });
    expect(family).toHaveValue("jewelry.necklace");
    fireEvent.change(family, { target: { value: "jewelry.necklace" } });
    expect(family).toHaveValue("jewelry.necklace");
    expect(screen.getByRole("button", { name: "Preview" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Confirm assign" })).toBeEnabled();
  });

  it("keeps SKU Family across select, context resolve, Save remount, and signal refresh", async () => {
    const user = userEvent.setup();
    const product = makeProduct({
      sku: "PENDING-abc",
      variants: [primaryVariant("PENDING-abc")],
    });
    let resolveContext: (value: unknown) => void = () => undefined;
    const firstLoad = new Promise((resolve) => {
      resolveContext = resolve;
    });
    mocks.loadSkuAssignContext.mockReturnValueOnce(firstLoad);
    mocks.loadSkuAssignContext.mockResolvedValue(unassignedSkuContext());
    mocks.saveProductAction.mockResolvedValue({ success: "Saved.", product });
    mocks.getSavedProductPayload.mockResolvedValue(product);
    adminSyncActionMocks.loadCatalogConflictSignalsAction.mockResolvedValue({
      signals: productSignals(product.id, "SYNARAVA_ONLY"),
    });

    render(<EditProductForm product={product} collections={[]} />);
    await user.click(screen.getByRole("tab", { name: /Inventory/ }));

    await act(async () => {
      resolveContext(unassignedSkuContext());
      await firstLoad;
    });

    const family = await screen.findByLabelText(/^Family/);
    expect(family).toHaveValue("");
    expect(screen.getByRole("button", { name: "Preview" })).toBeDisabled();

    fireEvent.change(family, { target: { value: "jewelry.necklace" } });
    expect(family).toHaveValue("jewelry.necklace");
    expect(screen.getByRole("button", { name: "Preview" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Confirm assign" })).toBeEnabled();
    // Family is under [data-sku-assign-controls] and has no named FormData field.
    expect(screen.queryByText("Save changes first")).not.toBeInTheDocument();

    // Save remounts ProductFormFields (fieldsRevision); inventory/SKU panel stays mounted.
    const loadsBeforeSave = mocks.loadSkuAssignContext.mock.calls.length;
    await user.click(screen.getAllByRole("button", { name: "Save product" })[0]);
    await user.click(await screen.findByRole("button", { name: "Yes, save changes" }));
    await waitFor(() => expect(mocks.saveProductAction).toHaveBeenCalled());

    // Outside-remount root fix: no panel remount → no second context load; Family survives.
    expect(mocks.loadSkuAssignContext.mock.calls.length).toBe(loadsBeforeSave);
    expect(screen.getByLabelText(/^Family/)).toHaveValue("jewelry.necklace");
    expect(screen.getByRole("button", { name: "Preview" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Confirm assign" })).toBeEnabled();
    expect(document.querySelector("[data-sku-assign-choice='true']")?.textContent).toContain(
      "jewelry.necklace",
    );
  });

  it("resets SKU Family when navigating to another product and back", async () => {
    const user = userEvent.setup();
    const first = makeProduct({
      id: "product-1",
      sku: "PENDING-abc",
      variants: [primaryVariant("PENDING-abc")],
    });
    const second = makeProduct({
      id: "product-2",
      sku: "PENDING-xyz",
      slug: "other-ring",
      name: "Other Ring",
      variants: [primaryVariant("PENDING-xyz")],
    });
    mocks.loadSkuAssignContext.mockResolvedValue(unassignedSkuContext());

    const { rerender } = render(<EditProductForm product={first} collections={[]} />);
    await user.click(screen.getByRole("tab", { name: /Inventory/ }));
    const family = await screen.findByLabelText(/^Family/);
    fireEvent.change(family, { target: { value: "jewelry.earring" } });
    expect(family).toHaveValue("jewelry.earring");

    rerender(<EditProductForm product={second} collections={[]} />);
    await user.click(screen.getByRole("tab", { name: /Inventory/ }));
    expect(await screen.findByLabelText(/^Family/)).toHaveValue("");
    expect(screen.getByRole("button", { name: "Preview" })).toBeDisabled();

    // Back to the first product — selection must start empty (keyed by product id).
    rerender(<EditProductForm product={first} collections={[]} />);
    await user.click(screen.getByRole("tab", { name: /Inventory/ }));
    expect(await screen.findByLabelText(/^Family/)).toHaveValue("");
    expect(screen.getByRole("button", { name: "Preview" })).toBeDisabled();
  });

  it("does not inspect Shopify on mount when linked (signals only)", async () => {
    const product = makeProduct({ shopifyProductId: "gid://shopify/Product/1" });
    render(<EditProductForm product={product} collections={[]} />);

    await act(async () => {});
    expect(adminSyncActionMocks.inspectProductSyncAction).not.toHaveBeenCalled();
  });

  it("shows editable Shopify fields and the pulled metafields", async () => {
    adminSyncActionMocks.inspectProductSyncAction.mockResolvedValue({
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

  it("keeps one shared editable slug and hides per-locale URL handles", async () => {
    const user = userEvent.setup();
    render(<EditProductForm product={makeProduct()} collections={[]} />);
    await act(async () => {});

    const slug = screen.getByRole("textbox", { name: /Slug/ });
    expect(slug).toBeVisible();
    expect(slug).toHaveValue("lava-ring");
    expect(screen.queryByLabelText(/URL handle/i)).not.toBeInTheDocument();

    await user.tripleClick(slug);
    await user.keyboard("lava-band");
    expect(slug).toHaveValue("lava-band");

    await user.click(screen.getByRole("tab", { name: "Português" }));
    expect(screen.getByRole("textbox", { name: /Slug/ })).toHaveValue("lava-band");
    expect(screen.queryByLabelText(/URL handle/i)).not.toBeInTheDocument();
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
    // SERP preview keeps a hidden copy of shortDescription on Essentials — scope to the field.
    const shortDescriptionField = () =>
      screen.getByLabelText("Edit Short description").closest("[data-component='AdminRichTextField']")!;
    expect(within(shortDescriptionField()).getByText("A refined piece.")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Português" }));
    expect(within(shortDescriptionField()).getByText("Uma peça refinada.")).toBeInTheDocument();
    expect(within(shortDescriptionField()).queryByText("A refined piece.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "English" }));
    expect(within(shortDescriptionField()).getByText("A refined piece.")).toBeInTheDocument();
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

  it("marks a section dirty when a named field changes, and clears when reverted", async () => {
    adminSyncActionMocks.inspectProductSyncAction.mockResolvedValue({
      inspection: { state: "SYNCED", remoteUpdatedAt: null, publications: [], differences: [] },
    });
    const user = userEvent.setup();
    render(<EditProductForm product={makeProduct({ shopifyProductId: "gid://shopify/Product/1" })} collections={[]} />);
    await act(async () => {});

    const title = screen.getByRole("textbox", { name: /Title \* Shopify/ });
    const original = (title as HTMLInputElement).value;
    await user.type(title, " Updated");
    // Dirty is signaled on section/locale tabs (accessible name includes "unsaved edits").
    expect(screen.getByRole("tab", { name: /Product Title & organization, unsaved edits/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save this branch" })).not.toBeInTheDocument();

    await user.clear(title);
    await user.type(title, original);
    await waitFor(() => {
      expect(screen.queryByRole("tab", { name: /Product Title & organization, unsaved edits/i })).not.toBeInTheDocument();
    });
  });

  it("does not dirty the form when choosing a SKU Family (Resolve stays available)", async () => {
    const user = userEvent.setup();
    const product = makeProduct({
      shopifyProductId: "gid://shopify/Product/1",
      sku: "PENDING-abc",
      variants: [primaryVariant("PENDING-abc", "gid://shopify/ProductVariant/1")],
    });
    mocks.loadSkuAssignContext.mockResolvedValue(unassignedSkuContext({
      shopifyLinked: true,
      variants: [{
        variantId: "variant-1",
        title: "Default Title",
        sku: "PENDING-abc",
        shopifyVariantId: "gid://shopify/ProductVariant/1",
        pending: true,
        pendingReservationSku: null,
        shopifyLinked: true,
      }],
    }));
    adminSyncActionMocks.loadCatalogConflictSignalsAction.mockResolvedValue({
      signals: {
        state: "ready" as const,
        totalCount: 1,
        checkedAt: "2026-10-27T10:00:00.000Z",
        products: {
          [product.id]: {
            shared: true,
            sharedCount: 1,
            leafCount: 1,
            locales: [],
            sections: ["price"],
          },
        },
        recentlyUpdatedProducts: {},
      },
    });

    render(
      <EditProductForm
        product={product}
        collections={[]}
        initialConflictSignals={{
          state: "ready",
          totalCount: 1,
          checkedAt: "2026-10-27T10:00:00.000Z",
          products: {
            [product.id]: {
              shared: true,
              sharedCount: 1,
              leafCount: 1,
              locales: [],
              sections: ["price"],
            },
          },
          recentlyUpdatedProducts: {},
        }}
      />,
    );
    await user.click(screen.getByRole("tab", { name: /Inventory/ }));
    const family = await screen.findByLabelText(/^Family/);
    fireEvent.change(family, { target: { value: "jewelry.necklace" } });

    expect(screen.queryByText("Save changes first")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolve" })).toBeEnabled();
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

  it("persists gallery alt on product Save and does not leave-prompt after blur-save", async () => {
    const galleryProduct = makeProduct({
      imageUrl: "/media/lava.jpg",
      primaryAssetId: "asset-1",
      media: [
        {
          id: "media-1",
          assetId: "asset-1",
          kind: "PRIMARY",
          alt: "Old alt",
          caption: null,
          sortOrder: 0,
          url: "/media/lava.jpg",
          width: 800,
          height: 800,
        },
      ],
    });
    const updated = {
      ...galleryProduct,
      media: [{ ...galleryProduct.media[0], alt: "Lava ring, front" }],
    };
    mocks.updateProductMediaAltAction.mockResolvedValue({
      success: "Image alt text updated.",
      product: updated,
    });
    mocks.saveProductAction.mockResolvedValue({
      success: "Product saved.",
      product: updated,
    });

    const user = userEvent.setup();
    render(
      <>
        <EditProductForm product={galleryProduct} collections={[]} />
        <Link href="/admin/products">Back to products</Link>
      </>,
    );
    await act(async () => {});

    await user.click(screen.getByRole("tab", { name: /Media/ }));
    const alt = screen.getByRole("textbox", { name: /Alt text/i });
    await user.clear(alt);
    await user.type(alt, "Lava ring, front");
    await user.tab();

    await waitFor(() => {
      expect(mocks.updateProductMediaAltAction).toHaveBeenCalledWith("media-1", "Lava ring, front");
    });
    expect(screen.getByRole("textbox", { name: /Alt text/i })).not.toBeDisabled();
    expect(mocks.refreshPreservingScroll).not.toHaveBeenCalled();

    await user.click(screen.getByRole("link", { name: "Back to products" }));
    expect(screen.queryByRole("heading", { name: "Unsaved product changes" })).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Save product" })[0]);
    await user.click(await screen.findByRole("button", { name: "Yes, save changes" }));

    await waitFor(() => {
      expect(mocks.saveProductAction).toHaveBeenCalled();
    });
    const formData = mocks.saveProductAction.mock.calls.at(-1)?.[0] as FormData;
    expect(formData.get("media-alt-media-1")).toBe("Lava ring, front");
  });

  it("submits distinct media-alt values for every gallery image on product Save", async () => {
    const galleryProduct = makeProduct({
      name: "Soleil Lemon Bag Charm",
      imageUrl: "/media/1.jpg",
      primaryAssetId: "asset-1",
      media: [
        {
          id: "media-1",
          assetId: "asset-1",
          kind: "PRIMARY",
          alt: "Soleil Lemon Bag Charm",
          caption: null,
          sortOrder: 0,
          url: "/media/1.jpg",
          width: 800,
          height: 800,
        },
        {
          id: "media-2",
          assetId: "asset-2",
          kind: "GALLERY",
          alt: "Soleil Lemon Bag Charm",
          caption: null,
          sortOrder: 1,
          url: "/media/2.jpg",
          width: 800,
          height: 800,
        },
        {
          id: "media-3",
          assetId: "asset-3",
          kind: "GALLERY",
          alt: "Soleil Lemon Bag Charm",
          caption: null,
          sortOrder: 2,
          url: "/media/3.jpg",
          width: 800,
          height: 800,
        },
      ],
    });
    mocks.saveProductAction.mockResolvedValue({
      success: "Product saved.",
      product: galleryProduct,
    });

    const user = userEvent.setup();
    render(<EditProductForm product={galleryProduct} collections={[]} />);
    await act(async () => {});

    await user.click(screen.getByRole("tab", { name: /Media/ }));
    const inputs = screen.getAllByRole("textbox", { name: /Alt text/i });
    expect(inputs).toHaveLength(3);

    const distinct = [
      "Lemon charm, front on linen",
      "Lemon charm, side with pearls",
      "Lemon charm, detail aventurine",
    ];
    // Set values without blur-save races — Save FormData must still carry each distinct alt.
    for (let index = 0; index < inputs.length; index += 1) {
      fireEvent.change(inputs[index], { target: { value: distinct[index] } });
    }

    await user.click(screen.getAllByRole("button", { name: "Save product" })[0]);
    await user.click(await screen.findByRole("button", { name: "Yes, save changes" }));

    await waitFor(() => {
      expect(mocks.saveProductAction).toHaveBeenCalled();
    });
    const formData = mocks.saveProductAction.mock.calls.at(-1)?.[0] as FormData;
    expect(formData.get("media-alt-media-1")).toBe(distinct[0]);
    expect(formData.get("media-alt-media-2")).toBe(distinct[1]);
    expect(formData.get("media-alt-media-3")).toBe(distinct[2]);
  });
});
