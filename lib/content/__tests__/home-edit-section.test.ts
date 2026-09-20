import { describe, expect, it } from "vitest";

import { resolveHomeEditProducts } from "@/lib/content/home-edit-section";

const products = [
  { id: "pearl", title: "AAA Freshwater Pearl Necklace", sourceTitle: "AAA Freshwater Pearl Necklace", image: "/pearl.jpg" },
  { id: "bird", title: "Golden Bird Brooch", sourceTitle: "Golden Bird Brooch", image: "/bird.jpg" },
  { id: "moon", title: "Hammered Half Moon Necklace", sourceTitle: "Hammered Half Moon Necklace", image: "/moon.jpg" },
  { id: "dog", title: "Clementine Dachshund Bag Charm", sourceTitle: "Clementine Dachshund Bag Charm", image: "/dog.jpg" },
  { id: "extra", title: "Extra piece", sourceTitle: "Extra piece", image: "/extra.jpg" },
];

describe("resolveHomeEditProducts", () => {
  it("uses the client-approved four-piece edit in its specified order by default", () => {
    expect(resolveHomeEditProducts(products, []).map((product) => product.id)).toEqual([
      "bird",
      "moon",
      "dog",
      "pearl",
    ]);
  });

  it("uses the CMS selection in slot order and ignores duplicates or unavailable images", () => {
    expect(resolveHomeEditProducts(
      [...products, { id: "no-image", title: "Hidden", sourceTitle: "Hidden", image: "" }],
      ["extra", "bird", "extra", "no-image", "pearl"],
    ).map((product) => product.id)).toEqual(["extra", "bird", "pearl"]);
  });
});
