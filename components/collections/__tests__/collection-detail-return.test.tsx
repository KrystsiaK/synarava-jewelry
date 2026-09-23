import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CollectionDetail } from "../collection-detail";
import type { CollectionSummary, ProductSummary } from "@/lib/content/catalog";

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

type ObserverMock = {
  observe: ReturnType<typeof vi.fn>;
};

describe("CollectionDetail browser return", () => {
  it("reveals a product when it enters view even if the products heading is above the restored viewport", () => {
    const collection = {
      slug: "pearls",
      sourceSlug: "pearls",
      name: "Pearls",
      heroImage: "/pearl.jpg",
      manifesto: "",
      summary: "Pearl collection",
    } as CollectionSummary & {
      manifesto: string;
      symbolismLabel: string;
      symbolismTitle: string;
      symbolismBody: string;
      symbolismBody2: string;
    };
    const products = [
      { slug: "pearl-bracelet", title: "Pearl Bracelet", image: "/pearl.jpg", price: "€20", series: "Pearls" },
      { slug: "pearl-necklace", title: "Pearl Necklace", image: "/pearl.jpg", price: "€30", series: "Pearls" },
    ] as ProductSummary[];

    render(<CollectionDetail collection={collection} products={products} />);

    const bracelet = screen.getByRole("link", { name: /Pearl Bracelet/ }).parentElement!;
    const necklace = screen.getByRole("link", { name: /Pearl Necklace/ }).parentElement!;
    const observers = (global.IntersectionObserver as ReturnType<typeof vi.fn>).mock.results
      .map((result) => result.value as ObserverMock);
    const braceletObserver = observers.find((observer) => observer.observe.mock.calls.some(([target]) => target === bracelet));
    const necklaceObserver = observers.find((observer) => observer.observe.mock.calls.some(([target]) => target === necklace));

    expect(braceletObserver).toBeDefined();
    expect(necklaceObserver).toBeDefined();
  });
});
