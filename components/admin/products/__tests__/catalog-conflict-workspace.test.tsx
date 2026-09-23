import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apply: vi.fn(),
  load: vi.fn(),
  preview: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/app/admin/actions/sync", () => ({
  applyCatalogConflictResolutionAction: mocks.apply,
  loadProductCatalogConflictAction: mocks.load,
  previewCatalogConflictResolutionAction: mocks.preview,
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

function renderWorkspace(onSignalsChange = vi.fn(), onToast = vi.fn(), onClose = vi.fn()) {
  render(
    <CatalogConflictWorkspace
      open
      onClose={onClose}
      signals={signals}
      onSignalsChange={onSignalsChange}
      products={[{ id: "p1", name: "Amber ring", sku: "AR-1" }]}
      focusedProductId={null}
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

  it("explains unsupported commerce fields and still allows a translation merge", async () => {
    mocks.load.mockResolvedValue({ conflict: { productId: "p1", fields: [blockedField, field] } });
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Compare fields side by side" }));
    expect(await screen.findByText(/Unavailable here/)).toBeInTheDocument();
    expect(screen.getByText("SHARED")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select Shopify for visible fields" }));
    fireEvent.click(screen.getByRole("button", { name: "Review merge" }));
    await waitFor(() => expect(mocks.preview).toHaveBeenCalledWith({
      kind: "MANUAL",
      selections: [{ productId: "p1", fieldKey: "translation:ru:title", direction: "SHOPIFY_TO_SYNARAVA" }],
    }));
  });

  it("sends only-blocked commerce conflicts to the product editor instead of a dead merge", async () => {
    mocks.load.mockResolvedValue({ conflict: { productId: "p1", fields: [blockedField] } });
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Compare fields side by side" }));
    expect(await screen.findByText(/cannot be decided here yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open product editor" })).toHaveAttribute("href", "/admin/products/p1");
    expect(screen.queryByRole("button", { name: "Review merge" })).not.toBeInTheDocument();
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
});
