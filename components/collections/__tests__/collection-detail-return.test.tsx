import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CollectionDetail } from "../collection-detail";
import type { CollectionSummary } from "@/lib/content/catalog";

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

vi.mock("@/lib/i18n/context", () => ({
  useTranslations: () => ({
    locale: "en",
    t: (key: string) => key,
    plural: (key: string) => key,
  }),
}));

vi.mock("@/components/collections/collection-products-catalog", () => ({
  CollectionProductsCatalog: ({ collectionName }: { collectionName: string }) => (
    <section data-testid="collection-products-catalog">
      Products catalog for {collectionName}
    </section>
  ),
}));

describe("CollectionDetail", () => {
  it("renders the shop-style products catalog for the collection", () => {
    const collection = {
      id: "col-1",
      slug: "pearls",
      sourceSlug: "pearls",
      name: "Pearls",
      heroImage: "/pearl.jpg",
      manifesto: "",
      summary: "Pearl collection",
      eyebrow: "Collection 01",
      accent: "PR",
      updatedAt: new Date("2026-01-01"),
      symbolismLabel: "",
      symbolismTitle: "",
      symbolismBody: "",
      symbolismBody2: "",
    } as CollectionSummary & {
      manifesto: string;
      symbolismLabel: string;
      symbolismTitle: string;
      symbolismBody: string;
      symbolismBody2: string;
    };

    render(
      <CollectionDetail
        collection={collection}
        catalog={{
          collectionName: "Pearls",
          collectionPath: "/collections/pearls",
          collectionSourceSlug: "pearls",
          initialPage: { nodes: [], hasNextPage: false, endCursor: null, totalCount: 0 },
          filterProps: {
            categories: [],
            collections: [],
            tags: [],
            initialFilters: { collection: "pearls", sort: "featured" },
          },
        }}
      />,
    );

    expect(screen.getByTestId("collection-products-catalog")).toHaveTextContent("Products catalog for Pearls");
  });
});
