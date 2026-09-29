import { describe, expect, it } from "vitest";

import { richResultsTestUrl, seoCoverageTone } from "../meta-health-shared";

describe("seoCoverageTone", () => {
  it("maps published SEO title coverage to checklist tones", () => {
    expect(seoCoverageTone({ published: 0, missingSeoTitle: 0 })).toBe("empty");
    expect(seoCoverageTone({ published: 4, missingSeoTitle: 0 })).toBe("ok");
    expect(seoCoverageTone({ published: 4, missingSeoTitle: 2 })).toBe("partial");
    expect(seoCoverageTone({ published: 4, missingSeoTitle: 4 })).toBe("warn");
  });
});

describe("richResultsTestUrl", () => {
  it("builds a Google Rich Results Test deep-link", () => {
    expect(richResultsTestUrl("https://synarava.com/en/products/ring")).toBe(
      "https://search.google.com/test/rich-results?url=https%3A%2F%2Fsynarava.com%2Fen%2Fproducts%2Fring",
    );
  });
});
