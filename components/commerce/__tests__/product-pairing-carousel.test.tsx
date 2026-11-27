import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useOptionalProductPairingSelection: vi.fn(),
  useTranslations: vi.fn(),
}));

vi.mock("@/components/commerce/product-pairing-selection", () => ({
  useOptionalProductPairingSelection: mocks.useOptionalProductPairingSelection,
}));

vi.mock("@/lib/i18n/context", () => ({
  useTranslations: mocks.useTranslations,
}));

vi.mock("next/image", () => ({
  default: (props: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={props.alt} src={props.src} />
  ),
}));

import { ProductPairingCarousel } from "@/components/commerce/product-pairing-carousel";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useTranslations.mockReturnValue({
    t: (key: string) => key,
    locale: "en",
    plural: (key: string) => key,
  });
});

describe("ProductPairingCarousel equal grid", () => {
  it("places cards in an equal CSS grid that does not size from title length", () => {
    mocks.useOptionalProductPairingSelection.mockReturnValue({
      partners: [
        {
          pairingId: "1",
          available: true,
          product: {
            slug: "short",
            title: "A",
            price: "€10",
            image: "/a.jpg",
          },
        },
        {
          pairingId: "2",
          available: true,
          product: {
            slug: "long",
            title: "Very long charm title that would stretch a flex row if width came from text",
            price: "€20",
            image: "/b.jpg",
          },
        },
        {
          pairingId: "3",
          available: true,
          product: {
            slug: "mid",
            title: "Pearl drop",
            price: "€15",
            image: "/c.jpg",
          },
        },
      ],
      selectedPartner: null,
      selectPartner: vi.fn(),
    });

    render(<ProductPairingCarousel />);

    const grid = document.querySelector('[data-pairing-grid="equal"]');
    expect(grid).toBeTruthy();
    expect(grid).toHaveClass("grid");
    expect(grid).toHaveClass("grid-cols-2");
    expect(grid).toHaveClass("md:grid-cols-3");

    const cards = screen.getAllByRole("button");
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card.className).toMatch(/\bw-full\b/);
      expect(card.className).toMatch(/\bmin-w-0\b/);
      expect(card.className).not.toMatch(/max-w-/);
      expect(card.className).not.toMatch(/shrink-0/);
    }

    const titles = grid!.querySelectorAll(".line-clamp-2");
    expect(titles).toHaveLength(3);
  });
});
