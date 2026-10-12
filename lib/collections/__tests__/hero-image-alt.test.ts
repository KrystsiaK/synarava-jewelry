import { describe, expect, it } from "vitest";

import { resolveCollectionHeroImageAlt } from "@/lib/collections/hero-image-alt";

describe("resolveCollectionHeroImageAlt", () => {
  it("uses English alt, then name", () => {
    expect(resolveCollectionHeroImageAlt({ name: "Wanderlust", heroImageAlt: "Pearls on linen" }, "en"))
      .toBe("Pearls on linen");
    expect(resolveCollectionHeroImageAlt({ name: "Wanderlust", heroImageAlt: "  " }, "en"))
      .toBe("Wanderlust");
  });

  it("prefers locale overlay, then English, then name", () => {
    const collection = {
      name: "Wanderlust",
      heroImageAlt: "EN alt",
      translations: [
        { locale: "pt", heroImageAlt: "PT alt", name: "Vagabundo" },
        { locale: "ru", heroImageAlt: "", name: "Странник" },
      ],
    };
    expect(resolveCollectionHeroImageAlt(collection, "pt")).toBe("PT alt");
    expect(resolveCollectionHeroImageAlt(collection, "ru")).toBe("EN alt");
    expect(resolveCollectionHeroImageAlt({
      name: "Wanderlust",
      heroImageAlt: null,
      translations: [{ locale: "ru", heroImageAlt: null, name: "Странник" }],
    }, "ru")).toBe("Странник");
  });
});
