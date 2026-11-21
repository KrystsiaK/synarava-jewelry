import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  checkRateLimit: vi.fn(),
  productFindUnique: vi.fn(),
  auditLogFindMany: vi.fn(),
  auditLogCreate: vi.fn(),
  generateStructuredJson: vi.fn(),
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

vi.mock("@/lib/ai/gemini", () => ({
  generateStructuredJson: mocks.generateStructuredJson,
}));

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
  process.env.GEMINI_API_KEY = "test-key";
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
  mocks.generateStructuredJson.mockResolvedValue({
    ok: true,
    text: JSON.stringify({
      locales: {
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
      },
    }),
    model: "gemini-3.1-flash-lite",
    inputTokens: 100,
    outputTokens: 50,
    costUsd: 0.0001,
    latencyMs: 120,
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
    }
    expect(mocks.auditLogCreate).toHaveBeenCalledOnce();
    const createArg = mocks.auditLogCreate.mock.calls[0]![0];
    expect(createArg.data.action).toBe("ai.product_content.generate");
    expect(JSON.stringify(createArg.data.metadata)).not.toMatch(/shortDescription|A quiet/);
    expect(mocks.productFindUnique).toHaveBeenCalled();
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
    mocks.generateStructuredJson.mockResolvedValue({
      ok: false,
      code: "timeout",
      message: "timed out",
      latencyMs: 30000,
      model: "gemini-3.1-flash-lite",
    });
    await expect(generateProductContentAction("prod_1", ["en"])).resolves.toMatchObject({
      ok: false,
      code: "timeout",
    });
  });

  it("returns provider_error on HTTP failure path", async () => {
    mocks.generateStructuredJson.mockResolvedValue({
      ok: false,
      code: "provider_error",
      message: "Gemini HTTP 500",
      latencyMs: 10,
      model: "gemini-3.1-flash-lite",
    });
    await expect(generateProductContentAction("prod_1", ["en"])).resolves.toMatchObject({
      ok: false,
      code: "provider_error",
    });
  });

  it("returns invalid_output for garbage JSON", async () => {
    mocks.generateStructuredJson.mockResolvedValue({
      ok: true,
      text: "not-json{{{",
      model: "gemini-3.1-flash-lite",
      inputTokens: 1,
      outputTokens: 1,
      costUsd: 0,
      latencyMs: 5,
    });
    await expect(generateProductContentAction("prod_1", ["en"])).resolves.toMatchObject({
      ok: false,
      code: "invalid_output",
    });
    expect(mocks.auditLogCreate).not.toHaveBeenCalled();
  });

  it("warns on invented hypoallergenic", async () => {
    mocks.generateStructuredJson.mockResolvedValue({
      ok: true,
      text: JSON.stringify({
        locales: {
          en: { shortDescription: "Hypoallergenic silver ring." },
        },
      }),
      model: "gemini-3.1-flash-lite",
      inputTokens: 10,
      outputTokens: 10,
      costUsd: 0.00001,
      latencyMs: 20,
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
});
