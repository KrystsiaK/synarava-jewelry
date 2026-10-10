import { describe, expect, it } from "vitest";

import {
  resolveCollectionCtaLabel,
  resolveCollectionHeroCtaLabel,
} from "@/lib/collections/hero-cta";

describe("resolveCollectionCtaLabel", () => {
  const collection = {
    ctaLabel: "Shop this series",
    translations: [
      { locale: "pt", ctaLabel: "Ver esta série" },
      { locale: "ru", ctaLabel: "Смотреть украшения" },
    ],
  };

  it("returns the English collection CTA for en", () => {
    expect(resolveCollectionCtaLabel(collection, "en")).toBe("Shop this series");
  });

  it("returns the locale overlay without falling back to English", () => {
    expect(resolveCollectionCtaLabel(collection, "ru")).toBe("Смотреть украшения");
    expect(
      resolveCollectionCtaLabel(
        { ctaLabel: "Shop this series", translations: [{ locale: "pt", ctaLabel: "" }] },
        "pt",
      ),
    ).toBe("");
  });

  it("returns empty when the locale has no translation row at all", () => {
    expect(
      resolveCollectionCtaLabel(
        { ctaLabel: "Shop this series", translations: [{ locale: "pt", ctaLabel: "Ver" }] },
        "ru",
      ),
    ).toBe("");
  });

  it("trims whitespace and treats blank as empty", () => {
    expect(resolveCollectionCtaLabel({ ctaLabel: "  " }, "en")).toBe("");
    expect(
      resolveCollectionCtaLabel(
        { ctaLabel: "EN", translations: [{ locale: "ru", ctaLabel: "  " }] },
        "ru",
      ),
    ).toBe("");
  });
});

describe("resolveCollectionHeroCtaLabel", () => {
  it("prefers the per-collection label", () => {
    expect(
      resolveCollectionHeroCtaLabel({
        collectionCtaLabel: "Смотреть украшения",
        pageDetailShopLabel: "Смотреть изделия",
      }),
    ).toBe("Смотреть украшения");
  });

  it("falls back to the Collections page global chrome string", () => {
    expect(
      resolveCollectionHeroCtaLabel({
        collectionCtaLabel: "",
        pageDetailShopLabel: "Смотреть изделия",
      }),
    ).toBe("Смотреть изделия");
  });

  it("returns undefined when both CMS values are empty so messages can fill in", () => {
    expect(
      resolveCollectionHeroCtaLabel({
        collectionCtaLabel: null,
        pageDetailShopLabel: undefined,
      }),
    ).toBeUndefined();
  });
});
