import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CollectionSummary } from "@/lib/content/catalog";
import { CollectionsHero, CollectionsPage } from "@/components/collections/collections-page";

vi.mock("@/lib/i18n/context", () => ({
  useTranslations: () => ({
    locale: "en",
    t: (key: string) => key,
  }),
}));

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
    ...props
  }: {
    alt: string;
    src: string;
    "data-testid"?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} data-testid={props["data-testid"]} />
  ),
}));

const collections = [{
  id: "col-1",
  slug: "automatic-first-collection",
  sourceSlug: "automatic-first-collection",
  name: "Automatic first collection",
  eyebrow: "Collection 01",
  summary: "A summary",
  heroImage: "/automatic-collection.jpg",
  accent: "AX",
  updatedAt: new Date("2026-01-01"),
}] as CollectionSummary[];

describe("CollectionsHero", () => {
  it("uses the image configured for the collections index page", () => {
    render(
      <CollectionsHero
        collections={collections}
        heroImage="/configured-collections.jpg"
        eyebrow="Synarava collections"
        heading="Browse by collection"
        introduction="Explore Synarava."
      />,
    );

    expect(screen.getByTestId("collections-hero-media")).toHaveAttribute(
      "src",
      expect.stringContaining("configured-collections.jpg"),
    );
  });

  it("does not borrow the first collection image when no page hero is configured", () => {
    const { container } = render(
      <CollectionsHero
        collections={collections}
        eyebrow="Synarava collections"
        heading="Browse by collection"
        introduction="Explore Synarava."
      />,
    );

    expect(screen.queryByTestId("collections-hero-media")).not.toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });
});

describe("CollectionsPage", () => {
  it("renders CMS copy for header and callout", () => {
    render(
      <CollectionsPage
        collections={collections}
        content={{
          eyebrow: "Custom eyebrow",
          heading: "Custom heading here",
          introduction: "Custom intro copy.",
          calloutEyebrow: "Custom callout eyebrow",
          calloutHeading: "Custom callout heading",
          calloutCtaLabel: "Go shop",
          calloutCtaHref: "/shop",
          cardCtaLabel: "Open series",
        }}
      />,
    );

    expect(screen.getByText("Custom eyebrow")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Custom heading here");
    expect(screen.getByText("Custom intro copy.")).toBeInTheDocument();
    expect(screen.getByText("Custom callout eyebrow")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Custom callout heading" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go shop" })).toHaveAttribute("href", expect.stringContaining("/shop"));
    expect(screen.getByText("Open series")).toBeInTheDocument();
  });
});
