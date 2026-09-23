import { describe, expect, it } from "vitest";

import { resolveHomeSectionVisibility } from "@/lib/content/home-sections";

describe("resolveHomeSectionVisibility", () => {
  it("keeps existing storefront sections visible for legacy page content", () => {
    expect(resolveHomeSectionVisibility({})).toEqual({
      hero: true,
      archive: true,
      edit: true,
      material: true,
      manifesto: true,
      finalCta: true,
    });
  });

  it("honors explicit visibility choices for every home section", () => {
    expect(resolveHomeSectionVisibility({
      heroSectionEnabled: false,
      archiveSectionEnabled: false,
      editSectionEnabled: false,
      materialSectionEnabled: false,
      manifestoSectionEnabled: false,
      finalCtaSectionEnabled: false,
    })).toEqual({
      hero: false,
      archive: false,
      edit: false,
      material: false,
      manifesto: false,
      finalCta: false,
    });
  });
});
