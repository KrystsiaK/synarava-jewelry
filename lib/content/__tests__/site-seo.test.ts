import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { siteSetting: { findUnique: mocks.findUnique, upsert: mocks.upsert } },
}));

import { getSiteSeo, getSiteSeoOverrides, setSiteSeo } from "@/lib/content/site-seo";
import { SITE_SEO_DEFAULTS } from "@/lib/content/site-seo-fields";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("site SEO overrides", () => {
  it("returns shipped defaults when nothing has been saved", async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(getSiteSeo()).resolves.toEqual(SITE_SEO_DEFAULTS);
    await expect(getSiteSeoOverrides()).resolves.toEqual({});
  });

  it("merges stored overrides over defaults", async () => {
    mocks.findUnique.mockResolvedValue({
      value: { defaultTitle: "Custom title", description: "Custom desc" },
    });
    await expect(getSiteSeo()).resolves.toEqual({
      ...SITE_SEO_DEFAULTS,
      defaultTitle: "Custom title",
      description: "Custom desc",
    });
  });

  it("clears an override when submitted empty", async () => {
    mocks.findUnique.mockResolvedValue({ value: { defaultTitle: "Custom" } });
    const result = await setSiteSeo({ defaultTitle: "" });
    expect(result.defaultTitle).toBe(SITE_SEO_DEFAULTS.defaultTitle);
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { key: "site-seo-v1" },
      update: { value: {} },
      create: { key: "site-seo-v1", value: {} },
    });
  });

  it("persists a trimmed override", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const result = await setSiteSeo({ ogTitle: "  Share title  " });
    expect(result.ogTitle).toBe("Share title");
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { key: "site-seo-v1" },
      update: { value: { ogTitle: "Share title" } },
      create: { key: "site-seo-v1", value: { ogTitle: "Share title" } },
    });
  });
});
