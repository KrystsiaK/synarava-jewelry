import { describe, expect, it } from "vitest";

import { resolveHomeSectionVisibility } from "@/lib/content/home-sections";

describe("resolveHomeSectionVisibility", () => {
  it("keeps existing storefront sections visible for legacy page content", () => {
    expect(resolveHomeSectionVisibility({})).toEqual({
      hero: true,
      department: false,
      archive: true,
      material: true,
      manifesto: true,
      finalCta: true,
    });
  });

  it("honors explicit visibility choices for every home section", () => {
    expect(resolveHomeSectionVisibility({
      heroSectionEnabled: false,
      departmentSectionEnabled: true,
      archiveSectionEnabled: false,
      materialSectionEnabled: false,
      manifestoSectionEnabled: false,
      finalCtaSectionEnabled: false,
    })).toEqual({
      hero: false,
      department: true,
      archive: false,
      material: false,
      manifesto: false,
      finalCta: false,
    });
  });
});
