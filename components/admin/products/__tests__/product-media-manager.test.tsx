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
  it("emits unique media-alt FormData names for each local gallery image", () => {
    render(
      <ProductMediaManager
        product={makeProduct({
          media: [
            {
              id: "media-1",
              assetId: "asset-1",
              kind: "PRIMARY",
              alt: "Front",
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
              alt: "Side",
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
              alt: "Detail",
              caption: null,
              sortOrder: 2,
              url: "/media/3.jpg",
              width: 800,
              height: 800,
            },
          ],
        })}
        onChange={vi.fn()}
      />,
    );

    const inputs = screen.getAllByRole("textbox", { name: /Alt text/i });
    expect(inputs).toHaveLength(3);
    expect(inputs.map((input) => (input as HTMLInputElement).name)).toEqual([
      "media-alt-media-1",
      "media-alt-media-2",
      "media-alt-media-3",
    ]);
    expect(inputs.map((input) => (input as HTMLInputElement).value)).toEqual([
      "Front",
      "Side",
      "Detail",
    ]);
  });

  it("emits unique media-alt-tree FormData names for OUR tree frames", () => {
    render(
      <ProductMediaManager
        product={makeProduct({
          media: [],
          workingSnapshot: {
            media: [
              {
                id: "gid://1",
                alt: "Front",
                preview: { image: { url: "https://cdn.example/1.jpg", width: 800, height: 800 } },
              },
              {
                id: "gid://2",
                alt: "Side",
                preview: { image: { url: "https://cdn.example/2.jpg", width: 800, height: 800 } },
              },
              {
                id: "gid://3",
                alt: "Detail",
                preview: { image: { url: "https://cdn.example/3.jpg", width: 800, height: 800 } },
              },
            ],
          },
        })}
        onChange={vi.fn()}
      />,
    );

    const inputs = screen.getAllByRole("textbox", { name: /Alt text/i });
    expect(inputs).toHaveLength(3);
    expect(inputs.map((input) => (input as HTMLInputElement).name)).toEqual([
      "media-alt-tree-0",
      "media-alt-tree-1",
      "media-alt-tree-2",
    ]);
    expect(inputs.map((input) => (input as HTMLInputElement).value)).toEqual([
      "Front",
      "Side",
      "Detail",
    ]);
  });

  it("blur-saves only the edited tree index with its own alt", async () => {
    mocks.updateWorkingSnapshotMediaAltAction.mockResolvedValue({
      success: "Image alt text updated.",
      product: makeProduct({ media: [] }),
    });
    const user = userEvent.setup();
    render(
      <ProductMediaManager
        product={makeProduct({
          media: [],
          workingSnapshot: {
            media: [
              {
                id: "gid://1",
                alt: "Soleil Lemon Bag Charm",
                preview: { image: { url: "https://cdn.example/1.jpg", width: 800, height: 800 } },
              },
              {
                id: "gid://2",
                alt: "Soleil Lemon Bag Charm",
                preview: { image: { url: "https://cdn.example/2.jpg", width: 800, height: 800 } },
              },
            ],
          },
        })}
        onChange={vi.fn()}
      />,
    );

    const inputs = screen.getAllByRole("textbox", { name: /Alt text/i });
    await user.clear(inputs[1]);
    await user.type(inputs[1], "Lemon charm, side");
    await user.tab();

    expect(mocks.updateWorkingSnapshotMediaAltAction).toHaveBeenCalledWith(
      "product-1",
      1,
      "Lemon charm, side",
    );
    expect(mocks.updateProductMediaAltAction).not.toHaveBeenCalled();
  });

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
