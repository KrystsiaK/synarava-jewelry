import { describe, expect, it } from "vitest";

import { localizedPageMetadataCopy } from "@/lib/seo/localized-page-metadata";

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
