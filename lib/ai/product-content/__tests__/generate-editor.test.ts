import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  productFindUnique: vi.fn(),
  auditLogFindMany: vi.fn(),
  auditLogCreate: vi.fn(),
  contentProvider: vi.fn(),
}));

vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock("@/lib/db", () => ({
  db: {
    product: { findUnique: mocks.productFindUnique },
    auditLog: {
      findMany: mocks.auditLogFindMany,
      create: mocks.auditLogCreate,
    },
  },
}));

vi.mock("@/lib/ai/product-content/provider", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/product-content/provider")>(
    "@/lib/ai/product-content/provider",
  );
  return {
    ...actual,
    getContentProvider: () => mocks.contentProvider,
  };
});

import { generateProductContent } from "@/lib/ai/product-content/generate";

const actor = { username: "admin", sessionId: "sess_1" };

const productRow = {
  id: "prod_1",
  name: "River Ring",
  productType: "Ring",
  materialLine: "925 sterling silver",
  shortDescription: null,
  description: null,
  seoTitle: null,
  seoDescription: null,
  details: {},
  updatedAt: new Date("2026-11-01T00:00:00.000Z"),
  characteristics: [
    {
      key: "material",
      label: "Material",
      textValue: "925 sterling silver",
      numberValue: null,
      booleanValue: null,
      unit: null,
    },
  ],
  collections: [],
  translations: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AI_CONTENT_ENABLED = "true";
  process.env.AI_MONTHLY_BUDGET_USD = "5";
  process.env.AI_CONTENT_MODEL = "gemini-3.1-flash-lite";
  delete process.env.AI_EDITOR_PASS;
  mocks.checkRateLimit.mockResolvedValue({ ok: true });
  mocks.auditLogFindMany.mockResolvedValue([]);
  mocks.auditLogCreate.mockResolvedValue({ id: "a1" });
  mocks.productFindUnique.mockResolvedValue(productRow);
});

describe("generateProductContent editor pass (item 10)", () => {
  it("editor changes a number → unsupported number warning; usages summed; one AuditLog", async () => {
    mocks.contentProvider
      .mockResolvedValueOnce({
        json: {
          locales: {
            en: { shortDescription: "Quiet silver ring." },
          },
        },
        usage: {
          model: "gemini-3.1-flash-lite",
          inputTokens: 100,
          outputTokens: 40,
          latencyMs: 10,
        },
      })
      .mockResolvedValueOnce({
        json: {
          locales: {
            en: { shortDescription: "Quiet silver ring, 17 mm." },
          },
        },
        usage: {
          model: "gemini-3.1-flash-lite",
          inputTokens: 120,
          outputTokens: 45,
          latencyMs: 12,
        },
      });

    const result = await generateProductContent({
      productId: "prod_1",
      locales: ["en"],
      actor,
      editorPass: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.locales.en?.shortDescription).toContain("17 mm");
    expect(
      result.draft.warnings.some((w) => /unsupported number/i.test(w.message)),
    ).toBe(true);
    expect(result.draft.usage.inputTokens).toBe(220);
    expect(result.draft.usage.outputTokens).toBe(85);
    expect(result.draft.usage.latencyMs).toBe(22);
    expect(mocks.contentProvider).toHaveBeenCalledTimes(2);
    expect(mocks.auditLogCreate).toHaveBeenCalledOnce();
    const meta = mocks.auditLogCreate.mock.calls[0]![0].data.metadata as {
      inputTokens: number;
      outputTokens: number;
      outcome: string;
    };
    expect(meta.inputTokens).toBe(220);
    expect(meta.outputTokens).toBe(85);
    expect(meta.outcome).toBe("ok");
  });

  it("editor fails → first draft returned with editor skipped; usages still summed when second call returned", async () => {
    mocks.contentProvider
      .mockResolvedValueOnce({
        json: {
          locales: {
            en: { shortDescription: "Quiet silver ring." },
          },
        },
        usage: {
          model: "gemini-3.1-flash-lite",
          inputTokens: 50,
          outputTokens: 20,
          latencyMs: 8,
        },
      })
      .mockRejectedValueOnce(new Error("editor boom"));

    const result = await generateProductContent({
      productId: "prod_1",
      locales: ["en"],
      actor,
      editorPass: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.locales.en?.shortDescription).toBe("Quiet silver ring.");
    expect(result.draft.warnings.some((w) => /editor skipped/i.test(w.message))).toBe(
      true,
    );
    expect(result.draft.usage.inputTokens).toBe(50);
    expect(result.draft.usage.outputTokens).toBe(20);
    expect(mocks.auditLogCreate).toHaveBeenCalledOnce();
  });

  it("editor invalid JSON → first draft + editor skipped; second usage included", async () => {
    mocks.contentProvider
      .mockResolvedValueOnce({
        json: {
          locales: {
            en: { shortDescription: "Quiet silver ring." },
          },
        },
        usage: {
          model: "gemini-3.1-flash-lite",
          inputTokens: 10,
          outputTokens: 5,
          latencyMs: 3,
        },
      })
      .mockResolvedValueOnce({
        json: { __truncated: true, finishReason: "MAX_TOKENS" },
        usage: {
          model: "gemini-3.1-flash-lite",
          inputTokens: 11,
          outputTokens: 6,
          latencyMs: 4,
        },
      });

    const result = await generateProductContent({
      productId: "prod_1",
      locales: ["en"],
      actor,
      editorPass: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.locales.en?.shortDescription).toBe("Quiet silver ring.");
    expect(result.draft.warnings.some((w) => /editor skipped/i.test(w.message))).toBe(
      true,
    );
    expect(result.draft.usage.inputTokens).toBe(21);
    expect(result.draft.usage.outputTokens).toBe(11);
    expect(result.draft.usage.latencyMs).toBe(7);
  });

  it("budget ceiling accounts for 2 calls when editor pass on", async () => {
    process.env.AI_MONTHLY_BUDGET_USD = "0.001";
    process.env.AI_EDITOR_PASS = "1";
    // Single-call ceiling for small facts may still fit; force exhaustion via prior spend
    // that leaves room for 1 call but not 2 by using a tiny remaining budget.
    mocks.auditLogFindMany.mockResolvedValue([{ metadata: { costUsd: 0 } }]);

    // With editor on, estimate is 2× ceiling — tiny budget should refuse before provider.
    process.env.AI_MONTHLY_BUDGET_USD = "0.00001";
    const result = await generateProductContent({
      productId: "prod_1",
      locales: ["en"],
      actor,
    });
    expect(result).toMatchObject({ ok: false, code: "budget_exhausted" });
    expect(mocks.contentProvider).not.toHaveBeenCalled();
  });

  it("skips editor when AI_EDITOR_PASS off", async () => {
    mocks.contentProvider.mockResolvedValue({
      json: {
        locales: {
          en: { shortDescription: "Quiet silver ring." },
        },
      },
      usage: {
        model: "gemini-3.1-flash-lite",
        inputTokens: 10,
        outputTokens: 5,
        latencyMs: 2,
      },
    });

    const result = await generateProductContent({
      productId: "prod_1",
      locales: ["en"],
      actor,
      editorPass: false,
    });
    expect(result.ok).toBe(true);
    expect(mocks.contentProvider).toHaveBeenCalledOnce();
  });
});
