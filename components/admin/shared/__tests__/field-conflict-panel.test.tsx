import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  FieldConflictDetailsModal,
  FieldConflictListModal,
  FieldConflictPreviewModal,
  type FieldConflictPreviewModel,
} from "@/components/admin/shared/field-conflict-panel";
import type { CatalogConflictField } from "@/lib/shopify/catalog-conflict";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

const field: CatalogConflictField = {
  fieldKey: "translation:pt:title",
  label: "Title",
  scope: { kind: "LOCALE", code: "pt", name: "Portuguese", nativeName: "Português" },
  origin: "TRANSLATION",
  targetKind: "NATIVE",
  synaravaValue: "Anel",
  shopifyValue: "Anel Shopify",
  baseValue: "Ring",
  localFingerprint: "local",
  shopifyFingerprint: "shopify",
  allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
  blockedReason: null,
  sourceId: "d1",
};

const signals: CatalogConflictSignals = {
  state: "ready",
  totalCount: 1,
  checkedAt: "2026-10-23T10:00:00.000Z",
  recentlyUpdatedProducts: {},
  products: {
    p1: {
      shared: false,
      locales: [{ code: "pt", name: "Portuguese", nativeName: "Português", count: 1 }],
    },
  },
};

describe("FieldConflictPanel", () => {
  it("requires preview before any write — list bulk only emits preview action", () => {
    const onAction = vi.fn();
    render(
      <FieldConflictListModal
        open
        onClose={vi.fn()}
        signals={signals}
        entities={[{ id: "p1", name: "Lava Ring", detail: "SKU L-1" }]}
        focusedEntityId={null}
        busy={false}
        entityNoun="product"
        entityNounPlural="products"
        ariaLabel="Product differences"
        onAction={onAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Take Shopify for all" }));
    expect(onAction).toHaveBeenCalledWith({ kind: "bulk", direction: "SHOPIFY_TO_SYNARAVA" });
    fireEvent.click(screen.getByRole("button", { name: "Keep ours for all" }));
    expect(onAction).toHaveBeenCalledWith({ kind: "bulk", direction: "SYNARAVA_TO_SHOPIFY" });
  });

  it("supports bulk select for visible fields and continues only after a choice", () => {
    const onSelectAll = vi.fn();
    const onContinue = vi.fn();
    render(
      <FieldConflictDetailsModal
        open
        title="Lava Ring"
        fields={[field]}
        selections={{}}
        loading={false}
        applying={false}
        entityId="p1"
        onClose={vi.fn()}
        onSelect={vi.fn()}
        onSelectAll={onSelectAll}
        onContinue={onContinue}
      />,
    );

    expect(screen.getByRole("button", { name: "Preview changes" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Take Shopify for visible fields" }));
    expect(onSelectAll).toHaveBeenCalledWith("SHOPIFY_TO_SYNARAVA");
  });

  it("blocks confirm until clear-non-empty is acknowledged", () => {
    const onConfirm = vi.fn();
    const preview: FieldConflictPreviewModel = {
      truncated: false,
      excluded: [],
      entries: [{
        entityId: "p1",
        field,
        direction: "SHOPIFY_TO_SYNARAVA",
        willClearNonEmptyValue: true,
        impactNote: null,
      }],
    };
    render(
      <FieldConflictPreviewModal
        preview={preview}
        entitiesById={new Map([["p1", { id: "p1", name: "Lava Ring" }]])}
        applying={false}
        resultMessage={null}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Confirm changes before writing" });
    const confirm = within(dialog).getByRole("button", { name: "Confirm changes" });
    expect(confirm).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("checkbox"));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith(true);
  });

  it("keeps a lasting result message visible on the preview", () => {
    const preview: FieldConflictPreviewModel = {
      truncated: false,
      excluded: [],
      entries: [{
        entityId: "p1",
        field,
        direction: "SHOPIFY_TO_SYNARAVA",
        willClearNonEmptyValue: false,
      }],
    };
    render(
      <FieldConflictPreviewModal
        preview={preview}
        entitiesById={new Map([["p1", { id: "p1", name: "Lava Ring" }]])}
        applying={false}
        resultMessage="1 change applied."
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText("1 change applied.")).toBeInTheDocument();
  });
});
