import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductRecord } from "@/components/admin/products/product-types";

const mocks = vi.hoisted(() => ({
  updateProductMediaAltAction: vi.fn(),
  moveProductMediaAction: vi.fn(),
  removeProductMediaAction: vi.fn(),
  setPrimaryProductMediaAction: vi.fn(),
  pushToast: vi.fn(),
}));

vi.mock("@/app/admin/actions/products", () => ({
  updateProductMediaAltAction: mocks.updateProductMediaAltAction,
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
    extras: null,
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

describe("ProductMediaManager unified gallery", () => {
  it("shows Shopify frames and pending local upload in one list (no dual modes)", () => {
    render(
      <ProductMediaManager
        product={makeProduct({
          media: [
            {
              id: "media-new",
              assetId: "asset-new",
              kind: "GALLERY",
              alt: null,
              caption: null,
              sortOrder: 2,
              url: "/media/new.webp",
              width: 640,
              height: 640,
            },
          ],
          extras: {
            media: [
              {
                id: "gid://shopify/MediaImage/1",
                alt: "Front",
                preview: { image: { url: "https://cdn.example/1.jpg", width: 800, height: 800 } },
              },
              {
                id: "gid://shopify/MediaImage/2",
                alt: "Side",
                preview: { image: { url: "https://cdn.example/2.jpg", width: 800, height: 800 } },
              },
              {
                id: "local:asset-new",
                alt: "",
                preview: { image: { url: "/media/new.webp", width: 640, height: 640 } },
              },
            ],
          },
        })}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Will upload")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox", { name: /Alt text/i })).toHaveLength(3);
    expect(screen.queryByText(/Legacy cover image/i)).not.toBeInTheDocument();
  });

  it("blur-saves alt by frame id (not array index)", async () => {
    mocks.updateProductMediaAltAction.mockResolvedValue({
      success: "Image alt text updated.",
      product: makeProduct({ media: [] }),
    });
    const user = userEvent.setup();
    render(
      <ProductMediaManager
        product={makeProduct({
          media: [],
          extras: {
            media: [
              {
                id: "gid://shopify/MediaImage/1",
                alt: "Soleil Lemon Bag Charm",
                preview: { image: { url: "https://cdn.example/1.jpg", width: 800, height: 800 } },
              },
              {
                id: "gid://shopify/MediaImage/2",
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

    expect(mocks.updateProductMediaAltAction).toHaveBeenCalledWith(
      "product-1",
      "gid://shopify/MediaImage/2",
      "Lemon charm, side",
    );
  });

  it("removes a tree gallery frame by frame id", async () => {
    mocks.removeProductMediaAction.mockResolvedValue({
      success: "Image removed from the gallery. Push to Shopify to delete it remotely.",
      product: makeProduct({ media: [] }),
    });
    const user = userEvent.setup();
    render(
      <ProductMediaManager
        product={makeProduct({
          media: [],
          extras: {
            media: [
              {
                id: "gid://shopify/MediaImage/1",
                alt: "Front",
                preview: { image: { url: "https://cdn.example/1.jpg", width: 800, height: 800 } },
              },
              {
                id: "gid://shopify/MediaImage/2",
                alt: "Side",
                preview: { image: { url: "https://cdn.example/2.jpg", width: 800, height: 800 } },
              },
            ],
          },
        })}
        onChange={vi.fn()}
      />,
    );

    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    expect(removeButtons).toHaveLength(2);
    await user.click(removeButtons[1]);

    expect(mocks.removeProductMediaAction).toHaveBeenCalledWith(
      "product-1",
      "gid://shopify/MediaImage/2",
    );
  });

  it("confirms before removing the last gallery frame via AdminConfirmModal", async () => {
    mocks.removeProductMediaAction.mockResolvedValue({
      success: "Image removed from the gallery. Push to Shopify to delete it remotely.",
      product: makeProduct({ media: [] }),
    });
    const user = userEvent.setup();
    render(
      <ProductMediaManager
        product={makeProduct({
          media: [],
          extras: {
            media: [
              {
                id: "gid://shopify/MediaImage/1",
                alt: "Front",
                preview: { image: { url: "https://cdn.example/1.jpg", width: 800, height: 800 } },
              },
            ],
          },
        })}
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(mocks.removeProductMediaAction).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: /Remove last gallery image/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove image" }));
    expect(mocks.removeProductMediaAction).toHaveBeenCalledWith(
      "product-1",
      "gid://shopify/MediaImage/1",
    );
  });

  it("exposes accessible names on move controls and keeps alt editable during blur-save", async () => {
    let resolveSave: ((value: unknown) => void) | undefined;
    mocks.updateProductMediaAltAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );

    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <ProductMediaManager product={makeProduct()} onChange={onChange} />,
    );

    expect(screen.getByRole("button", { name: "Move left" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move right" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();

    const alt = screen.getByRole("textbox", { name: /Alt text/i });
    await user.clear(alt);
    await user.type(alt, "Lava ring, front");
    await user.tab();

    expect(mocks.updateProductMediaAltAction).toHaveBeenCalledWith(
      "product-1",
      "local:asset-1",
      "Lava ring, front",
    );
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
      extras: {
        media: [
          {
            id: "local:asset-1",
            alt: "Lava ring, front",
            preview: { image: { url: "/media/lava.jpg", width: 800, height: 800 } },
          },
        ],
      },
    });

    await act(async () => {
      resolveSave?.({ success: "Image alt text updated.", product: nextProduct });
    });

    rerender(<ProductMediaManager product={nextProduct} onChange={onChange} />);

    const afterSave = screen.getByRole("textbox", { name: /Alt text/i });
    expect(afterSave).not.toBeDisabled();
    expect(afterSave).toHaveValue("Lava ring, front");
    expect(onChange).toHaveBeenCalledWith(nextProduct);
  });

  it("Add images control is keyboard-focusable via the file input", () => {
    render(<ProductMediaManager product={makeProduct({ media: [] })} onChange={vi.fn()} />);
    const add = screen.getByLabelText(/Add images/i);
    expect(add).toHaveAttribute("type", "file");
    expect(within(add.closest("label")!).getByText(/Add images/i)).toBeInTheDocument();
  });
});
