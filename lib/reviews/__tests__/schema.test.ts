import { describe, expect, it } from "vitest";

import { productReviewSubmitSchema } from "@/lib/reviews/schema";

describe("productReviewSubmitSchema", () => {
  it("accepts a valid submission", () => {
    const result = productReviewSubmitSchema.safeParse({
      productSlug: "lava-ring",
      rating: "5",
      title: "Beautiful",
      body: "Even better in person.",
      locale: "en",
      authorName: "Ana Silva",
      authorEmail: "ana@example.com",
      company: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects rating outside 1–5 and short body", () => {
    const result = productReviewSubmitSchema.safeParse({
      productSlug: "lava-ring",
      rating: "9",
      title: "",
      body: "short",
      locale: "en",
      authorName: "Ana",
      authorEmail: "ana@example.com",
    });
    expect(result.success).toBe(false);
  });

  it("requires name and email", () => {
    const result = productReviewSubmitSchema.safeParse({
      productSlug: "lava-ring",
      rating: "4",
      authorName: "",
      authorEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("allows star-only rating with empty body", () => {
    const result = productReviewSubmitSchema.safeParse({
      productSlug: "lava-ring",
      rating: "3",
      title: "",
      body: "",
      locale: "pt",
      authorName: "Ana Silva",
      authorEmail: "ana@example.com",
    });
    expect(result.success).toBe(true);
  });
});
