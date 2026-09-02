import { describe, expect, it } from "vitest";

import type { ProductSummary } from "@/lib/content/catalog";
import { buildProductJsonLd } from "../product-json-ld";

describe("product JSON-LD", () => {
  it("uses canonical numeric commerce data and availability", () => {
    const product = {
      slug: "silver-ring",
      sku: "RING-01",
      title: "Silver Ring",
      shortDescription: "A handmade silver ring.",
      description: "",
      image: "https://cdn.example.com/ring.jpg",
      commerceMedia: [],
      vendor: "Synarava",
      categoryName: "Rings",
      priceAmount: 129.5,
      currency: "EUR",
      stockOnHand: 2,
    } as ProductSummary;

    expect(buildProductJsonLd(product, "https://synarava.com/")).toMatchObject({
      "@type": "Product",
      "@id": "https://synarava.com/products/silver-ring#product",
      sku: "RING-01",
      image: ["https://cdn.example.com/ring.jpg"],
      offers: {
        price: "129.50",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
      },
    });
  });
});
