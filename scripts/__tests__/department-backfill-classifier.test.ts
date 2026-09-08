import { describe, expect, it } from "vitest";

import { classifyDepartment } from "../department-backfill-classifier.mjs";

describe("department collection backfill", () => {
  it("preserves a valid legacy department", () => {
    expect(classifyDepartment({
      details: { department: "pets" },
      shopifyCategoryName: null,
      name: "Pendant",
      seriesLabel: null,
      category: null,
      tags: [],
    })).toBe("pets");
  });

  it("ignores an invalid legacy value and falls back to classification", () => {
    expect(classifyDepartment({
      details: { department: "unknown-section" },
      shopifyCategoryName: "Animals & Pet Supplies > Pet Collars",
      name: "Collar",
      seriesLabel: null,
      category: null,
      tags: [],
    })).toBe("pets");
  });
});
