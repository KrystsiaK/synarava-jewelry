import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("geminiContentProvider", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    process.env.GEMINI_API_KEY = "test-key-not-real";
    process.env.GEMINI_MODEL = "gemini-3.1-flash-lite";
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
  });

  it("returns ContentProvider-shaped json + usage (no cost)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"locales":{}}' }] } }],
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
    expect(result.usage.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result).not.toHaveProperty("costUsd");
    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(String(init.headers && (init.headers as Record<string, string>)["x-goog-api-key"])).toBe(
      "test-key-not-real",
    );
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

  it("throws on HTTP 500", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: "backend boom" } }),
    });

    const { geminiContentProvider } = await import("@/lib/ai/gemini");
    await expect(
      geminiContentProvider({
        system: "sys",
        user: "user",
        jsonSchema: { type: "object" },
        timeoutMs: 5_000,
      }),
    ).rejects.toThrow(/boom/i);
  });
});
