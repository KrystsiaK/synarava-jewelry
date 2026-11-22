import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  checkRateLimit: vi.fn(),
  productFindUnique: vi.fn(),
  auditLogFindMany: vi.fn(),
  auditLogCreate: vi.fn(),
  contentProvider: vi.fn(),
}));

vi.mock("@/lib/auth/admin-session", () => ({
  requireAdminSession: mocks.requireAdminSession,
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

import { generateProductContentAction } from "../ai-content";

const productRow = {
  id: "prod_1",
  name: "River Pearl Ring",
  productType: "Ring",
  materialLine: "925 sterling silver",
  shortDescription: "A quiet ring.",
  description: "<p>Silver and pearl.</p>",
  seoTitle: null,
  seoDescription: null,
  details: { attributes: [{ label: "Stone", value: "Pearl" }] },
  updatedAt: new Date("2026-11-01T12:00:00.000Z"),
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
  translations: [],
};

function enableAi() {
  process.env.AI_CONTENT_ENABLED = "true";
  process.env.AI_MONTHLY_BUDGET_USD = "5";
}

function okProviderJson(locales: unknown) {
  mocks.contentProvider.mockResolvedValue({
    json: { locales },
    usage: {
      model: "gemini-3.1-flash-lite",
      inputTokens: 100,
      outputTokens: 50,
      latencyMs: 120,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  enableAi();
  mocks.requireAdminSession.mockResolvedValue({
    username: "admin",
    sessionId: "sess_1",
  });
  mocks.checkRateLimit.mockResolvedValue({ ok: true });
  mocks.auditLogFindMany.mockResolvedValue([]);
  mocks.auditLogCreate.mockResolvedValue({ id: "audit_1" });
  mocks.productFindUnique.mockResolvedValue(productRow);
  okProviderJson({
    en: {
      shortDescription: "A quiet silver ring.",
      description: "<p>Crafted in silver.</p>",
      seoTitle: "River Pearl Ring",
      seoDescription: "Quiet silver and pearl.",
    },
    pt: {
      title: "Anel Pérola do Rio",
      shortDescription: "Um anel sereno.",
    },
    ru: {
      title: "Кольцо Речной Жемчуг",
      shortDescription: "Спокойное кольцо.",
    },
  });
});

describe("generateProductContentAction", () => {
  it("happy path returns draft without en.title and writes AuditLog only", async () => {
    const result = await generateProductContentAction("prod_1", ["en", "pt", "ru"]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.locales.en?.title).toBeUndefined();
      expect(result.draft.locales.pt?.title).toBeTruthy();
      expect(result.draft.locales.ru?.title).toBeTruthy();
      expect(result.draft.productId).toBe("prod_1");
      expect(result.draft.usage.model).toBe("gemini-3.1-flash-lite");
      expect(result.draft.usage.costUsd).toBeGreaterThan(0);
    }
    expect(mocks.auditLogCreate).toHaveBeenCalledOnce();
    const createArg = mocks.auditLogCreate.mock.calls[0]![0];
    expect(createArg.data.action).toBe("ai.product_content.generate");
    expect(createArg.data.metadata.outcome).toBe("ok");
    expect(createArg.data.metadata.costUsd).toBeGreaterThan(0);
    expect(JSON.stringify(createArg.data.metadata)).not.toMatch(/shortDescription|A quiet/);
  });

  it("returns unauthorized when requireAdminSession fails", async () => {
    const err = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/admin/login",
    });
    mocks.requireAdminSession.mockRejectedValue(err);
    await expect(generateProductContentAction("prod_1", ["en"])).resolves.toEqual({
      ok: false,
      code: "unauthorized",
      message: "Admin session required",
    });
  });

  it("returns disabled when AI_CONTENT_ENABLED is off", async () => {
    delete process.env.AI_CONTENT_ENABLED;
    await expect(generateProductContentAction("prod_1", ["en"])).resolves.toMatchObject({
      ok: false,
      code: "disabled",
    });
  });

  it("returns rate_limited", async () => {
    mocks.checkRateLimit.mockResolvedValue({
      ok: false,
      error: "Too many attempts. Try again in 30s.",
      retryAfterSeconds: 30,
    });
    await expect(generateProductContentAction("prod_1", ["en"])).resolves.toMatchObject({
      ok: false,
      code: "rate_limited",
    });
  });

  it("returns budget_exhausted", async () => {
    mocks.auditLogFindMany.mockResolvedValue([{ metadata: { costUsd: 5.1 } }]);
    await expect(generateProductContentAction("prod_1", ["en"])).resolves.toMatchObject({
      ok: false,
      code: "budget_exhausted",
    });
  });

  it("returns timeout from provider", async () => {
    const err = new Error("timed out");
    err.name = "AbortError";
    mocks.contentProvider.mockRejectedValue(err);
    await expect(generateProductContentAction("prod_1", ["en"])).resolves.toMatchObject({
      ok: false,
      code: "timeout",
    });
  });

  it("returns provider_error on HTTP failure path", async () => {
    mocks.contentProvider.mockRejectedValue(new Error("Gemini HTTP 500"));
    await expect(generateProductContentAction("prod_1", ["en"])).resolves.toMatchObject({
      ok: false,
      code: "provider_error",
    });
  });

  it("invalid_output still writes AuditLog and costUsd counts toward monthly sum", async () => {
    mocks.contentProvider.mockResolvedValue({
      json: { notLocales: true },
      usage: {
        model: "gemini-3.1-flash-lite",
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        latencyMs: 5,
      },
    });
    await expect(generateProductContentAction("prod_1", ["en"])).resolves.toMatchObject({
      ok: false,
      code: "invalid_output",
    });
    expect(mocks.auditLogCreate).toHaveBeenCalledOnce();
    const meta = mocks.auditLogCreate.mock.calls[0]![0].data.metadata as {
      outcome: string;
      costUsd: number;
    };
    expect(meta.outcome).toBe("invalid_output");
    // 1M in @ $0.25 + 1M out @ $1.50 = $1.75
    expect(meta.costUsd).toBe(1.75);

    mocks.auditLogFindMany.mockResolvedValue([{ metadata: meta }]);
    const { sumMonthlyAiSpendUsd } = await import("@/lib/ai/product-content/budget");
    await expect(sumMonthlyAiSpendUsd()).resolves.toBe(1.75);
  });

  it("warns on invented hypoallergenic", async () => {
    okProviderJson({
      en: { shortDescription: "Hypoallergenic silver ring." },
    });
    const result = await generateProductContentAction("prod_1", ["en"]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.warnings.some((w) => /hypoallergenic/i.test(w.message))).toBe(true);
    }
  });

  it("returns not_found when product missing", async () => {
    mocks.productFindUnique.mockResolvedValue(null);
    await expect(generateProductContentAction("missing", ["en"])).resolves.toMatchObject({
      ok: false,
      code: "not_found",
    });
  });

  it("returns disabled when Gemini API key is missing", async () => {
    const { ContentProviderNotConfiguredError } = await import(
      "@/lib/ai/product-content/provider"
    );
    mocks.contentProvider.mockRejectedValue(new ContentProviderNotConfiguredError());
    await expect(generateProductContentAction("prod_1", ["en"])).resolves.toMatchObject({
      ok: false,
      code: "disabled",
    });
  });

  it("8a: MAX_TOKENS-style invalid json still AuditLogs usage", async () => {
    mocks.contentProvider.mockResolvedValue({
      json: { __truncated: true, finishReason: "MAX_TOKENS" },
      usage: {
        model: "gemini-3.1-flash-lite",
        inputTokens: 200,
        outputTokens: 4096,
        latencyMs: 50,
      },
    });
    await expect(generateProductContentAction("prod_1", ["en"])).resolves.toMatchObject({
      ok: false,
      code: "invalid_output",
    });
    expect(mocks.auditLogCreate).toHaveBeenCalledOnce();
    expect(mocks.auditLogCreate.mock.calls[0]![0].data.metadata.outcome).toBe("invalid_output");
  });

  it("8c: refuses when ceiling estimate would exhaust monthly budget", async () => {
    process.env.AI_MONTHLY_BUDGET_USD = "0.0001";
    mocks.auditLogFindMany.mockResolvedValue([{ metadata: { costUsd: 0 } }]);
    await expect(generateProductContentAction("prod_1", ["en"])).resolves.toMatchObject({
      ok: false,
      code: "budget_exhausted",
    });
    expect(mocks.contentProvider).not.toHaveBeenCalled();
  });
});
