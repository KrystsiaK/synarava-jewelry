import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { siteSetting: { findUnique: mocks.findUnique, upsert: mocks.upsert } },
}));

import { getStorefrontCopy, setStorefrontCopy } from "@/lib/content/storefront-copy";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("storefront copy overrides", () => {
  it("defaults to empty overrides when nothing has been saved", async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(getStorefrontCopy()).resolves.toEqual({ en: {}, pt: {} });
  });

  it("drops blank strings and non-string values when reading", async () => {
    mocks.findUnique.mockResolvedValue({ value: { en: { a: "kept", b: "  " }, pt: { c: 42 } } });
    await expect(getStorefrontCopy()).resolves.toEqual({ en: { a: "kept" }, pt: {} });
  });

  it("merges a new key into an existing override set", async () => {
    mocks.findUnique.mockResolvedValue({ value: { en: { "footer.tagline": "Old" }, pt: {} } });
    const result = await setStorefrontCopy({ en: { "nav.home": "Start" }, pt: {} });
    expect(result).toEqual({ en: { "footer.tagline": "Old", "nav.home": "Start" }, pt: {} });
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { key: "storefront-copy-v1" },
      update: { value: result },
      create: { key: "storefront-copy-v1", value: result },
    });
  });

  it("clears an override back to the shipped default when submitted empty", async () => {
    mocks.findUnique.mockResolvedValue({ value: { en: { "footer.tagline": "Old" }, pt: {} } });
    const result = await setStorefrontCopy({ en: { "footer.tagline": "" }, pt: {} });
    expect(result).toEqual({ en: {}, pt: {} });
  });
});
