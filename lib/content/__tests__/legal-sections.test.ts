import { describe, expect, it } from "vitest";

import { isSavedLegalDocument, resolveLegalSections, resolveLegalText } from "@/lib/content/legal-sections";

const sections = [
  { id: "a", label: "1. A" },
  { id: "b", label: "2. B" },
];
const defaults = {
  a: { title: "Default A title", body: "Default A body for {name}." },
  b: { title: "Default B title", body: "Default B body." },
};

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
  // Mirrors exactly what each of app/[locale]/{privacy,offer,terms-and-conditions,legal-notice}/page.tsx
  // does: resolve against real defaults only while the document doesn't exist yet; once it does,
  // resolve against {} instead, so a field that's actually empty renders empty rather than
  // silently reverting to whatever the shipped copy says today.
  function renderSections(page: unknown, savedContent: Record<string, { title?: string; body?: string }> | undefined, shippedDefaults: typeof defaults) {
    const exists = isSavedLegalDocument(page);
    return resolveLegalSections(sections, savedContent, exists ? {} : shippedDefaults);
  }

  it("a document that has never been created still shows the shipped default", () => {
    expect(renderSections(null, undefined, defaults)[0].body).toBe("Default A body for {name}.");
  });

  it("acceptance criteria: once saved, admin content survives a later shipped-default change — including a section the admin left blank rendering empty, not the new default", () => {
    const page = { title: "Privacy Policy" };
    const savedYesterday = { a: { title: "Admin's title", body: "Admin's body." } }; // section "b" was never saved
    const tomorrowsShippedDefaults = {
      a: { title: "REWRITTEN", body: "Completely different shipped copy." },
      b: { title: "Also rewritten", body: "New shipped copy for b." },
    };

    const result = renderSections(page, savedYesterday, tomorrowsShippedDefaults);

    // Admin's own saved text for "a" is byte-for-byte unaffected by the rewritten default.
    expect(result[0]).toEqual({ id: "a", label: "1. A", title: "Admin's title", body: "Admin's body." });
    // "b" was never saved — it renders empty, not the (rewritten) default. That's the
    // explicit tradeoff: once the document exists, empty means empty.
    expect(result[1]).toEqual({ id: "b", label: "2. B", title: "", body: "" });
  });
});
