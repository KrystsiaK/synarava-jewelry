import { describe, expect, it } from "vitest";

import {
  plannedForFromWeekSlot,
  validateMarketingIdeas,
} from "@/lib/marketing/ideas/validate";
import type { MarketSignal } from "@/lib/marketing/signals";

const signal: MarketSignal = {
  id: "web:obs1",
  source: "website",
  kind: "product_observation",
  brand: "Aurora",
  url: "https://aurorajoalharia.com/products/x",
  observedAt: "2026-11-23T00:00:00.000Z",
  change: "changed",
  summary: "Competitor steel bracelet 22 EUR",
  data: { material: "steel" },
};

describe("validateMarketingIdeas", () => {
  it("drops unknown productId", () => {
    const result = validateMarketingIdeas({
      rawIdeas: {
        ideas: [
          {
            locale: "en",
            productIds: ["missing"],
            signalIds: [],
            hook: "h",
            script: "s",
            shotList: ["a"],
            caption: "c",
            weekSlot: 1,
          },
        ],
      },
      allowedProductIds: new Set(["p1"]),
      allowedSignalIds: new Set(),
      productFactsCorpus: new Map([["p1", "gold tone bracelet"]]),
      signals: [],
    });
    expect(result.ideas).toEqual([]);
    expect(result.warnings.some((w) => /unknown productId/.test(w))).toBe(true);
  });

  it("drops unknown signalId", () => {
    const result = validateMarketingIdeas({
      rawIdeas: {
        ideas: [
          {
            locale: "en",
            productIds: ["p1"],
            signalIds: ["web:nope"],
            hook: "h",
            script: "s",
            shotList: ["a"],
            caption: "c",
            weekSlot: 2,
          },
        ],
      },
      allowedProductIds: new Set(["p1"]),
      allowedSignalIds: new Set(["web:obs1"]),
      productFactsCorpus: new Map([["p1", "gold tone bracelet"]]),
      signals: [signal],
    });
    expect(result.ideas).toEqual([]);
    expect(result.warnings.some((w) => /unknown signalId/.test(w))).toBe(true);
  });

  it('drops invented claim "925 sterling" absent from facts', () => {
    const result = validateMarketingIdeas({
      rawIdeas: {
        ideas: [
          {
            locale: "en",
            productIds: ["p1"],
            signalIds: [],
            hook: "925 sterling shine",
            script: "Made of 925 sterling silver",
            shotList: ["close-up"],
            caption: "925",
            weekSlot: 1,
          },
        ],
      },
      allowedProductIds: new Set(["p1"]),
      allowedSignalIds: new Set(),
      productFactsCorpus: new Map([["p1", "gold-tone fashion bracelet beads"]]),
      signals: [],
    });
    expect(result.ideas).toEqual([]);
    expect(result.warnings.some((w) => /925|sterling/i.test(w))).toBe(true);
  });

  it("keeps valid idea", () => {
    const result = validateMarketingIdeas({
      rawIdeas: {
        ideas: [
          {
            locale: "pt",
            productIds: ["p1"],
            signalIds: ["web:obs1"],
            hook: "Pulseira dourada",
            script: "Gold-tone beads for everyday",
            shotList: ["mão", "detalhe"],
            caption: "Synarava",
            weekSlot: 3,
          },
        ],
      },
      allowedProductIds: new Set(["p1"]),
      allowedSignalIds: new Set(["web:obs1"]),
      productFactsCorpus: new Map([["p1", "gold-tone beaded bracelet"]]),
      signals: [signal],
    });
    expect(result.ideas).toHaveLength(1);
    expect(result.ideas[0]?.weekSlot).toBe(3);
  });
});

describe("plannedForFromWeekSlot", () => {
  it("maps slots into the next 4 weeks", () => {
    const now = new Date("2026-11-23T10:00:00.000Z");
    const w1 = plannedForFromWeekSlot(1, now);
    const w4 = plannedForFromWeekSlot(4, now);
    expect(w1.getTime()).toBeLessThan(w4.getTime());
    expect(w4.getTime() - now.getTime()).toBeLessThan(30 * 24 * 60 * 60 * 1000);
  });
});
