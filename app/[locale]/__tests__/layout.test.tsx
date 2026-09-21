import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublishedStorefrontLocales: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/lib/i18n/storefront-locale-cache", () => ({
  getPublishedStorefrontLocales: mocks.getPublishedStorefrontLocales,
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

import LocaleLayout, { generateStaticParams } from "../layout";

const PUBLISHED = [
  { routeSegment: "en", isDefault: true },
  { routeSegment: "pt", isDefault: false },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPublishedStorefrontLocales.mockResolvedValue(PUBLISHED);
});

describe("generateStaticParams", () => {
  it("pre-renders one param per published locale", async () => {
    expect(await generateStaticParams()).toEqual([{ locale: "en" }, { locale: "pt" }]);
  });
});

describe("LocaleLayout", () => {
  it("renders children for a published locale", async () => {
    const result = await LocaleLayout({ children: "content", params: Promise.resolve({ locale: "pt" }) });
    expect(result).toBe("content");
  });

  it("404s a registered-but-unpublished locale", async () => {
    await expect(
      LocaleLayout({ children: "content", params: Promise.resolve({ locale: "ru" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("404s a locale that was never registered", async () => {
    await expect(
      LocaleLayout({ children: "content", params: Promise.resolve({ locale: "de" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
