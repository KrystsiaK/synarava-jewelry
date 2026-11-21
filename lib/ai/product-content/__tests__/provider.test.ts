import { afterEach, describe, expect, it } from "vitest";

import {
  ContentProviderNotConfiguredError,
  getContentProvider,
  setContentProviderForTests,
  stubContentProvider,
} from "@/lib/ai/product-content/provider";

afterEach(() => {
  setContentProviderForTests(null);
});

describe("ContentProvider stub", () => {
  it("default provider is the stub and rejects with not configured", async () => {
    expect(getContentProvider()).toBe(stubContentProvider);
    await expect(
      getContentProvider()({
        system: "s",
        user: "u",
        jsonSchema: {},
        timeoutMs: 1000,
      }),
    ).rejects.toBeInstanceOf(ContentProviderNotConfiguredError);
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
