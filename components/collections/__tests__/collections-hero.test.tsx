import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CollectionSummary } from "@/lib/content/catalog";
import { CollectionsHero } from "@/components/collections/collections-page";

const collections = [{
  slug: "automatic-first-collection",
  name: "Automatic first collection",
  heroImage: "/automatic-collection.jpg",
}] as CollectionSummary[];

describe("CollectionsHero", () => {
  it("uses the image configured for the collections index page", () => {
    render(<CollectionsHero collections={collections} heroImage="/configured-collections.jpg" />);

    expect(screen.getByTestId("collections-hero-media")).toHaveAttribute(
      "src",
      expect.stringContaining("configured-collections.jpg"),
    );
  });

  it("does not borrow the first collection image when no page hero is configured", () => {
    const { container } = render(<CollectionsHero collections={collections} />);

    expect(screen.queryByTestId("collections-hero-media")).not.toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });
});
