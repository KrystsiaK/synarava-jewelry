import { describe, expect, it } from "vitest";

import { buildBrandSummaries } from "@/lib/marketing/export/summary";

describe("buildBrandSummaries", () => {
  it("computes productsSeen and price stats", () => {
    const now = new Date("2026-11-23T12:00:00.000Z");
    const rows = buildBrandSummaries(
      [
        {
          brand: "Aurora",
          domain: "aurorajoalharia.com",
          url: "https://a/1",
          kind: "initial",
          price: 10,
          fetchedAt: "2026-11-20T12:00:00.000Z",
        },
        {
          brand: "Aurora",
          domain: "aurorajoalharia.com",
          url: "https://a/2",
          kind: "changed",
          price: 30,
          fetchedAt: "2026-11-21T12:00:00.000Z",
        },
        {
          brand: "Aurora",
          domain: "aurorajoalharia.com",
          url: "https://a/1",
          kind: "changed",
          price: 20,
          fetchedAt: "2026-11-22T12:00:00.000Z",
        },
        {
          brand: "Aurora",
          domain: "aurorajoalharia.com",
          url: "https://a/3",
          kind: "removed",
          price: null,
          fetchedAt: "2026-11-22T12:00:00.000Z",
        },
      ],
      now,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      productsSeen: 3,
      minPrice: 10,
      medianPrice: 20,
      maxPrice: 30,
      changedLast30: 2,
      removedLast30: 1,
    });
  });
});
