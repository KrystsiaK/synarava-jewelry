import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("geminiContentProvider", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    process.env.GEMINI_API_KEY = "test-key-not-real";
    process.env.AI_CONTENT_MODEL = "gemini-3.1-flash-lite";
    process.env.AI_MAX_OUTPUT_TOKENS = "4096";
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.AI_CONTENT_MODEL;
    delete process.env.AI_MAX_OUTPUT_TOKENS;
    delete process.env.GEMINI_MODEL;
  });

  it("returns ContentProvider-shaped json + usage with maxOutputTokens", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: { parts: [{ text: '{"locales":{}}' }] },
            finishReason: "STOP",
          },
        ],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
      }),
    });

    const { geminiContentProvider } = await import("@/lib/ai/gemini");
    const result = await geminiContentProvider({
      system: "sys",
      user: "user",
      jsonSchema: { type: "object" },
      timeoutMs: 5_000,
    });

    expect(result.json).toEqual({ locales: {} });
    expect(result.usage).toMatchObject({
      model: "gemini-3.1-flash-lite",
      inputTokens: 10,
      outputTokens: 5,
    });
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(String(init.body)) as {
      generationConfig: { maxOutputTokens: number };
    };
    expect(body.generationConfig.maxOutputTokens).toBe(4096);
  });

  it("returns invalid json marker on MAX_TOKENS so generate can AuditLog invalid_output", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: { parts: [{ text: '{"locales":{"en":{"shortDescription":"cut' }] },
            finishReason: "MAX_TOKENS",
          },
        ],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 4096 },
      }),
    });

    const { geminiContentProvider } = await import("@/lib/ai/gemini");
    const result = await geminiContentProvider({
      system: "sys",
      user: "user",
      jsonSchema: { type: "object" },
      timeoutMs: 5_000,
    });
    expect(result.json).toMatchObject({ __truncated: true, finishReason: "MAX_TOKENS" });
    expect(result.usage.outputTokens).toBe(4096);
  });

  it("throws ContentProviderNotConfiguredError without API key", async () => {
    delete process.env.GEMINI_API_KEY;
    const { geminiContentProvider } = await import("@/lib/ai/gemini");
    const { ContentProviderNotConfiguredError } = await import(
      "@/lib/ai/product-content/provider"
    );
    await expect(
      geminiContentProvider({
        system: "sys",
        user: "user",
        jsonSchema: {},
        timeoutMs: 1000,
      }),
    ).rejects.toBeInstanceOf(ContentProviderNotConfiguredError);
  });

  it("throws AbortError on timeout", async () => {
    fetchMock.mockImplementation(() => {
      const err = new Error("aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    });

    const { geminiContentProvider } = await import("@/lib/ai/gemini");
    await expect(
      geminiContentProvider({
        system: "sys",
        user: "user",
        jsonSchema: { type: "object" },
        timeoutMs: 5,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
