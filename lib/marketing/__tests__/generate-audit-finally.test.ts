import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  productFindMany: vi.fn(),
  observationFindMany: vi.fn(),
  contentIdeaCreate: vi.fn(),
  contentIdeaCreateMany: vi.fn(),
  auditLogCreate: vi.fn(),
  auditLogFindMany: vi.fn(),
  checkRateLimit: vi.fn(),
  assertBudget: vi.fn(),
  provider: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    product: { findMany: mocks.productFindMany },
    competitorObservation: { findMany: mocks.observationFindMany },
    contentIdea: {
      create: mocks.contentIdeaCreate,
      createMany: mocks.contentIdeaCreateMany,
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: mocks.auditLogCreate,
      findMany: mocks.auditLogFindMany,
    },
    $transaction: mocks.$transaction,
  },
}));

vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock("@/lib/ai/product-content/budget", () => ({
  assertMonthlyBudgetAvailable: mocks.assertBudget,
  sumMonthlyAiSpendUsd: vi.fn(),
  writeAiGenerationAudit: vi.fn(),
}));

vi.mock("@/lib/ai/config", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/config")>(
    "@/lib/ai/config",
  );
  return {
    ...actual,
    isAiContentEnabled: () => true,
  };
});

vi.mock("@/lib/ai/product-content/provider", () => ({
  ContentProviderNotConfiguredError: class extends Error {
    code = "not_configured";
  },
  getContentProvider: () => mocks.provider,
  setContentProviderForTests: vi.fn(),
}));

vi.mock("@/lib/products/shopify-product-specs", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/products/shopify-product-specs")>();
  return {
    ...actual,
    shopifyProductSpecValuesFromWindows: () => ({}),
  };
});

import { AI_MARKETING_IDEAS_AUDIT_ACTION } from "@/lib/ai/config";
import { generateMarketingIdeas } from "@/lib/marketing/ideas/generate";

describe("fix8 usage audit survives ContentIdea create failure", () => {
  beforeEach(() => {
    mocks.checkRateLimit.mockResolvedValue({ ok: true });
    mocks.assertBudget.mockResolvedValue({ ok: true });
    mocks.observationFindMany.mockResolvedValue([]);
    mocks.auditLogCreate.mockResolvedValue({});
    mocks.productFindMany.mockResolvedValue([
      {
        id: "p1",
        name: "Beaded Bracelet",
        productType: null,
        materialLine: "glass beads",
        shortDescription: "beaded bracelet with glass beads",
        description: null,
        seoTitle: null,
        seoDescription: null,
        symbolismLabel: null,
        symbolismTitle: null,
        symbolismBody: null,
        symbolismBody2: null,
        details: null,
        extras: null,
        shopifySnapshot: null,
        characteristics: [],
        collections: [],
        translations: [],
      },
    ]);
    mocks.provider.mockResolvedValue({
      json: {
        ideas: [
          {
            productIds: ["p1"],
            signalIds: [],
            whyRu: "Идея опирается на бусины из фактов.",
            hook: { en: "Glass beads glow", pt: "Contas de vidro" },
            script: "Локация: стол\nПоказать браслет",
            shotList: ["wrist"],
            caption: { en: "Synarava", pt: "Synarava" },
            weekSlot: 1,
          },
        ],
      },
      usage: {
        model: "gemini-3.1-flash-lite",
        inputTokens: 10,
        outputTokens: 20,
        latencyMs: 5,
      },
    });
    mocks.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        contentIdea: {
          create: vi.fn().mockRejectedValue(new Error("db create failed")),
        },
      };
      return fn(tx);
    });
  });

  it("writes usage AuditLog in finally when idea create fails", async () => {
    const result = await generateMarketingIdeas({
      productIds: ["p1"],
      actor: { username: "admin", sessionId: "sess" },
    });
    expect(result.ok).toBe(false);
    expect(mocks.auditLogCreate).toHaveBeenCalled();
    const actions = mocks.auditLogCreate.mock.calls.map(
      (c: Array<{ data: { action: string } }>) => c[0]!.data.action,
    );
    expect(actions).toContain(AI_MARKETING_IDEAS_AUDIT_ACTION);
  });

  it("persists validated manual notes in usage AuditLog metadata", async () => {
    mocks.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        contentIdea: {
          create: vi.fn().mockResolvedValue({
            id: "idea1",
            plannedFor: new Date("2026-11-24T12:00:00.000Z"),
          }),
        },
      };
      return fn(tx);
    });

    const result = await generateMarketingIdeas({
      productIds: ["p1"],
      manualNotes: [
        { url: "https://example.com/ad", text: "Meta Ad Library note" },
      ],
      actor: { username: "admin", sessionId: "sess" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toContain("only 1 valid ideas");
    expect(result.usage.costUsd).toBeGreaterThanOrEqual(0);
    const meta = mocks.auditLogCreate.mock.calls.at(-1)![0].data.metadata as {
      manualNotes: Array<{ signalId: string; url: string; text: string }>;
    };
    expect(meta.manualNotes).toHaveLength(1);
    expect(meta.manualNotes[0]?.url).toBe("https://example.com/ad");
    expect(meta.manualNotes[0]?.text).toBe("Meta Ad Library note");
    expect(meta.manualNotes[0]?.signalId).toMatch(/^manual:/);
  });
});

