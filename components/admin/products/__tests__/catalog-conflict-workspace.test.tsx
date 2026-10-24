import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apply: vi.fn(),
  load: vi.fn(),
  loadSignals: vi.fn(),
  preview: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  pullProduct: vi.fn(),
  pushProduct: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }) }));
vi.mock("@/app/admin/actions/sync", () => ({
  applyCatalogConflictResolutionAction: mocks.apply,
  loadCatalogConflictSignalsAction: mocks.loadSignals,
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
  scope: { kind: "Shared" as const },
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
    mocks.loadSignals.mockResolvedValue({
      signals: {
        state: "ready",
        totalCount: 0,
        checkedAt: "2026-09-23T10:05:00.000Z",
        recentlyUpdatedProducts: { p1: { updatedAt: "2026-09-23T10:05:00.000Z" } },
        products: {},
      },
    });
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
    expect(await screen.findByRole("dialog", { name: "Choose which values to keep" })).toBeInTheDocument();
    expect(screen.getByText("RU · Русский")).toBeInTheDocument();
    expect(screen.getByText(/Only this language/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Shopify.*Take Shopify/s }));
    fireEvent.click(screen.getByRole("button", { name: "Preview changes" }));
    await waitFor(() => expect(mocks.preview).toHaveBeenCalledWith({
      kind: "MANUAL",
      selections: [{ productId: "p1", fieldKey: "translation:ru:title", direction: "SHOPIFY_TO_SYNARAVA" }],
    }));
    expect(await screen.findByRole("dialog", { name: "Confirm changes before writing" })).toBeInTheDocument();
    expect(screen.getAllByText("RU · Русский").length).toBeGreaterThan(1);
  });

  it("fills visible fields from Select Shopify without applying yet", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Compare fields side by side" }));
    expect(await screen.findByRole("button", { name: "Preview changes" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Take Shopify for visible fields" }));
    expect(screen.getByRole("button", { name: "Preview changes" })).toBeEnabled();
    expect(mocks.preview).not.toHaveBeenCalled();
  });

  it("keeps field decisions after cancelling the preview", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Compare fields side by side" }));
    await screen.findByRole("dialog", { name: "Choose which values to keep" });
    fireEvent.click(screen.getByRole("button", { name: "Take Shopify for visible fields" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview changes" }));
    const preview = await screen.findByRole("dialog", { name: "Confirm changes before writing" });
    expect(await within(preview).findByRole("button", { name: "Confirm changes" })).toBeEnabled();
    fireEvent.click(within(preview).getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Confirm changes before writing" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("dialog", { name: "Choose which values to keep" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Shopify.*Selected/s })).toHaveAttribute("aria-pressed", "true");
  });

  it("previews a product-wide Shopify direction before writing", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Take Shopify" }));
    await waitFor(() => expect(mocks.preview).toHaveBeenCalledWith({
      kind: "PRODUCT",
      productId: "p1",
      direction: "SHOPIFY_TO_SYNARAVA",
    }));
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(await screen.findByRole("dialog", { name: "Confirm changes before writing" })).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Take Shopify" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Keep ours" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Compare fields side by side" })).not.toBeInTheDocument();
  });

  it("explains unsupported commerce fields and still allows a translation merge", async () => {
    mocks.load.mockResolvedValue({ conflict: { productId: "p1", fields: [blockedField, field] } });
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Compare fields side by side" }));
    expect(await screen.findByText(/Cannot choose here/)).toBeInTheDocument();
    expect(screen.getByText("Shared")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Take Shopify for visible fields" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview changes" }));
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
    expect(await screen.findByRole("button", { name: /Take Shopify \(whole item\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Keep ours \(whole item\)/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Preview changes" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Take Shopify \(whole item\)/i }));
    await waitFor(() => expect(mocks.pullProduct).toHaveBeenCalledWith("p1", true));
  });

  it("does not trap the page behind Working with Shopify while details are still loading", async () => {
    let resolveLoad: (value: { conflict: { productId: string; fields: typeof field[] } }) => void = () => undefined;
    mocks.load.mockImplementation(() => new Promise((resolve) => { resolveLoad = resolve; }));
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Compare fields side by side" }));
    expect(await screen.findByText(/Loading live comparison/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Working with Shopify")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close field choices" }));
    expect(screen.queryByRole("dialog", { name: "Choose which values to keep" })).not.toBeInTheDocument();
    await act(async () => {
      resolveLoad({ conflict: { productId: "p1", fields: [field] } });
    });
  });

  it("applies a confirmed preview and refreshes conflict signals from the server", async () => {
    const { onSignalsChange, onToast } = renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Take Shopify" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm changes" }));
    await waitFor(() => expect(mocks.apply).toHaveBeenCalled());
    expect(onToast).toHaveBeenCalledWith("1 change applied.", "success");
    await waitFor(() => expect(mocks.loadSignals).toHaveBeenCalled());
    expect(onSignalsChange).toHaveBeenCalledWith(expect.objectContaining({
      totalCount: 0,
      recentlyUpdatedProducts: expect.objectContaining({ p1: expect.objectContaining({ updatedAt: expect.any(String) }) }),
    }));
  });

  it("blocks Resolve when the product form is dirty or saving", async () => {
    const onToast = vi.fn();
    render(
      <CatalogConflictWorkspace
        open
        onClose={vi.fn()}
        signals={signals}
        onSignalsChange={vi.fn()}
        products={[{ id: "p1", name: "Amber ring", sku: "AR-1" }]}
        focusedProductId={null}
        formBlocked
        onToast={onToast}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Take Shopify" }));
    expect(onToast).toHaveBeenCalledWith("Save your product changes before Resolve or Push.", "info");
    expect(mocks.preview).not.toHaveBeenCalled();
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
    fireEvent.click(screen.getByRole("button", { name: "Take Shopify" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Take Shopify" }));
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
    expect(screen.queryByText("1 product need a decision")).toBeInTheDocument();
    // Catalog bulk and other products stay out of a row-chip open.
    expect(screen.queryByRole("button", { name: /Take Shopify for all/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Keep ours for all/i })).not.toBeInTheDocument();
  });

  it("opens locale-scoped details with that language's fields plus SHARED commerce", async () => {
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

    const details = await screen.findByRole("dialog", { name: "Choose which values to keep" });
    expect(await within(details).findByText("Title")).toBeInTheDocument();
    expect(within(details).getByText("RU · Русский")).toBeInTheDocument();
    expect(within(details).queryByText("PT · Português")).not.toBeInTheDocument();
    // Shared commerce belongs under every language shell (commerce-sync marker tree).
    expect(within(details).getByText("Shared")).toBeInTheDocument();
  });

  it("opens whole-record choices from a non-EN locale when only SHARED commerce conflicts", async () => {
    mocks.load.mockResolvedValue({ conflict: { productId: "p1", fields: [blockedField] } });
    const onToast = vi.fn();
    renderWorkspace(vi.fn(), onToast, vi.fn(), {
      ...signals,
      products: { p1: { shared: true, sharedCount: 1, locales: [] } },
    }, { kind: "productLocale", productId: "p1", locale: "ru" });
    const details = await screen.findByRole("dialog", { name: "Choose which values to keep" });
    expect(await within(details).findByText("Status")).toBeInTheDocument();
    fireEvent.click(within(details).getByRole("button", { name: "Close field choices" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep ours" }));
    expect(await screen.findByRole("button", { name: "Keep ours (whole item)" })).toBeInTheDocument();
    expect(onToast).not.toHaveBeenCalledWith(
      expect.stringMatching(/No supported fields|Nothing left to sync/),
      "info",
    );
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

    const details = await screen.findByRole("dialog", { name: "Choose which values to keep" });
    expect(await within(details).findByText("Price")).toBeInTheDocument();
    expect(within(details).queryByText("Vendor")).not.toBeInTheDocument();
    expect(within(details).queryByText("Title")).not.toBeInTheDocument();
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

    const details = await screen.findByRole("dialog", { name: "Choose which values to keep" });
    expect(await within(details).findByText("Media gallery (image 1)")).toBeInTheDocument();
    expect(within(details).queryByText(/Cannot choose here/)).not.toBeInTheDocument();
    expect(within(details).getByRole("button", { name: /Preview changes/i })).toBeInTheDocument();
    expect(within(details).queryByRole("button", { name: /Go to Sync/i })).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: /Take Shopify \(whole item\)/i }));
    await waitFor(() => expect(mocks.pullProduct).toHaveBeenCalledWith("p1", true));
  });
  it("opens whole-record choices from a scoped direction instead of rejecting blocked fields", async () => {
    mocks.load.mockResolvedValue({ conflict: { productId: "p1", fields: [blockedField] } });
    const onToast = vi.fn();
    renderWorkspace(vi.fn(), onToast, vi.fn(), {
      ...signals, products: { p1: { shared: true, sharedCount: 1, locales: [] } },
    }, { kind: "productLocale", productId: "p1", locale: "en" });
    const details = await screen.findByRole("dialog", { name: "Choose which values to keep" });
    expect(await within(details).findByText("Status")).toBeInTheDocument();
    fireEvent.click(within(details).getByRole("button", { name: "Close field choices" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep ours" }));
    expect(await screen.findByRole("button", { name: "Keep ours (whole item)" })).toBeInTheDocument();
    expect(onToast).not.toHaveBeenCalledWith(
      expect.stringMatching(/No supported fields|Nothing left to sync/),
      "info",
    );
    expect(mocks.pushProduct).not.toHaveBeenCalled();
  });

  it("keeps whole-record choices available alongside supported fields and preserves side values", async () => {
    mocks.load.mockResolvedValue({ conflict: { productId: "p1", fields: [field, blockedField] } });
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Compare fields side by side" }));
    const dialog = await screen.findByRole("dialog", { name: "Choose which values to keep" });
    expect(within(dialog).getByRole("button", { name: "Keep ours (whole item)" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Ours \(Synarava\).*Keep ours/s })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Shopify.*Take Shopify/s })).toBeInTheDocument();
  });

  it("routes a catalog row with blocked commerce to full Pull/Push choices", async () => {
    mocks.load.mockResolvedValue({ conflict: { productId: "p1", fields: [blockedField] } });
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Keep ours" }));
    expect(await screen.findByRole("button", { name: "Keep ours (whole item)" })).toBeInTheDocument();
    expect(mocks.preview).not.toHaveBeenCalled();
  });

});
