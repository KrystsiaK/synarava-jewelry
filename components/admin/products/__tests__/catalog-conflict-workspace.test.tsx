import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }) }));
vi.mock("@/app/admin/actions/sync", async () => {
  const { adminSyncActionMocks } = await import("@/test/mocks/admin-sync-actions");
  return { ...adminSyncActionMocks };
});

import { CatalogConflictWorkspace } from "@/components/admin/products/product-conflict-adapter";
import { adminSyncActionMocks } from "@/test/mocks/admin-sync-actions";
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
      items={[{ id: "p1", name: "Amber ring", sku: "AR-1" }]}
      focusedId={null}
      viewScope={viewScope}
      onToast={onToast}
    />,
  );
  return { onSignalsChange, onToast, onClose };
}

describe("CatalogConflictWorkspace (ConflictResolver adapter)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminSyncActionMocks.loadProductCatalogConflictAction.mockResolvedValue({ conflict: { productId: "p1", fields: [field] } });
    adminSyncActionMocks.loadCatalogConflictSignalsAction.mockResolvedValue({
      signals: {
        state: "ready",
        totalCount: 0,
        checkedAt: "2026-09-23T10:05:00.000Z",
        recentlyUpdatedProducts: { p1: { updatedAt: "2026-09-23T10:05:00.000Z" } },
        products: {},
      },
    });
    adminSyncActionMocks.previewCatalogConflictResolutionAction.mockResolvedValue({
      preview: {
        truncated: false,
        excluded: [],
        entries: [{ productId: "p1", direction: "SHOPIFY_TO_SYNARAVA", field, willClearNonEmptyValue: false }],
      },
    });
    adminSyncActionMocks.applyCatalogConflictResolutionAction.mockResolvedValue({
      outcome: { appliedCount: 1, failedCount: 0, results: [{ productId: "p1", fieldKey: field.fieldKey, ok: true }] },
      success: "1 change applied.",
    });
  });

  it("loads field rows and applies only the selected conflict", async () => {
    const onApplied = vi.fn();
    render(
      <CatalogConflictWorkspace
        open
        onClose={vi.fn()}
        signals={signals}
        onSignalsChange={vi.fn()}
        items={[{ id: "p1", name: "Amber ring", sku: "AR-1" }]}
        focusedId={null}
        onToast={vi.fn()}
        onApplied={onApplied}
      />,
    );

    const titleSection = (await screen.findByText("Title")).closest("section") as HTMLElement;
    fireEvent.click(within(titleSection).getByRole("button", { name: /Shopify/i }));
    fireEvent.click(screen.getByRole("button", { name: "Apply (1)" }));

    await waitFor(() => {
      expect(adminSyncActionMocks.previewCatalogConflictResolutionAction).toHaveBeenCalledWith({
        kind: "MANUAL",
        selections: [{ productId: "p1", fieldKey: "translation:ru:title", direction: "SHOPIFY_TO_SYNARAVA" }],
      });
    });

    const preview = await screen.findByRole("dialog", { name: "Confirm changes before writing" });
    await act(async () => {
      fireEvent.click(within(preview).getByRole("button", { name: "Confirm changes" }));
    });

    await waitFor(() => {
      expect(adminSyncActionMocks.applyCatalogConflictResolutionAction).toHaveBeenCalled();
      expect(onApplied).toHaveBeenCalledWith({ productIds: ["p1"], appliedCount: 1 });
    });
  });

  it("footer Take Shopify for all only selects rows", async () => {
    renderWorkspace();
    await screen.findByText("Title");
    fireEvent.click(screen.getByRole("button", { name: "Take Shopify for all" }));
    expect(screen.getByRole("button", { name: "Apply (1)" })).toBeEnabled();
    expect(adminSyncActionMocks.previewCatalogConflictResolutionAction).not.toHaveBeenCalled();
    expect(adminSyncActionMocks.applyCatalogConflictResolutionAction).not.toHaveBeenCalled();
  });

  it("selects blocked commerce via whole-record pull on confirm", async () => {
    adminSyncActionMocks.loadProductCatalogConflictAction.mockResolvedValue({
      conflict: {
        productId: "p1",
        fields: [{
          ...field,
          fieldKey: "commerce:status",
          label: "Status",
          scope: { kind: "SHARED" as const },
          origin: "COMMERCE" as const,
          allowedDirections: [] as const,
          blockedReason: "No safe field-by-field write yet",
          sourceId: null,
        }],
      },
    });
    adminSyncActionMocks.pullSingleProductFromShopifyAction.mockResolvedValue({ success: "Pulled." });

    renderWorkspace();
    const statusSection = (await screen.findByText("Status")).closest("section") as HTMLElement;
    fireEvent.click(within(statusSection).getByRole("button", { name: /Shopify/i }));
    fireEvent.click(screen.getByRole("button", { name: "Apply (1)" }));
    const preview = await screen.findByRole("dialog", { name: "Confirm changes before writing" });
    expect(within(preview).getByText(/Whole-item sync/)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(preview).getByRole("button", { name: "Confirm changes" }));
    });
    await waitFor(() => {
      expect(adminSyncActionMocks.pullSingleProductFromShopifyAction).toHaveBeenCalledWith("p1", true);
    });
  });
});
