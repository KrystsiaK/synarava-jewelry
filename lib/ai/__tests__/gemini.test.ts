import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("generateStructuredJson", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    process.env.GEMINI_API_KEY = "test-key-not-real";
    process.env.GEMINI_MODEL = "gemini-3.1-flash-lite";
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
  });

  it("returns structured text and usage on happy path", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"locales":{}}' }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
      }),
    });

    const { generateStructuredJson } = await import("@/lib/ai/gemini");
    const result = await generateStructuredJson({
      systemInstruction: "sys",
      userPrompt: "user",
      responseJsonSchema: { type: "object" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toContain("locales");
      expect(result.inputTokens).toBe(10);
      expect(result.outputTokens).toBe(5);
      expect(result.costUsd).toBeGreaterThan(0);
    }
    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(String(init.headers && (init.headers as Record<string, string>)["x-goog-api-key"])).toBe(
      "test-key-not-real",
    );
  });

  it("maps AbortError to timeout", async () => {
    fetchMock.mockImplementation(() => {
      const err = new Error("aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    });

    const { generateStructuredJson } = await import("@/lib/ai/gemini");
    const result = await generateStructuredJson({
      systemInstruction: "sys",
      userPrompt: "user",
      responseJsonSchema: { type: "object" },
      timeoutMs: 5,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("timeout");
  });

  it("maps HTTP 500 to provider_error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: "backend boom" } }),
    });

    const { generateStructuredJson } = await import("@/lib/ai/gemini");
    const result = await generateStructuredJson({
      systemInstruction: "sys",
      userPrompt: "user",
      responseJsonSchema: { type: "object" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("provider_error");
      expect(result.message).toMatch(/boom/i);
    }
  });
});
