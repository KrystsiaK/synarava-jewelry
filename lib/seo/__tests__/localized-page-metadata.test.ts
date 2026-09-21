import { describe, expect, it, vi } from "vitest";

import { localizedPageMetadataCopy } from "@/lib/seo/localized-page-metadata";
import { buildAlternates } from "@/lib/seo/alternates";

vi.mock("@/lib/db", () => ({
  db: {
    storefrontLocale: {
      findMany: vi.fn().mockResolvedValue([
        { routeSegment: "en", isDefault: true, isPublished: true },
        { routeSegment: "pt", isDefault: false, isPublished: true },
      ]),
    },
  },
}));

describe("localizedPageMetadataCopy", () => {
  it("prefers localized CMS copy when it is available", () => {
    expect(localizedPageMetadataCopy({
      page: { title: "Loja", excerpt: "Seleção cuidada." },
      fallbackTitle: "Shop",
      fallbackDescription: "Browse products.",
    })).toEqual({ title: "Loja", description: "Seleção cuidada." });
  });

  it("falls back field by field instead of exposing an empty translation", () => {
    expect(localizedPageMetadataCopy({
      page: { title: "  ", excerpt: "" },
      fallbackTitle: "Coleções",
      fallbackDescription: "Explore as coleções.",
    })).toEqual({ title: "Coleções", description: "Explore as coleções." });
  });
});

describe("localized handle alternates", () => {
  it("uses the active handle for each locale and keeps English as x-default", async () => {
    expect(await buildAlternates("pt", "/products/anel-lava", {
      en: "/products/lava-ring",
      pt: "/products/anel-lava",
    })).toEqual({
      canonical: "/pt/products/anel-lava",
      languages: {
        en: "/en/products/lava-ring",
        pt: "/pt/products/anel-lava",
        "x-default": "/en/products/lava-ring",
      },
    });
  });
});
