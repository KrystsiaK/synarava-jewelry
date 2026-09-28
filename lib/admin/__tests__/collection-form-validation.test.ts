import { validateCollectionFormData, validateCollectionInput } from "@/lib/admin/collection-form-validation";

const filled = {
  name: "Earth Rituals",
  slug: "earth-rituals",
  code: "COL-01",
  description: "Summary",
  manifesto: "Manifesto",
  searchSummary: "Search",
  workflowState: "DRAFT",
  hasHeroImage: true,
};

describe("validateCollectionInput", () => {
  it("reports empty manifesto and search summary without rejecting a saved hero image", () => {
    expect(validateCollectionInput({ ...filled, manifesto: "", searchSummary: "" })).toEqual({
      manifesto: "Manifesto is required.",
      searchSummary: "Search summary is required.",
    });
  });

  it("requires a hero only when no file and no kept image are present", () => {
    expect(validateCollectionInput({ ...filled, hasHeroImage: false })).toEqual({
      heroImageFile: "Hero image is required.",
    });
  });
});

describe("validateCollectionFormData", () => {
  it("treats an existing hero url as the image, and a chosen file the same way", () => {
    const kept = new FormData();
    kept.set("name", "Earth Rituals");
    kept.set("slug", "earth-rituals");
    kept.set("code", "COL-01");
    kept.set("description", "Summary");
    kept.set("manifesto", "Manifesto");
    kept.set("searchSummary", "Search");
    kept.set("workflowState", "DRAFT");
    kept.set("existingHeroImageUrl", "https://cdn.example.com/hero.jpg");
    kept.set("removeHeroImage", "0");
    expect(validateCollectionFormData(kept)).toEqual({});

    const chosen = new FormData();
    for (const [key, value] of kept.entries()) chosen.set(key, value);
    chosen.set("existingHeroImageUrl", "");
    chosen.set("heroImageFile", new File(["image"], "hero.png", { type: "image/png" }));
    expect(validateCollectionFormData(chosen)).toEqual({});
  });

  it("rejects a removed hero when no replacement file is attached", () => {
    const formData = new FormData();
    formData.set("name", "Earth Rituals");
    formData.set("slug", "earth-rituals");
    formData.set("code", "COL-01");
    formData.set("description", "Summary");
    formData.set("manifesto", "Manifesto");
    formData.set("searchSummary", "Search");
    formData.set("workflowState", "PUBLISHED");
    formData.set("existingHeroImageUrl", "https://cdn.example.com/hero.jpg");
    formData.set("removeHeroImage", "1");
    expect(validateCollectionFormData(formData)).toEqual({
      heroImageFile: "Hero image is required.",
    });
  });
});
