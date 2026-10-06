import { describe, expect, it } from "vitest";

import {
  formatCollectionEyebrow,
  shippedCollectionEyebrowLabel,
} from "@/lib/content/collection-eyebrow";

describe("formatCollectionEyebrow", () => {
  it("localizes the Collection word for EN / PT / RU", () => {
    expect(formatCollectionEyebrow(2, shippedCollectionEyebrowLabel("en"))).toBe("Collection 02");
    expect(formatCollectionEyebrow(2, shippedCollectionEyebrowLabel("pt"))).toBe("Coleção 02");
    expect(formatCollectionEyebrow(2, shippedCollectionEyebrowLabel("ru"))).toBe("Коллекция 02");
  });

  it("falls back to the bare label when sort order is missing", () => {
    expect(formatCollectionEyebrow(null, "Коллекция")).toBe("Коллекция");
    expect(formatCollectionEyebrow(0, "Collection")).toBe("Collection");
  });
});
