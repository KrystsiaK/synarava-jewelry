import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    siteSetting: {
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
    },
  },
}));

vi.mock("@/lib/content/storefront-copy", () => ({
  getStorefrontCopy: vi.fn(async () => ({
    en: { "nav.home": "Start", "nav.shop": "Store" },
    pt: { "nav.home": "Início" },
  })),
}));

import { getHeaderNav, setHeaderNav } from "@/lib/content/header-nav";
import { DEFAULT_HEADER_NAV_ITEMS, HEADER_NAV_KEY } from "@/lib/content/header-nav-fields";

describe("header nav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the shipped default menu when nothing is stored", async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(getHeaderNav()).resolves.toEqual({
      items: DEFAULT_HEADER_NAV_ITEMS,
      labels: {
        en: { home: "Start", shop: "Store" },
        pt: { home: "Início" },
      },
    });
  });

  it("returns persisted header nav when present", async () => {
    mocks.findUnique.mockResolvedValue({
      value: {
        items: [{ id: "shop", href: "/shop" }, { id: "care", href: "/care" }],
        labels: { en: { care: "Care" } },
      },
    });
    await expect(getHeaderNav()).resolves.toEqual({
      items: [{ id: "shop", href: "/shop" }, { id: "care", href: "/care" }],
      labels: { en: { care: "Care" } },
    });
  });

  it("upserts a cleaned payload", async () => {
    mocks.upsert.mockResolvedValue({});
    const result = await setHeaderNav({
      items: [
        { id: "home", href: "/" },
        { id: "x", href: "/shop/" },
        { id: "drop", href: "   " },
      ],
      labels: {
        en: { home: " Home ", orphan: "nope", x: "Shop" },
        pt: {},
      },
    });
    expect(result).toEqual({
      items: [
        { id: "home", href: "/" },
        { id: "x", href: "/shop" },
      ],
      labels: { en: { home: "Home", x: "Shop" } },
    });
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { key: HEADER_NAV_KEY },
      update: { value: result },
      create: { key: HEADER_NAV_KEY, value: result },
    });
  });
});
