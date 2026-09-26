import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apply: vi.fn(),
  load: vi.fn(),
  preview: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  pullProduct: vi.fn(),
  pushProduct: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }) }));
vi.mock("@/app/admin/actions/sync", () => ({
  applyCatalogConflictResolutionAction: mocks.apply,
  loadProductCatalogConflictAction: mocks.load,
  previewCatalogConflictResolutionAction: mocks.preview,
  pullSingleProductFromShopifyAction: mocks.pullProduct,
  pushSingleProductToShopifyAction: mocks.pushProduct,
}));

import { CatalogConflictWorkspace } from "@/components/admin/products/catalog-conflict-workspace";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

const signals: CatalogConflictSignals = {
  state: "ready",
  totalCount: 1,
  checkedAt: "2026-09-23T10:00:00.000Z",
  recentlyUpdatedProducts: {},
  products: {
    p1: { shared: false, locales: [{ code: "ru", name: "Russian", nativeName: "Русский", count: 1 }] },
  },
};

const field = {
  fieldKey: "translation:ru:title",
  label: "Title",
  scope: { kind: "LOCALE" as const, code: "ru", name: "Russian", nativeName: "Русский" },
  origin: "TRANSLATION" as const,
  targetKind: "NATIVE" as const,
  synaravaValue: "Кольцо",
  shopifyValue: "Кольцо Shopify",
  baseValue: "Ring",
  localFingerprint: "local",
  shopifyFingerprint: "shopify",
  allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"] as const,
  blockedReason: null,
  sourceId: "difference-1",
};

const blockedField = {
  ...field,
  fieldKey: "commerce:status",
  label: "Status",
  scope: { kind: "SHARED" as const },
  origin: "COMMERCE" as const,
  synaravaValue: "ACTIVE",
  shopifyValue: "DRAFT",
  allowedDirections: [] as const,
  blockedReason: "This commerce field does not have a safe scoped write yet. Open the product and use its full Push/Pull action.",
  sourceId: null,
};

function renderWorkspace(
  onSignalsChange = vi.fn(),
  onToast = vi.fn(),
  onClose = vi.fn(),
  signalState = signals,
  viewScope?: Parameters<typeof CatalogConflictWorkspace>[0]["viewScope"],
) {
  render(
    <CatalogConflictWorkspace
      open
      onClose={onClose}
      signals={signalState}
      onSignalsChange={onSignalsChange}
      products={[{ id: "p1", name: "Amber ring", sku: "AR-1" }]}
      focusedProductId={null}
      viewScope={viewScope}
      onToast={onToast}
    />,
  );
  return { onSignalsChange, onToast, onClose };
}

describe("CatalogConflictWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.load.mockResolvedValue({ conflict: { productId: "p1", fields: [field] } });
    mocks.preview.mockResolvedValue({
      preview: {
        entries: [{ productId: "p1", direction: "SHOPIFY_TO_SYNARAVA", field, willClearNonEmptyValue: false }],
        excluded: [],
        truncated: false,
      },
    });
    mocks.apply.mockResolvedValue({
      outcome: { appliedCount: 1, failedCount: 0, results: [{ productId: "p1", fieldKey: field.fieldKey, ok: true }] },
      success: "1 change applied.",
    });
  });

  it("keeps the language visible from summary through field choice and final preview", async () => {
    renderWorkspace();
    expect(screen.getByText(/RU · Русский · 1 field/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Compare fields side by side" }));
    expect(await screen.findByRole("dialog", { name: "Choose conflict values" })).toBeInTheDocument();
    expect(screen.getByText("RU · Русский")).toBeInTheDocument();
    expect(screen.getByText(/Only this language value is affected/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Shopify.*Кольцо Shopify/s }));
    fireEvent.click(screen.getByRole("button", { name: "Review merge" }));
    await waitFor(() => expect(mocks.preview).toHaveBeenCalledWith({
      kind: "MANUAL",
      selections: [{ productId: "p1", fieldKey: "translation:ru:title", direction: "SHOPIFY_TO_SYNARAVA" }],
    }));
    expect(await screen.findByRole("dialog", { name: "Confirm conflict resolution" })).toBeInTheDocument();
    expect(screen.getAllByText("RU · Русский").length).toBeGreaterThan(1);
  });

  it("fills visible fields from Select Shopify without applying yet", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Compare fields side by side" }));
    expect(await screen.findByRole("button", { name: "Review merge" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Select Shopify for visible fields" }));
    expect(screen.getByRole("button", { name: "Review merge" })).toBeEnabled();
    expect(mocks.preview).not.toHaveBeenCalled();
  });

  it("keeps field decisions after cancelling the preview", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Compare fields side by side" }));
    await screen.findByRole("dialog", { name: "Choose conflict values" });
    fireEvent.click(screen.getByRole("button", { name: "Select Shopify for visible fields" }));
    fireEvent.click(screen.getByRole("button", { name: "Review merge" }));
    const preview = await screen.findByRole("dialog", { name: "Confirm conflict resolution" });
    expect(await within(preview).findByRole("button", { name: "Confirm changes" })).toBeEnabled();
    fireEvent.click(within(preview).getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Confirm conflict resolution" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("dialog", { name: "Choose conflict values" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Shopify.*Selected/s })).toHaveAttribute("aria-pressed", "true");
  });

  it("previews a product-wide Shopify direction before writing", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Apply Shopify values" }));
    await waitFor(() => expect(mocks.preview).toHaveBeenCalledWith({
      kind: "PRODUCT",
      productId: "p1",
      direction: "SHOPIFY_TO_SYNARAVA",
    }));
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(await screen.findByRole("dialog", { name: "Confirm conflict resolution" })).toBeInTheDocument();
  });

  it("shows a Shopify-only product by name with Pull as its only row action", () => {
    renderWorkspace(vi.fn(), vi.fn(), vi.fn(), {
      ...signals,
      products: {
        "shopify:42": {
          shared: true,
          locales: [],
          presence: "SHOPIFY_ONLY",
          localProductId: null,
          shopifyProductId: "gid://shopify/Product/42",
          name: "Remote ring",
          sku: "R-42",
          allowedDirections: ["SHOPIFY_TO_SYNARAVA"],
        },
      },
    });

    expect(screen.getByText("Remote ring")).toBeInTheDocument();
    expect(screen.getByText("Only in Shopify")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pull product from Shopify" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply Synarava values" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Compare fields side by side" })).not.toBeInTheDocument();
  });

  it("explains unsupported commerce fields and still allows a translation merge", async () => {
    mocks.load.mockResolvedValue({ conflict: { productId: "p1", fields: [blockedField, field] } });
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Compare fields side by side" }));
    expect(await screen.findByText(/Cannot choose here/)).toBeInTheDocument();
    expect(screen.getByText("SHARED")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select Shopify for visible fields" }));
    fireEvent.click(screen.getByRole("button", { name: "Review merge" }));
    await waitFor(() => expect(mocks.preview).toHaveBeenCalledWith({
      kind: "MANUAL",
      selections: [{ productId: "p1", fieldKey: "translation:ru:title", direction: "SHOPIFY_TO_SYNARAVA" }],
    }));
  });

  it("offers inline Pull/Push for only-blocked commerce conflicts instead of a dead merge", async () => {
    mocks.load.mockResolvedValue({ conflict: { productId: "p1", fields: [blockedField] } });
    mocks.pullProduct.mockResolvedValue({ success: "Pulled." });
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Compare fields side by side" }));
    expect(await screen.findByRole("button", { name: /Pull from Shopify/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Push to Shopify/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review merge" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Pull from Shopify/i }));
    await waitFor(() => expect(mocks.pullProduct).toHaveBeenCalledWith("p1", true));
  });

  it("does not trap the page behind Working with Shopify while details are still loading", async () => {
    let resolveLoad: (value: { conflict: { productId: string; fields: typeof field[] } }) => void = () => undefined;
    mocks.load.mockImplementation(() => new Promise((resolve) => { resolveLoad = resolve; }));
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Compare fields side by side" }));
    expect(await screen.findByText(/Loading live field comparison/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Working with Shopify")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close conflict details" }));
    expect(screen.queryByRole("dialog", { name: "Choose conflict values" })).not.toBeInTheDocument();
    await act(async () => {
      resolveLoad({ conflict: { productId: "p1", fields: [field] } });
    });
  });

  it("applies a confirmed preview and marks a Shopify-to-Synarava product as updated", async () => {
    const { onSignalsChange, onToast } = renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Apply Shopify values" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm changes" }));
    await waitFor(() => expect(mocks.apply).toHaveBeenCalled());
    expect(onToast).toHaveBeenCalledWith("1 change applied.", "success");
    expect(onSignalsChange).toHaveBeenCalledWith(expect.objectContaining({
      totalCount: 0,
      recentlyUpdatedProducts: expect.objectContaining({ p1: expect.objectContaining({ updatedAt: expect.any(String) }) }),
    }));
  });

  it("closes product-scoped workspace and notifies onApplied after confirm", async () => {
    const onClose = vi.fn();
    const onApplied = vi.fn();
    render(
      <CatalogConflictWorkspace
        open
        onClose={onClose}
        signals={signals}
        onSignalsChange={vi.fn()}
        products={[{ id: "p1", name: "Amber ring", sku: "AMB-1" }]}
        focusedProductId="p1"
        viewScope={{ kind: "product", productId: "p1" }}
        onToast={vi.fn()}
        onApplied={onApplied}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply Shopify values" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm changes" }));
    expect(onClose).toHaveBeenCalled();
    await waitFor(() => expect(onApplied).toHaveBeenCalledWith(expect.objectContaining({
      productIds: ["p1"],
      appliedCount: 1,
    })));
  });

  it("clears Working with Shopify before a slow onApplied reload finishes", async () => {
    let resolveApplied: () => void = () => undefined;
    const onApplied = vi.fn(() => new Promise<void>((resolve) => { resolveApplied = resolve; }));
    render(
      <CatalogConflictWorkspace
        open
        onClose={vi.fn()}
        signals={signals}
        onSignalsChange={vi.fn()}
        products={[{ id: "p1", name: "Amber ring", sku: "AMB-1" }]}
        focusedProductId="p1"
        viewScope={{ kind: "product", productId: "p1" }}
        onToast={vi.fn()}
        onApplied={onApplied}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply Shopify values" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm changes" }));
    await waitFor(() => expect(onApplied).toHaveBeenCalled());
    expect(screen.queryByLabelText("Working with Shopify")).not.toBeInTheDocument();
    await act(async () => { resolveApplied(); });
  });

  it("scopes the list to one product and hides catalog bulk actions", () => {
    renderWorkspace(vi.fn(), vi.fn(), vi.fn(), {
      ...signals,
      totalCount: 2,
      products: {
        p1: signals.products.p1,
        p2: { shared: true, locales: [] },
      },
    }, { kind: "product", productId: "p1" });

    expect(screen.getByText("Amber ring")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Use Shopify for all/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Use Synarava for all/i })).not.toBeInTheDocument();
  });

  it("opens locale-scoped details with only that language's fields", async () => {
    mocks.load.mockResolvedValue({
      conflict: {
        productId: "p1",
        fields: [
          field,
          {
            ...field,
            fieldKey: "translation:pt:title",
            scope: { kind: "LOCALE" as const, code: "pt", name: "Portuguese", nativeName: "Português" },
            synaravaValue: "Anel",
            shopifyValue: "Anel Shopify",
          },
          blockedField,
        ],
      },
    });
    renderWorkspace(vi.fn(), vi.fn(), vi.fn(), signals, { kind: "productLocale", productId: "p1", locale: "ru" });

    expect(await screen.findByRole("dialog", { name: "Choose conflict values" })).toBeInTheDocument();
    expect(screen.getByText("RU · Русский")).toBeInTheDocument();
    expect(screen.queryByText("PT · Português")).not.toBeInTheDocument();
    expect(screen.queryByText("SHARED")).not.toBeInTheDocument();
  });

  it("opens section-scoped details with only that editor section's fields", async () => {
    mocks.load.mockResolvedValue({
      conflict: {
        productId: "p1",
        fields: [
          {
            ...blockedField,
            fieldKey: "commerce:price",
            label: "Price",
            blockedReason: null,
            allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"] as const,
            synaravaValue: "11.00",
            shopifyValue: "5.00",
          },
          {
            ...blockedField,
            fieldKey: "commerce:vendor",
            label: "Vendor",
            blockedReason: null,
            allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"] as const,
            synaravaValue: "Local",
            shopifyValue: "Shopify",
          },
          field,
        ],
      },
    });
    renderWorkspace(
      vi.fn(),
      vi.fn(),
      vi.fn(),
      {
        ...signals,
        products: {
          p1: { shared: true, sharedCount: 2, locales: [] },
        },
      },
      { kind: "productSection", productId: "p1", locale: "en", section: "price" },
    );

    expect(await screen.findByRole("dialog", { name: "Choose conflict values" })).toBeInTheDocument();
    expect(screen.getByText("Price")).toBeInTheDocument();
    expect(screen.queryByText("Vendor")).not.toBeInTheDocument();
    expect(screen.queryByText("Title")).not.toBeInTheDocument();
  });

  it("lets media gallery rows choose a side under Media (same apply contract)", async () => {
    mocks.load.mockResolvedValue({
      conflict: {
        productId: "p1",
        fields: [{
          fieldKey: "commerce:media-0-id",
          label: "Media gallery (image 1)",
          scope: { kind: "SHARED" as const },
          origin: "COMMERCE" as const,
          targetKind: "NATIVE" as const,
          synaravaValue: "—",
          shopifyValue: "ring.jpg",
          baseValue: null,
          localFingerprint: "local",
          shopifyFingerprint: "shopify",
          allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"] as const,
          blockedReason: null,
          sourceId: null,
          path: "media[0].id",
        }],
      },
    });
    render(
      <CatalogConflictWorkspace
        open
        onClose={vi.fn()}
        signals={{
          ...signals,
          products: {
            p1: { shared: true, sharedCount: 1, locales: [] },
          },
        }}
        onSignalsChange={vi.fn()}
        products={[{ id: "p1", name: "Amber ring", sku: "AR-1" }]}
        focusedProductId="p1"
        viewScope={{ kind: "productSection", productId: "p1", locale: "en", section: "media" }}
        onToast={vi.fn()}
      />,
    );

    expect(await screen.findByText("Media gallery (image 1)")).toBeInTheDocument();
    expect(screen.queryByText(/Cannot choose here/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Review merge/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Go to Sync/i })).not.toBeInTheDocument();
  });

  it("offers inline Pull/Push when only blocked fields remain", async () => {
    mocks.load.mockResolvedValue({
      conflict: {
        productId: "p1",
        fields: [{
          fieldKey: "commerce:status",
          label: "Status",
          scope: { kind: "SHARED" as const },
          origin: "COMMERCE" as const,
          targetKind: "NATIVE" as const,
          synaravaValue: "ACTIVE",
          shopifyValue: "DRAFT",
          baseValue: null,
          localFingerprint: "local",
          shopifyFingerprint: "shopify",
          allowedDirections: [] as const,
          blockedReason: "No safe field-by-field write yet",
          sourceId: null,
        }],
      },
    });
    mocks.pullProduct.mockResolvedValue({ success: "Pulled." });
    const onToast = vi.fn();
    const onApplied = vi.fn();
    render(
      <CatalogConflictWorkspace
        open
        onClose={vi.fn()}
        signals={{
          ...signals,
          products: {
            p1: { shared: true, sharedCount: 1, locales: [] },
          },
        }}
        onSignalsChange={vi.fn()}
        products={[{ id: "p1", name: "Amber ring", sku: "AR-1" }]}
        focusedProductId="p1"
        viewScope={{ kind: "product", productId: "p1" }}
        onToast={onToast}
        onApplied={onApplied}
      />,
    );

    expect(await screen.findByText("Status")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Pull from Shopify/i }));
    await waitFor(() => expect(mocks.pullProduct).toHaveBeenCalledWith("p1", true));
  });
});
