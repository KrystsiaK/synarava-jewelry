import { describe, expect, it } from "vitest";

import { resolveLegalSections, resolveLegalText } from "@/lib/content/legal-sections";

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
