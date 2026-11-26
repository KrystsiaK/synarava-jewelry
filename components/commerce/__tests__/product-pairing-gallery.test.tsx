import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useOptionalProductPairingSelection: vi.fn(),
}));

vi.mock("@/components/commerce/product-pairing-selection", () => ({
  useOptionalProductPairingSelection: mocks.useOptionalProductPairingSelection,
}));

vi.mock("@/components/artifacts/product-media-gallery", () => ({
  ProductMediaGallery: (props: {
    product: { title: string; image: string; commerceMedia: Array<{ src: string }> };
    leadingMedia?: Array<{ src: string; companionSrc?: string }>;
    mediaMode?: string;
  }) => (
    <div
      data-testid="gallery"
      data-mode={props.mediaMode ?? "prepend"}
      data-leading={JSON.stringify(props.leadingMedia ?? [])}
      data-product-media={props.product.commerceMedia.map((item) => item.src).join(",")}
    />
  ),
}));

import { ProductPairingAwareGallery } from "@/components/commerce/product-pairing-gallery";

const product = {
  title: "Necklace",
  image: "/necklace.jpg",
  commerceMedia: [
    { src: "/necklace.jpg", alt: "N", width: 1, height: 1 },
    { src: "/necklace-2.jpg", alt: "N2", width: 1, height: 1 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProductPairingAwareGallery", () => {
  it("keeps the normal product gallery when no partner is selected", () => {
    mocks.useOptionalProductPairingSelection.mockReturnValue(null);
    render(<ProductPairingAwareGallery product={product} />);
    const gallery = screen.getByTestId("gallery");
    expect(gallery).toHaveAttribute("data-mode", "prepend");
    expect(gallery).toHaveAttribute("data-leading", "[]");
  });

  it("shows only pairing photos (no product media) when the partner has multiple pair photos", () => {
    mocks.useOptionalProductPairingSelection.mockReturnValue({
      selectedPartner: {
        pairImageUrls: ["/pair-a.jpg", "/pair-b.jpg"],
        product: { title: "Charm", image: "/charm.jpg" },
      },
    });
    render(<ProductPairingAwareGallery product={product} />);
    const gallery = screen.getByTestId("gallery");
    expect(gallery).toHaveAttribute("data-mode", "replace");
    const leading = JSON.parse(gallery.getAttribute("data-leading") ?? "[]") as Array<{ src: string }>;
    expect(leading.map((item) => item.src)).toEqual(["/pair-a.jpg", "/pair-b.jpg"]);
    // Product commerce media must not appear as leading frames.
    expect(leading.some((item) => item.src.includes("necklace"))).toBe(false);
  });

  it("shows exactly one side-by-side frame when the pairing has zero photos", () => {
    mocks.useOptionalProductPairingSelection.mockReturnValue({
      selectedPartner: {
        pairImageUrls: [],
        product: { title: "Charm", image: "/charm.jpg" },
      },
    });
    render(<ProductPairingAwareGallery product={product} />);
    const gallery = screen.getByTestId("gallery");
    expect(gallery).toHaveAttribute("data-mode", "replace");
    const leading = JSON.parse(gallery.getAttribute("data-leading") ?? "[]") as Array<{
      src: string;
      companionSrc?: string;
    }>;
    expect(leading).toHaveLength(1);
    expect(leading[0]).toMatchObject({
      src: "/necklace.jpg",
      companionSrc: "/charm.jpg",
    });
  });
});
