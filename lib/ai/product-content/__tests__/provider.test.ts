import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getContentProvider,
  setContentProviderForTests,
} from "@/lib/ai/product-content/provider";

afterEach(() => {
  setContentProviderForTests(null);
  vi.unstubAllGlobals();
});

describe("ContentProvider production wiring", () => {
  it("default provider delegates to Gemini (lazy)", async () => {
    process.env.GEMINI_API_KEY = "test-key-not-real";
    process.env.AI_CONTENT_MODEL = "gemini-3.1-flash-lite";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          { content: { parts: [{ text: '{"locales":{}}' }] }, finishReason: "STOP" },
        ],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getContentProvider()({
      system: "s",
      user: "u",
      jsonSchema: { type: "object" },
      timeoutMs: 1000,
    });
    expect(result.usage.model).toBe("gemini-3.1-flash-lite");
    expect(fetchMock).toHaveBeenCalledOnce();
    delete process.env.GEMINI_API_KEY;
    delete process.env.AI_CONTENT_MODEL;
  });

  it("allows test override", async () => {
    setContentProviderForTests(async () => ({
      json: { locales: {} },
      usage: { model: "test", inputTokens: 1, outputTokens: 1, latencyMs: 1 },
    }));
    const result = await getContentProvider()({
      system: "s",
      user: "u",
      jsonSchema: {},
      timeoutMs: 1000,
    });
    expect(result.usage.model).toBe("test");
  });
});
