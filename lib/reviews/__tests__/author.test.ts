import { describe, expect, it } from "vitest";

import { normalizeReviewEmail, publicAuthorName } from "@/lib/reviews/author";

describe("publicAuthorName", () => {
  it("formats first name + last initial", () => {
    expect(publicAuthorName("Ana Silva")).toBe("Ana S.");
    expect(publicAuthorName("Ana")).toBe("Ana");
    expect(publicAuthorName("  ")).toBe("Customer");
  });
});

describe("normalizeReviewEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeReviewEmail("  Ana@Example.COM ")).toBe("ana@example.com");
  });
});
