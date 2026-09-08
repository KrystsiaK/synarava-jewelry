import { describe, expect, it } from "vitest";

import { isProtectedPage, pageActionCopy, pageStatusLabel } from "@/components/admin/pages/page-helpers";
import type { SavedPagePayload } from "@/app/admin/actions/pages";

function makePage(overrides: Partial<SavedPagePayload> = {}): SavedPagePayload {
  return {
    id: "page-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-02"),
    slug: "journal",
    title: "Journal",
    excerpt: null,
    content: null,
    status: "DRAFT",
    visibility: "PRIVATE",
    ...overrides,
  };
}

describe("pageStatusLabel", () => {
  it("labels archived pages as ARCHIVED regardless of visibility", () => {
    expect(pageStatusLabel(makePage({ status: "ARCHIVED", visibility: "PUBLIC" }))).toBe("ARCHIVED");
  });

  it("labels published+public pages as PUBLISHED", () => {
    expect(pageStatusLabel(makePage({ status: "PUBLISHED", visibility: "PUBLIC" }))).toBe("PUBLISHED");
  });

  it("falls back to DRAFT for published-but-private pages", () => {
    expect(pageStatusLabel(makePage({ status: "PUBLISHED", visibility: "PRIVATE" }))).toBe("DRAFT");
  });
});

describe("isProtectedPage", () => {
  it("protects the built-in home, about, and manifesto slugs", () => {
    expect(isProtectedPage("home")).toBe(true);
    expect(isProtectedPage("about")).toBe(true);
    expect(isProtectedPage("manifesto")).toBe(true);
  });

  it("does not protect custom slugs", () => {
    expect(isProtectedPage("journal")).toBe(false);
  });
});

describe("pageActionCopy", () => {
  it("returns danger tone for archive and default tone otherwise", () => {
    const page = makePage({ title: "Journal" });
    expect(pageActionCopy({ page, action: "archive" }).tone).toBe("danger");
    expect(pageActionCopy({ page, action: "publish" }).tone).toBe("default");
    expect(pageActionCopy({ page, action: "draft" }).title).toContain("Journal");
  });
});
