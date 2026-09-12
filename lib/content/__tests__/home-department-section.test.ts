import { describe, expect, it } from "vitest";

import { resolveHomeDepartmentSection } from "@/lib/content/home-department-section";

describe("resolveHomeDepartmentSection", () => {
  it("hides a section that has not been enabled", () => {
    expect(resolveHomeDepartmentSection({
      departmentSectionTitle: "Choose where to begin.",
      departmentSectionBody: "A considered way into the collection.",
    }, true)).toBeNull();
  });

  it("hides an incomplete section", () => {
    expect(resolveHomeDepartmentSection({
      departmentSectionEnabled: true,
      departmentSectionTitle: "Choose where to begin.",
    }, true)).toBeNull();
  });

  it("hides the section when there are no departments to show", () => {
    expect(resolveHomeDepartmentSection({
      departmentSectionEnabled: true,
      departmentSectionTitle: "Choose where to begin.",
      departmentSectionBody: "A considered way into the collection.",
    }, false)).toBeNull();
  });

  it("returns trimmed configured copy and keeps optional fields optional", () => {
    expect(resolveHomeDepartmentSection({
      departmentSectionEnabled: true,
      departmentSectionTitle: "  Choose where to begin. ",
      departmentSectionBody: " A considered way into the collection. ",
      departmentSectionImageCaption: "  One point of view. ",
      departmentSectionCtaLabel: " Explore the shop ",
    }, true)).toEqual({
      title: "Choose where to begin.",
      body: "A considered way into the collection.",
      imageCaption: "One point of view.",
      ctaLabel: "Explore the shop",
    });
  });
});
