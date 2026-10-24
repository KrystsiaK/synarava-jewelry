/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { AdminShopifyCheckProvider } from "@/components/admin/translations/admin-shopify-check-context";
import { SaveButtons } from "@/components/admin/products/product-sync-strip";
import { FieldConflictListModal } from "@/components/admin/shared/field-conflict-panel";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

const signals: CatalogConflictSignals = {
  state: "ready",
  totalCount: 1,
  checkedAt: new Date().toISOString(),
  products: {
    "p-1": {
      shared: true,
      sharedCount: 1,
      locales: [],
      name: "Ring",
      allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
    },
  },
  recentlyUpdatedProducts: {},
};

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

  it("disables Take Shopify / Keep ours while running and re-enables after success path (not running)", () => {
    const { rerender } = render(
      <AdminShopifyCheckProvider initialRunning>
        <FieldConflictListModal
          open
          onClose={vi.fn()}
          signals={signals}
          entities={[{ id: "p-1", name: "Ring" }]}
          focusedEntityId="p-1"
          busy={false}
          entityNoun="product"
          entityNounPlural="products"
          ariaLabel="Conflicts"
          onAction={vi.fn()}
        />
      </AdminShopifyCheckProvider>,
    );

    expect(screen.getByRole("button", { name: "Take Shopify" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keep ours" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Take Shopify for all" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keep ours for all" })).toBeDisabled();

    rerender(
      <AdminShopifyCheckProvider initialRunning={false}>
        <FieldConflictListModal
          open
          onClose={vi.fn()}
          signals={signals}
          entities={[{ id: "p-1", name: "Ring" }]}
          focusedEntityId="p-1"
          busy={false}
          entityNoun="product"
          entityNounPlural="products"
          ariaLabel="Conflicts"
          onAction={vi.fn()}
        />
      </AdminShopifyCheckProvider>,
    );

    expect(screen.getByRole("button", { name: "Take Shopify" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Keep ours" })).not.toBeDisabled();
  });

  it("re-enables Take / Keep after failure path (checkRunning false again)", () => {
    render(
      <AdminShopifyCheckProvider initialRunning={false}>
        <FieldConflictListModal
          open
          onClose={vi.fn()}
          signals={{ ...signals, state: "failed" }}
          entities={[{ id: "p-1", name: "Ring" }]}
          focusedEntityId="p-1"
          busy={false}
          entityNoun="product"
          entityNounPlural="products"
          ariaLabel="Conflicts"
          onAction={vi.fn()}
        />
      </AdminShopifyCheckProvider>,
    );
    expect(screen.getByRole("button", { name: "Take Shopify" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Keep ours" })).not.toBeDisabled();
  });
});
