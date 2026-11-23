import { describe, expect, it } from "vitest";

import {
  dropNearDuplicateIdeas,
  formatPriorIdeasPromptSection,
  normalizeHookText,
  summarizePriorIdea,
  takePriorIdeas,
  tokenOverlapRatio,
} from "@/lib/marketing/ideas/memory";

describe("prior ideas memory", () => {
  it("caps prior ideas at 30", () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ id: String(i) }));
    expect(takePriorIdeas(rows, 30)).toHaveLength(30);
  });

  it("formats prior ideas with rejected marker", () => {
    const section = formatPriorIdeasPromptSection([
      summarizePriorIdea({
        id: "1",
        status: "rejected",
        hook: { en: "Gold glow", pt: "Brilho dourado" },
        script: "Локация: кафе",
        shotList: ["руки"],
        caption: { en: "c", pt: "c" },
        productIds: ["p1"],
      }),
      summarizePriorIdea({
        id: "2",
        status: "approved",
        hook: { en: "Soft stack", pt: "Stack suave" },
        script: "Утро у окна",
        shotList: [],
        caption: { en: "c", pt: "c" },
        productIds: ["p1"],
      }),
    ]);
    expect(section).toContain("Already planned — do NOT repeat hooks, locations or angles");
    expect(section).toContain("owner rejected — avoid this direction");
    expect(section).toContain("Gold glow");
    expect(section).toContain("Soft stack");
  });
});

describe("near-duplicate hooks", () => {
  it("detects exact normalized match", () => {
    expect(normalizeHookText("  Soft Stack! ")).toBe("soft stack");
  });

  it("drops ≥90% token overlap against prior", () => {
    const result = dropNearDuplicateIdeas({
      ideas: [
        {
          hook: {
            en: "soft stack beads on wrist",
            pt: "outro",
          },
        },
      ],
      priorHooks: [
        { en: "soft stack beads on wrist today", pt: "" },
      ],
    });
    expect(result.ideas).toEqual([]);
    expect(result.warnings.some((w) => /near-duplicate/.test(w))).toBe(true);
    expect(
      tokenOverlapRatio(
        "soft stack beads on wrist",
        "soft stack beads on wrist today",
      ),
    ).toBeGreaterThanOrEqual(0.9);
  });

  it("keeps distinct hooks", () => {
    const result = dropNearDuplicateIdeas({
      ideas: [
        { hook: { en: "Morning light on glass beads", pt: "Luz da manhã" } },
      ],
      priorHooks: [{ en: "Cafe table stack", pt: "Mesa de café" }],
    });
    expect(result.ideas).toHaveLength(1);
    expect(result.warnings).toEqual([]);
  });
});
