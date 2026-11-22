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

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AI_CONTENT_ENABLED = "true";
  process.env.AI_MONTHLY_BUDGET_USD = "5";
  process.env.AI_CONTENT_MODEL = "gemini-3.1-flash-lite";
  delete process.env.AI_MAX_INPUT_CHARS;
  mocks.checkRateLimit.mockResolvedValue({ ok: true });
  mocks.auditLogFindMany.mockResolvedValue([]);
  mocks.auditLogCreate.mockResolvedValue({ id: "a1" });
  mocks.contentProvider.mockResolvedValue({
    json: { locales: { en: { shortDescription: "Quiet." } } },
    usage: { model: "gemini-3.1-flash-lite", inputTokens: 10, outputTokens: 5, latencyMs: 1 },
  });
});

describe("generateProductContent input/output ceilings", () => {
  it("8b: invalid_output without provider when essentials exceed AI_MAX_INPUT_CHARS", async () => {
    process.env.AI_MAX_INPUT_CHARS = "80";
    mocks.productFindUnique.mockResolvedValue({
      id: "prod_huge",
      name: "N".repeat(200),
      productType: "Ring",
      materialLine: null,
      shortDescription: null,
      description: null,
      seoTitle: null,
      seoDescription: null,
      details: {},
      updatedAt: new Date("2026-11-01T00:00:00.000Z"),
      characteristics: Array.from({ length: 20 }, (_, i) => ({
        key: `k${i}`,
        label: `L${i}`,
        textValue: "V".repeat(100),
        numberValue: null,
        booleanValue: null,
        unit: null,
      })),
      collections: [],
      translations: [],
    });

    const result = await generateProductContent({
      productId: "prod_huge",
      locales: ["en"],
      actor,
    });
    expect(result).toMatchObject({ ok: false, code: "invalid_output" });
    expect(mocks.contentProvider).not.toHaveBeenCalled();
    expect(mocks.auditLogCreate).not.toHaveBeenCalled();
  });

  it("8b: adds source truncated warning when long fields are trimmed", async () => {
    process.env.AI_MAX_INPUT_CHARS = "900";
    mocks.productFindUnique.mockResolvedValue({
      id: "prod_long",
      name: "River Ring",
      productType: "Ring",
      materialLine: "925 sterling silver",
      shortDescription: "s".repeat(400),
      description: Array.from({ length: 40 }, (_, i) => `<p>Paragraph ${i}.</p>`).join("\n\n"),
      seoTitle: "t".repeat(80),
      seoDescription: "d".repeat(200),
      details: {
        attributes: Array.from({ length: 10 }, (_, i) => ({
          label: `A${i}`,
          value: "v".repeat(80),
        })),
      },
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
      collections: [{ collection: { name: "Quiet Forms" } }],
      translations: Array.from({ length: 6 }, (_, i) => ({
        locale: "pt",
        title: `T${i}`,
        shortDescription: "y".repeat(120),
        description: "z".repeat(120),
        materialLine: null,
        seoTitle: null,
        seoDescription: null,
      })),
    });

    const result = await generateProductContent({
      productId: "prod_long",
      locales: ["en"],
      actor,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.warnings.some((w) => /source truncated/i.test(w.message))).toBe(true);
    }
    expect(mocks.contentProvider).toHaveBeenCalledOnce();
  });

  it("dryRun skips AuditLog write on success", async () => {
    mocks.productFindUnique.mockResolvedValue({
      id: "prod_dry",
      name: "Dry Ring",
      productType: "Ring",
      materialLine: "925 sterling silver",
      shortDescription: "Quiet.",
      description: "<p>Quiet form.</p>",
      seoTitle: "Dry Ring",
      seoDescription: "Quiet silver ring.",
      details: {},
      updatedAt: new Date("2026-11-01T00:00:00.000Z"),
      characteristics: [],
      collections: [],
      translations: [],
    });
    mocks.contentProvider.mockResolvedValue({
      json: {
        locales: {
          en: {
            shortDescription: "Quiet silver.",
            description: "<p>A quiet silver ring.</p>",
            seoTitle: "Dry Ring | Synarava",
            seoDescription: "Quiet silver ring for everyday wear.",
          },
        },
      },
      usage: {
        model: "gemini-3.1-flash-lite",
        inputTokens: 20,
        outputTokens: 40,
        latencyMs: 12,
      },
    });

    const result = await generateProductContent({
      productId: "prod_dry",
      locales: ["en"],
      actor,
      dryRun: true,
    });
    expect(result.ok).toBe(true);
    expect(mocks.auditLogCreate).not.toHaveBeenCalled();
  });
});
