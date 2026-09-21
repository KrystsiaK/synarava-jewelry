import { describe, expect, it } from "vitest";

import { computeLegalDocumentLocaleBackfill, type LocaleDocConfig } from "@/lib/content/legal-document-backfill";

const config: LocaleDocConfig = {
  sections: [
    { id: "a", label: "1. A" },
    { id: "b", label: "2. B" },
  ],
  sectionDefaults: {
    a: { title: "Default A title", body: "Default A body." },
    b: { title: "Default B title", body: "Default B body." },
  },
  introDefault: "Default intro.",
  lastUpdatedDefault: "1 June 2025",
};

describe("computeLegalDocumentLocaleBackfill", () => {
  it("fills every field from the template for a brand-new (empty) document", () => {
    const result = computeLegalDocumentLocaleBackfill({}, config);
    expect(result).toEqual({
      legalSections: {
        a: { title: "Default A title", body: "Default A body." },
        b: { title: "Default B title", body: "Default B body." },
      },
      legalIntro: "Default intro.",
      legalLastUpdated: "1 June 2025",
      filledSectionIds: ["a", "b"],
    });
  });

  it("never touches a section that already has both a title and a body", () => {
    const current = {
      legalSections: {
        a: { title: "Admin's own title", body: "Admin's own body, unrelated to the template." },
      },
      legalIntro: "Admin's own intro.",
      legalLastUpdated: "21 September 2026",
    };
    const result = computeLegalDocumentLocaleBackfill(current, config);
    // Only "b" was ever missing — "a", intro, and last-updated are byte-for-byte unchanged.
    expect(result).toEqual({
      legalSections: {
        a: { title: "Admin's own title", body: "Admin's own body, unrelated to the template." },
        b: { title: "Default B title", body: "Default B body." },
      },
      filledSectionIds: ["b"],
    });
  });

  it("fills only the missing half of a partially-saved section, preserving the half that exists", () => {
    const current = { legalSections: { a: { title: "Admin's own title", body: "" } } };
    const result = computeLegalDocumentLocaleBackfill(current, config);
    expect(result?.legalSections.a).toEqual({ title: "Admin's own title", body: "Default A body." });
  });

  it("returns null (no-op) once every field already has real content — idempotent", () => {
    const current = {
      legalSections: {
        a: { title: "A title", body: "A body." },
        b: { title: "B title", body: "B body." },
      },
      legalIntro: "Intro.",
      legalLastUpdated: "21 September 2026",
    };
    expect(computeLegalDocumentLocaleBackfill(current, config)).toBeNull();
  });

  it("acceptance criteria: a fully-saved document is unaffected when the shipped template changes later", () => {
    const savedYesterday = {
      legalSections: {
        a: { title: "A title", body: "A body." },
        b: { title: "B title", body: "B body." },
      },
      legalIntro: "Intro.",
      legalLastUpdated: "21 September 2026",
    };
    const tomorrowsTemplate: LocaleDocConfig = {
      ...config,
      sectionDefaults: {
        a: { title: "COMPLETELY REWRITTEN default", body: "New shipped copy for section A." },
        b: { title: "Also rewritten", body: "New shipped copy for section B." },
      },
      introDefault: "A brand new intro default.",
    };
    expect(computeLegalDocumentLocaleBackfill(savedYesterday, tomorrowsTemplate)).toBeNull();
  });
});
