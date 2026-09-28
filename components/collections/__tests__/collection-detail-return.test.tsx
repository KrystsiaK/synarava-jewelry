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
      storyTitle: "",
      storyBody: "",
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
      storyTitle: string;
      storyBody: string;
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

  it("uses the story heading and paragraph instead of the header summary", () => {
    const collection = {
      id: "col-1",
      slug: "pearls",
      sourceSlug: "pearls",
      name: "Pearls",
      heroImage: "/pearl.jpg",
      manifesto: "",
      storyTitle: "Своя логика",
      storyBody: "Отдельный абзац",
      summary: "Header summary that stays in the hero",
      eyebrow: "Collection 01",
      accent: "PR",
      updatedAt: new Date("2026-01-01"),
      symbolismLabel: "FORM, TEXTURE, CHARACTER",
      symbolismTitle: "Украшение: одно или несколько",
      symbolismBody: "Первый абзац второго блока",
      symbolismBody2: "Второй абзац",
    } as CollectionSummary & {
      manifesto: string;
      storyTitle: string;
      storyBody: string;
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

    expect(screen.getByRole("heading", { level: 2, name: "Своя логика" })).toBeInTheDocument();
    expect(screen.getAllByText("Header summary that stays in the hero")).toHaveLength(1);
    expect(screen.getByText("Отдельный абзац")).toBeInTheDocument();
    expect(screen.getByText("Первый абзац второго блока")).toBeInTheDocument();
  });

  it("hides the story paragraph when it is empty instead of copying the header", () => {
    const collection = {
      id: "col-1",
      slug: "pearls",
      sourceSlug: "pearls",
      name: "Pearls",
      heroImage: "/pearl.jpg",
      manifesto: "",
      storyTitle: "",
      storyBody: "",
      summary: "Only in the hero",
      eyebrow: "Collection 01",
      accent: "PR",
      updatedAt: new Date("2026-01-01"),
      symbolismLabel: "",
      symbolismTitle: "",
      symbolismBody: "",
      symbolismBody2: "",
    } as CollectionSummary & {
      manifesto: string;
      storyTitle: string;
      storyBody: string;
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

    expect(screen.getByRole("heading", { level: 2, name: "A world with a clear visual logic" })).toBeInTheDocument();
    expect(screen.getAllByText("Only in the hero")).toHaveLength(1);
  });
});
