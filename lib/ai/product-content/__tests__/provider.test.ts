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

describe("ContentProvider output normalize guard", () => {
  const family = "👨\u200D👩\u200D👧\u200D👦";

  it("strips each invisible char from response JSON strings at the provider boundary", async () => {
    const invisibles = [
      "\u200B",
      "\u200C",
      "\u200D",
      "\u200E",
      "\u200F",
      "\u202A",
      "\u202B",
      "\u202C",
      "\u202D",
      "\u202E",
      "\u2060",
      "\u2061",
      "\u2062",
      "\u2063",
      "\u2064",
      "\uFEFF",
      "\u00AD",
    ];

    setContentProviderForTests(async () => ({
      json: {
        locales: {
          en: {
            title: `clean${invisibles.join("")}text`,
            body: `ação\u00A0ё`,
            emoji: family,
          },
        },
      },
      usage: { model: "test", inputTokens: 1, outputTokens: 1, latencyMs: 1 },
    }));

    const result = await getContentProvider()({
      system: "s",
      user: "u",
      jsonSchema: {},
      timeoutMs: 1000,
    });

    expect(result.json).toEqual({
      locales: {
        en: {
          title: "cleantext",
          body: "ação ё",
          emoji: family,
        },
      },
    });
  });
});
