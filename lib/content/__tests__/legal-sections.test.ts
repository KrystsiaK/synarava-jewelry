import { describe, expect, it } from "vitest";

import {
  buildLegalSectionEntries,
  isSavedLegalDocument,
  mergeLocalizedLegalSections,
  normalizeLegalSectionEntries,
  resolveDocumentSections,
  resolveLegalSections,
  resolveLegalText,
  seedLegalSectionEntries,
  uniqueLegalSectionId,
} from "@/lib/content/legal-sections";

const sections = [
  { id: "a", label: "1. A" },
  { id: "b", label: "2. B" },
];
const defaults = {
  a: { title: "Default A title", body: "Default A body for {name}." },
  b: { title: "Default B title", body: "Default B body." },
};
const shipped = buildLegalSectionEntries(sections, defaults);

describe("resolveLegalSections", () => {
  it("falls back to the shipped default when content is empty", () => {
    const result = resolveLegalSections(sections, undefined, defaults, { name: "Synarava" });
    expect(result).toEqual([
      { id: "a", label: "1. A", title: "Default A title", body: "Default A body for Synarava." },
      { id: "b", label: "2. B", title: "Default B title", body: "Default B body." },
    ]);
  });

  it("uses an admin override when present, falling back field by field", () => {
    const result = resolveLegalSections(
      sections,
      { a: { title: "Custom title", body: "" }, b: { body: "Custom body" } },
      defaults,
    );
    expect(result[0]).toEqual({ id: "a", label: "1. A", title: "Custom title", body: "Default A body for {name}." });
    expect(result[1]).toEqual({ id: "b", label: "2. B", title: "Default B title", body: "Custom body" });
  });

  it("treats a whitespace-only override as empty (falls back to default)", () => {
    const result = resolveLegalSections(sections, { a: { title: "   ", body: "  " } }, defaults);
    expect(result[0]).toEqual({ id: "a", label: "1. A", title: "Default A title", body: "Default A body for {name}." });
  });

  it("interpolates {vars} in both the override and the default", () => {
    const result = resolveLegalSections(
      sections,
      { a: { body: "Hello {name}!" } },
      defaults,
      { name: "World" },
    );
    expect(result[0].body).toBe("Hello World!");
  });

  it("renders an admin-owned array without the fixed skeleton", () => {
    const result = resolveLegalSections(
      sections,
      [{ id: "custom", label: "X. Custom", title: "Hello", body: "World" }],
      defaults,
    );
    expect(result).toEqual([{ id: "custom", label: "X. Custom", title: "Hello", body: "World" }]);
  });
});

describe("resolveDocumentSections", () => {
  it("uses shipped defaults while the document is not saved", () => {
    expect(resolveDocumentSections(undefined, shipped, false, { name: "Synarava" })[0].body)
      .toBe("Default A body for Synarava.");
  });

  it("treats a saved array as authoritative, including empty lists", () => {
    expect(resolveDocumentSections([], shipped, true)).toEqual([]);
    expect(resolveDocumentSections(
      [{ id: "only", label: "1. Only", title: "T", body: "B" }],
      shipped,
      true,
    )).toEqual([{ id: "only", label: "1. Only", title: "T", body: "B" }]);
  });

  it("keeps empty legacy fields empty once saved (no silent default revive)", () => {
    const result = resolveDocumentSections(
      { a: { title: "Admin's title", body: "Admin's body." } },
      shipped,
      true,
    );
    expect(result[0]).toEqual({ id: "a", label: "1. A", title: "Admin's title", body: "Admin's body." });
    expect(result[1]).toEqual({ id: "b", label: "2. B", title: "", body: "" });
  });
});

describe("normalize / seed helpers", () => {
  it("seeds missing content from shipped defaults for the admin editor", () => {
    expect(seedLegalSectionEntries(undefined, shipped)).toEqual(shipped);
  });

  it("keeps an explicit empty array empty", () => {
    expect(seedLegalSectionEntries([], shipped)).toEqual([]);
  });

  it("normalizes a legacy record onto the shipped skeleton", () => {
    expect(normalizeLegalSectionEntries({ a: { title: "T", body: "B" } }, shipped)).toEqual([
      { id: "a", label: "1. A", title: "T", body: "B" },
      { id: "b", label: "2. B", title: "", body: "" },
    ]);
  });

  it("builds unique section ids from labels", () => {
    expect(uniqueLegalSectionId("1. Data Controller", [])).toBe("data-controller");
    expect(uniqueLegalSectionId("Data Controller", ["data-controller"])).toBe("data-controller-2");
  });
});

describe("mergeLocalizedLegalSections", () => {
  it("overlays translation fields onto an ordered source array", () => {
    expect(mergeLocalizedLegalSections(
      [
        { id: "a", label: "1. A", title: "EN A", body: "Body A" },
        { id: "b", label: "2. B", title: "EN B", body: "Body B" },
      ],
      [{ id: "a", label: "1. A PT", title: "PT A", body: "" }],
    )).toEqual([
      { id: "a", label: "1. A PT", title: "PT A", body: "Body A" },
      { id: "b", label: "2. B", title: "EN B", body: "Body B" },
    ]);
  });
});

describe("resolveLegalText", () => {
  it("falls back to the default and interpolates vars", () => {
    expect(resolveLegalText(undefined, "Hi {name}", { name: "Synarava" })).toBe("Hi Synarava");
    expect(resolveLegalText("  ", "Hi {name}", { name: "Synarava" })).toBe("Hi Synarava");
    expect(resolveLegalText("Custom", "Hi {name}", { name: "Synarava" })).toBe("Custom");
  });
});

describe("isSavedLegalDocument", () => {
  it("is false when getPageBySlug found nothing (not yet created, or unpublished)", () => {
    expect(isSavedLegalDocument(null)).toBe(false);
    expect(isSavedLegalDocument(undefined)).toBe(false);
  });

  it("is true once a page row exists", () => {
    expect(isSavedLegalDocument({ title: "Privacy Policy" })).toBe(true);
  });
});

describe("Legal Document page pattern: admin content survives a shipped-default change", () => {
  function renderSections(page: unknown, savedContent: unknown, shippedDefaults: typeof shipped) {
    return resolveDocumentSections(savedContent, shippedDefaults, isSavedLegalDocument(page));
  }

  it("a document that has never been created still shows the shipped default", () => {
    expect(renderSections(null, undefined, shipped)[0].body).toBe("Default A body for {name}.");
  });

  it("acceptance criteria: once saved, admin content survives a later shipped-default change — including a section the admin left blank rendering empty, not the new default", () => {
    const page = { title: "Privacy Policy" };
    const savedYesterday = { a: { title: "Admin's title", body: "Admin's body." } };
    const tomorrowsShipped = buildLegalSectionEntries(sections, {
      a: { title: "REWRITTEN", body: "Completely different shipped copy." },
      b: { title: "Also rewritten", body: "New shipped copy for b." },
    });

    const result = renderSections(page, savedYesterday, tomorrowsShipped);

    expect(result[0]).toEqual({ id: "a", label: "1. A", title: "Admin's title", body: "Admin's body." });
    expect(result[1]).toEqual({ id: "b", label: "2. B", title: "", body: "" });
  });
});
