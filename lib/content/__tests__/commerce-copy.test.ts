import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { siteSetting: { findUnique: mocks.findUnique, upsert: mocks.upsert } },
}));

import { getCommerceCopy, setCommerceCopy } from "@/lib/content/commerce-copy";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("commerce copy overrides", () => {
  it("keeps an empty product.restockNotice so sold-out can hide the default", async () => {
    mocks.findUnique.mockResolvedValue({
      value: { en: { "product.restockNotice": "Soon", "product.add": "Add" } },
    });

    const result = await setCommerceCopy({ en: { "product.restockNotice": "" } });

    expect(result).toEqual({
      en: { "product.restockNotice": "", "product.add": "Add" },
    });
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { key: "commerce-copy-v1" },
      update: { value: result },
      create: { key: "commerce-copy-v1", value: result },
    });
  });

  it("reads back an explicit empty product.restockNotice", async () => {
    mocks.findUnique.mockResolvedValue({
      value: { en: { "product.restockNotice": "", "product.add": "Add" } },
    });

    await expect(getCommerceCopy()).resolves.toEqual({
      en: { "product.restockNotice": "", "product.add": "Add" },
    });
  });

  it("still clears other commerce keys back to the shipped default when empty", async () => {
    mocks.findUnique.mockResolvedValue({
      value: { en: { "product.add": "Add", "product.restockNotice": "Soon" } },
    });

    const result = await setCommerceCopy({ en: { "product.add": "" } });

    expect(result).toEqual({ en: { "product.restockNotice": "Soon" } });
  });
});
