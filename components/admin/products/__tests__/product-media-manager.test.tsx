import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductRecord } from "@/components/admin/products/product-types";

const mocks = vi.hoisted(() => ({
  updateProductMediaAltAction: vi.fn(),
  updateWorkingSnapshotMediaAltAction: vi.fn(),
  moveProductMediaAction: vi.fn(),
  removeProductMediaAction: vi.fn(),
  setPrimaryProductMediaAction: vi.fn(),
  pushToast: vi.fn(),
}));

vi.mock("@/app/admin/actions/products", () => ({
  updateProductMediaAltAction: mocks.updateProductMediaAltAction,
  updateWorkingSnapshotMediaAltAction: mocks.updateWorkingSnapshotMediaAltAction,
  moveProductMediaAction: mocks.moveProductMediaAction,
  removeProductMediaAction: mocks.removeProductMediaAction,
  setPrimaryProductMediaAction: mocks.setPrimaryProductMediaAction,
}));

vi.mock("@/components/admin/shared/admin-toast", () => ({
  useAdminToast: () => ({ pushToast: mocks.pushToast }),
}));

import { ProductMediaManager } from "@/components/admin/products/product-media-manager";

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
    imageUrl: "/media/lava.jpg",
    primaryAssetId: "asset-1",
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
    characteristics: [],
    variants: [],
    collections: [],
    tags: [],
    ...overrides,
  } as ProductRecord;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProductMediaManager alt editing", () => {
  it("keeps alt editable while blur-save is in flight and does not remount on alt update", async () => {
    let resolveSave: ((value: unknown) => void) | undefined;
    mocks.updateProductMediaAltAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );

    const user = userEvent.setup();
    const onChange = vi.fn();
    const onAltPersistStart = vi.fn();
    const { rerender } = render(
      <ProductMediaManager
        product={makeProduct()}
        onChange={onChange}
        onAltPersistStart={onAltPersistStart}
      />,
    );

    const alt = screen.getByRole("textbox", { name: /Alt text/i });
    await user.clear(alt);
    await user.type(alt, "Lava ring, front");
    await user.tab();

    expect(onAltPersistStart).toHaveBeenCalledTimes(1);
    expect(mocks.updateProductMediaAltAction).toHaveBeenCalledWith("media-1", "Lava ring, front");
    expect(screen.getByRole("textbox", { name: /Alt text/i })).not.toBeDisabled();

    const nextProduct = makeProduct({
      media: [
        {
          id: "media-1",
          assetId: "asset-1",
          kind: "PRIMARY",
          alt: "Lava ring, front",
          caption: null,
          sortOrder: 0,
          url: "/media/lava.jpg",
          width: 800,
          height: 800,
        },
      ],
    });

    await act(async () => {
      resolveSave?.({ success: "Image alt text updated.", product: nextProduct });
    });

    rerender(
      <ProductMediaManager
        product={nextProduct}
        onChange={onChange}
        onAltPersistStart={onAltPersistStart}
      />,
    );

    const afterSave = screen.getByRole("textbox", { name: /Alt text/i });
    expect(afterSave).not.toBeDisabled();
    expect(afterSave).toHaveValue("Lava ring, front");
    expect(onChange).toHaveBeenCalledWith(nextProduct);
  });
});
