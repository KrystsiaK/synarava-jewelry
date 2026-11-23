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

function validIdea(overrides: Record<string, unknown> = {}) {
  return {
    productIds: ["p1"],
    signalIds: [] as string[],
    whyRu: "Идея опирается на бусины из фактов продукта.",
    hook: { en: "Soft stack", pt: "Stack suave" },
    script: "Локация: кафе\nПоказать браслет на запястье.",
    shotList: ["запястье", "деталь бусин"],
    caption: { en: "Synarava beads", pt: "Contas Synarava" },
    weekSlot: 1,
    ...overrides,
  };
}

describe("validateMarketingIdeas", () => {
  it("requires RU owner fields and en+pt hook/caption", () => {
    const ok = validateMarketingIdeas({
      rawIdeas: { ideas: [validIdea()] },
      allowedProductIds: new Set(["p1"]),
      allowedSignalIds: new Set(),
      productFactsCorpus: new Map([["p1", "gold-tone beaded bracelet"]]),
      signals: [],
    });
    expect(ok.ideas).toHaveLength(1);
    expect(ok.ideas[0]?.whyRu).toContain("бусины");
    expect(ok.ideas[0]?.hook).toEqual({ en: "Soft stack", pt: "Stack suave" });
    expect(ok.ideas[0]?.caption.pt).toBe("Contas Synarava");
    expect(ok.ideas[0]?.script).toContain("Локация");

    const missingPt = validateMarketingIdeas({
      rawIdeas: {
        ideas: [validIdea({ hook: { en: "Only EN", pt: "" } })],
      },
      allowedProductIds: new Set(["p1"]),
      allowedSignalIds: new Set(),
      productFactsCorpus: new Map([["p1", "gold-tone beaded bracelet"]]),
      signals: [],
    });
    expect(missingPt.ideas).toEqual([]);
    expect(missingPt.warnings.some((w) => /hook\.en and hook\.pt/.test(w))).toBe(
      true,
    );
  });

  it("drops unknown productId", () => {
    const result = validateMarketingIdeas({
      rawIdeas: { ideas: [validIdea({ productIds: ["missing"] })] },
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
        ideas: [validIdea({ signalIds: ["web:nope"], weekSlot: 2 })],
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
          validIdea({
            hook: { en: "925 sterling shine", pt: "Brilho 925" },
            script: "Made of 925 sterling silver",
            caption: { en: "925", pt: "925" },
          }),
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

  it("drops RU claim terms when not in product facts", () => {
    const result = validateMarketingIdeas({
      rawIdeas: {
        ideas: [
          validIdea({
            whyRu: "Потому что это серебро 925 с пробой и позолотой.",
            script: "Показать золото и серебро крупным планом.",
          }),
        ],
      },
      allowedProductIds: new Set(["p1"]),
      allowedSignalIds: new Set(),
      productFactsCorpus: new Map([["p1", "gold-tone fashion bracelet beads"]]),
      signals: [],
    });
    expect(result.ideas).toEqual([]);
    expect(
      result.warnings.some((w) =>
        /серебро|золото|925|проба|позолота/i.test(w),
      ),
    ).toBe(true);
  });

  it("keeps valid bilingual idea", () => {
    const result = validateMarketingIdeas({
      rawIdeas: {
        ideas: [
          validIdea({
            signalIds: ["web:obs1"],
            weekSlot: 3,
          }),
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

  it("drops claim present only in cited signal (no product-facts leak)", () => {
    const silverSignal: MarketSignal = {
      ...signal,
      id: "web:obs-silver",
      summary: "plata 925 sterling silver",
      data: { material: "925 sterling silver" },
    };
    const result = validateMarketingIdeas({
      rawIdeas: {
        ideas: [
          validIdea({
            signalIds: ["web:obs-silver"],
            hook: {
              en: "Our bracelet is 925 sterling silver",
              pt: "Pulseira 925",
            },
          }),
        ],
      },
      allowedProductIds: new Set(["p1"]),
      allowedSignalIds: new Set(["web:obs-silver"]),
      productFactsCorpus: new Map([
        ["p1", "beaded bracelet with glass beads"],
      ]),
      signals: [silverSignal],
    });
    expect(result.ideas).toEqual([]);
    expect(result.warnings.some((w) => /925|sterling/i.test(w))).toBe(true);
  });

  it("drops near-duplicate against prior ideas with warning", () => {
    const result = validateMarketingIdeas({
      rawIdeas: {
        ideas: [
          validIdea({
            hook: {
              en: "soft stack beads on wrist",
              pt: "stack suave nas contas",
            },
          }),
        ],
      },
      allowedProductIds: new Set(["p1"]),
      allowedSignalIds: new Set(),
      productFactsCorpus: new Map([["p1", "gold-tone beaded bracelet"]]),
      signals: [],
      priorIdeas: [
        {
          id: "old",
          status: "approved",
          hooks: { en: "soft stack beads on wrist today", pt: "" },
          script: "old",
          rejected: false,
        },
      ],
    });
    expect(result.ideas).toEqual([]);
    expect(result.warnings.some((w) => /near-duplicate/.test(w))).toBe(true);
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
