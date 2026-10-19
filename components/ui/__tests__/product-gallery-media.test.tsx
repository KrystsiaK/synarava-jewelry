import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} data-testid="gallery-image" />
  ),
}));

vi.mock("@/lib/i18n/context", () => ({
  useTranslations: () => ({
    t: (key: string) => key,
    locale: "en",
  }),
}));

import { ProductGalleryMedia } from "@/components/ui/product-gallery-media";

describe("ProductGalleryMedia", () => {
  it("renders full-color image, static caption, scrim, and edge layers", () => {
    const { container } = render(
      <ProductGalleryMedia
        src="/media/ring.jpg"
        alt="Amber ring"
        sizes="33vw"
        aspectClassName="aspect-[3/4]"
      >
        <p className="product-media-scrim__title">Amber ring</p>
        <p className="product-media-scrim__meta">120 EUR</p>
      </ProductGalleryMedia>,
    );

    expect(container.querySelector('[data-component="ProductGalleryMedia"]')).not.toBeNull();
    expect(screen.getByTestId("gallery-image")).toHaveAttribute("alt", "Amber ring");
    expect(screen.getByText("Amber ring")).toBeInTheDocument();
    expect(screen.getByText("120 EUR")).toBeInTheDocument();
    expect(container.querySelector(".product-media-scrim")).not.toBeNull();
    expect(container.querySelector(".product-gallery-media__edge")).not.toBeNull();
    expect(container.querySelector(".product-gallery-media__image-wrap")).not.toBeNull();
  });

  it("marks rail variant for discovery/related cards", () => {
    const { container } = render(
      <ProductGalleryMedia
        src="/media/ring.jpg"
        alt="Ring"
        sizes="336px"
        aspectClassName="aspect-[4/5]"
        rail
      />,
    );

    expect(container.querySelector('[data-rail="true"]')).not.toBeNull();
    expect(container.querySelector(".product-media-scrim--rail")).not.toBeNull();
  });
});
