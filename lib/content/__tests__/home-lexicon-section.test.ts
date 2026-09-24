import { describe, expect, it } from "vitest";

import {
  resolveLexiconMaterials,
  resolveLexiconNoteLabel,
  lexiconMaterialStorefrontCaption,
  lexiconMaterialStorefrontWarnings,
} from "@/lib/content/home-lexicon-section";

describe("resolveLexiconNoteLabel", () => {
  it("uses Material notes when the admin field is empty", () => {
    expect(resolveLexiconNoteLabel(undefined)).toBe("Material notes");
    expect(resolveLexiconNoteLabel("   ")).toBe("Material notes");
  });

  it("uses the trimmed admin label when configured", () => {
    expect(resolveLexiconNoteLabel("  Material details  ")).toBe("Material details");
  });
});

describe("resolveLexiconMaterials", () => {
  it("returns an empty list when nothing is configured", () => {
    expect(resolveLexiconMaterials(undefined)).toEqual([]);
    expect(resolveLexiconMaterials({ materialLexicon: [] })).toEqual([]);
  });

  it("drops an entry missing its name, description, or image", () => {
    expect(resolveLexiconMaterials({
      materialLexicon: [
        { name: "Freshwater pearl", description: "Natural, irregular." },
        { name: "", description: "No name.", image: "/pearl.jpg" },
      ],
    })).toEqual([]);
  });

  it("returns trimmed materials in order, parsing comma-separated properties", () => {
    expect(resolveLexiconMaterials({
      materialLexicon: [
        {
          name: "  Freshwater pearl ",
          category: " Organic ",
          description: " Natural, irregular, individually varied. ",
          image: "/pearl.jpg",
          properties: " Natural, Hypoallergenic ,  ",
        },
      ],
    })).toEqual([{
      name: "Freshwater pearl",
      category: "Organic",
      description: "Natural, irregular, individually varied.",
      image: "/pearl.jpg",
      properties: ["Natural", "Hypoallergenic"],
    }]);
  });

  it("caps the result at MAX_HOME_LEXICON_MATERIALS", () => {
    const material = { name: "M", description: "D", image: "/m.jpg" };
    expect(resolveLexiconMaterials({
      materialLexicon: [material, material, material, material],
    })).toHaveLength(3);
  });
});

describe("lexiconMaterialStorefrontWarnings", () => {
  it("warns on every empty storefront-required field", () => {
    expect(lexiconMaterialStorefrontWarnings({
      name: "",
      category: "",
      description: "",
      image: "",
      properties: "",
    })).toEqual({
      name: "Won't appear on the site without this.",
      description: "Won't appear on the site without this.",
      image: "Won't appear on the site without this.",
    });
  });

  it("clears warnings only for filled required fields", () => {
    expect(lexiconMaterialStorefrontWarnings({
      name: "Pearl",
      category: "",
      description: "",
      image: "",
    })).toEqual({
      name: undefined,
      description: "Won't appear on the site without this.",
      image: "Won't appear on the site without this.",
    });
  });
});

describe("lexiconMaterialStorefrontCaption", () => {
  it("captions incomplete rows and clears when the specimen is complete", () => {
    expect(lexiconMaterialStorefrontCaption({ name: "" })).toBe(
      "This specimen won't appear on the site.",
    );
    expect(lexiconMaterialStorefrontCaption({
      name: "Pearl",
      description: "Natural.",
      image: "/pearl.webp",
    })).toBeUndefined();
  });
});
