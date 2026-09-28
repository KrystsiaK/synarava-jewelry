import { describe, expect, it } from "vitest";

import { buildFaqJsonLd } from "../faq-json-ld";

describe("buildFaqJsonLd", () => {
  it("builds FAQPage entities from visible title/body pairs", () => {
    expect(buildFaqJsonLd([
      { title: "Where do I pay?", body: "<p>Secure checkout.</p>" },
      { title: "  ", body: "Ignored empty question" },
      { title: "Can I ask first?", body: "" },
    ])).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Where do I pay?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Secure checkout.",
          },
        },
      ],
    });
  });

  it("returns null when no complete Q/A pairs are available", () => {
    expect(buildFaqJsonLd([{ title: "", body: "Only answer" }])).toBeNull();
  });
});
