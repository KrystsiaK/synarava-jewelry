/** @vitest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { AdminShopifyCheckProvider } from "@/components/admin/translations/admin-shopify-check-context";
import { SaveButtons } from "@/components/admin/products/product-sync-strip";
import {
  ConflictResolver,
  type ConflictResolverAdapter,
} from "@/components/synarava-cms/conflict-resolver";
import type { CatalogConflictField } from "@/lib/shopify/catalog-conflict";

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

function createAdapter(): ConflictResolverAdapter {
  return {
    entityNoun: "product",
    entityNounPlural: "products",
    ariaLabel: "Conflicts",
    loadEntityFields: vi.fn(async () => ({ fields: [field] })),
    previewSelections: vi.fn(async () => ({ preview: { truncated: false, excluded: [], entries: [] } })),
    applySelections: vi.fn(async () => ({
      outcome: { appliedCount: 0, failedCount: 0, results: [] },
    })),
  };
}

function renderResolver(running: boolean) {
  return (
    <AdminShopifyCheckProvider initialRunning={running}>
      <ConflictResolver
        open
        onClose={vi.fn()}
        adapter={createAdapter()}
        entityIds={["p-1"]}
        entities={[{ id: "p-1", name: "Ring" }]}
        focusedEntityId="p-1"
        onToast={vi.fn()}
      />
    </AdminShopifyCheckProvider>
  );
}

describe("disable Save / Take / Keep while catalog check runs", () => {
  it("disables Save while checkRunning and keeps fields editable elsewhere", () => {
    const { rerender } = render(
      <AdminShopifyCheckProvider initialRunning>
        <SaveButtons onOpenConfirm={vi.fn()} pending={false} />
        <input aria-label="Editable title" defaultValue="Ring" />
      </AdminShopifyCheckProvider>,
    );

    expect(screen.getByRole("button", { name: /Save paused|Save product/i })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Editable title" })).not.toBeDisabled();

    rerender(
      <AdminShopifyCheckProvider initialRunning={false}>
        <SaveButtons onOpenConfirm={vi.fn()} pending={false} />
        <input aria-label="Editable title" defaultValue="Ring" />
      </AdminShopifyCheckProvider>,
    );
    expect(screen.getByRole("button", { name: /Save product/i })).not.toBeDisabled();
  });

  it("disables Take Shopify / Keep ours while running and re-enables after success path (not running)", async () => {
    const { rerender } = render(renderResolver(true));

    await screen.findByText("Title");
    expect(screen.getByRole("button", { name: "Take Shopify for all" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keep ours for all" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Take Shopify$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Keep ours$/i })).toBeDisabled();

    rerender(renderResolver(false));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Take Shopify for all" })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: "Keep ours for all" })).not.toBeDisabled();
    });
    expect(screen.getByRole("button", { name: /Take Shopify$/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /Keep ours$/i })).not.toBeDisabled();
  });

  it("re-enables Take / Keep after failure path (checkRunning false again)", async () => {
    render(renderResolver(false));
    await screen.findByText("Title");
    expect(screen.getByRole("button", { name: /Take Shopify$/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /Keep ours$/i })).not.toBeDisabled();
  });
});
