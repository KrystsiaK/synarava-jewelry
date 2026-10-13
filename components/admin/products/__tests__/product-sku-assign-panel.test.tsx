import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadSkuAssignContext: vi.fn(),
  previewProductSkuAction: vi.fn(),
  assignProductSkuAction: vi.fn(),
  resumePendingSkuAction: vi.fn(),
  pushToast: vi.fn(),
}));

vi.mock("@/app/admin/actions/sku-assign", () => ({
  loadSkuAssignContext: mocks.loadSkuAssignContext,
  previewProductSkuAction: mocks.previewProductSkuAction,
  assignProductSkuAction: mocks.assignProductSkuAction,
  resumePendingSkuAction: mocks.resumePendingSkuAction,
}));

vi.mock("@/components/admin/shared/admin-toast", () => ({
  useAdminToast: () => ({ pushToast: mocks.pushToast }),
}));

import { ProductSkuAssignPanel } from "@/components/admin/products/product-sku-assign-panel";

const validation = {
  fieldErrorId: (name: string) => `${name}-error`,
  fieldProps: () => ({}),
};

describe("ProductSkuAssignPanel M2 UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Family / Preview / Confirm for linked variant with SHOPIFY-* invent", async () => {
    mocks.loadSkuAssignContext.mockResolvedValue({
      configured: true,
      familyKeys: ["jewelry.necklace"],
      currentSku: "SHOPIFY-16079211397451-58824796668235",
      pending: false,
      pendingReservationSku: null,
      shopifyLinked: true,
      variantId: "var-1",
      variants: [{
        variantId: "var-1",
        title: "Default Title",
        sku: "SHOPIFY-16079211397451-58824796668235",
        shopifyVariantId: "gid://shopify/ProductVariant/58824796668235",
        // Simulate stale/wrong server flag — client must still open controls from SKU string
        pending: false,
        pendingReservationSku: null,
        shopifyLinked: true,
      }],
    });

    render(
      <ProductSkuAssignPanel
        productId="p1"
        draftSku="SHOPIFY-16079211397451-58824796668235"
        fieldErrors={{}}
        validation={validation as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Confirm assign" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Preview" })).toBeInTheDocument();
    expect(document.querySelector("[data-sku-assign-controls='true']")).not.toBeNull();
    expect(screen.getAllByText("Not assigned").length).toBeGreaterThanOrEqual(1);
    // Visible SKU chrome must not present the invent string as the assigned value
    expect(document.querySelector("[data-component='AdminReadonlyField'] .adm-readonly__value")?.textContent).toBe(
      "Not assigned",
    );
  });

  it("shows assign controls for empty SKU linked variant", async () => {
    mocks.loadSkuAssignContext.mockResolvedValue({
      configured: true,
      familyKeys: ["jewelry.necklace"],
      currentSku: "",
      pending: true,
      pendingReservationSku: null,
      shopifyLinked: true,
      variantId: "var-1",
      variants: [{
        variantId: "var-1",
        title: "Default Title",
        sku: "",
        shopifyVariantId: "gid://shopify/ProductVariant/1",
        pending: true,
        pendingReservationSku: null,
        shopifyLinked: true,
      }],
    });

    render(
      <ProductSkuAssignPanel
        productId="p1"
        draftSku=""
        fieldErrors={{}}
        validation={validation as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Confirm assign" })).toBeInTheDocument();
    });
    expect(screen.getByText(/Linked · Not assigned/)).toBeInTheDocument();
  });

  it("does not show assign controls for a real policy SKU", async () => {
    mocks.loadSkuAssignContext.mockResolvedValue({
      configured: true,
      familyKeys: ["jewelry.necklace"],
      currentSku: "JW-NECK-042",
      pending: false,
      pendingReservationSku: null,
      shopifyLinked: true,
      variantId: "var-1",
      variants: [{
        variantId: "var-1",
        title: "Default Title",
        sku: "JW-NECK-042",
        shopifyVariantId: "gid://shopify/ProductVariant/1",
        pending: false,
        pendingReservationSku: null,
        shopifyLinked: true,
      }],
    });

    render(
      <ProductSkuAssignPanel
        productId="p1"
        draftSku="JW-NECK-042"
        fieldErrors={{}}
        validation={validation as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("JW-NECK-042")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Confirm assign" })).not.toBeInTheDocument();
    expect(document.querySelector("[data-sku-assign-controls='true']")).toBeNull();
  });
});
