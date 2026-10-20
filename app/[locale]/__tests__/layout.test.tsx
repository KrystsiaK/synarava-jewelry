import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublishedStorefrontLocales: vi.fn(),
  getStorefrontLocales: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  permanentRedirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/i18n/storefront-locale-cache", () => ({
  getPublishedStorefrontLocales: mocks.getPublishedStorefrontLocales,
  getStorefrontLocales: mocks.getStorefrontLocales,
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  permanentRedirect: mocks.permanentRedirect,
}));

import LocaleLayout, { generateStaticParams } from "../layout";

const ALL = [
  {
    code: "en",
    routeSegment: "en",
    isDefault: true,
    status: "PUBLISHED",
    isPublished: true,
    deletedAt: null,
    retiredAt: null,
  },
  {
    code: "pt",
    routeSegment: "pt",
    isDefault: false,
    status: "PUBLISHED",
    isPublished: true,
    deletedAt: null,
    retiredAt: null,
  },
  {
    code: "ru",
    routeSegment: "ru",
    isDefault: false,
    status: "DRAFT",
    isPublished: false,
    deletedAt: null,
    retiredAt: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPublishedStorefrontLocales.mockResolvedValue(ALL.filter((locale) => locale.status === "PUBLISHED"));
  mocks.getStorefrontLocales.mockResolvedValue(ALL);
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

  it("404s a registered-but-draft locale", async () => {
    await expect(
      LocaleLayout({ children: "content", params: Promise.resolve({ locale: "ru" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("301s a retired locale to the default language", async () => {
    mocks.getStorefrontLocales.mockResolvedValue(
      ALL.map((locale) =>
        locale.code === "ru"
          ? { ...locale, status: "RETIRED", isPublished: false, retiredAt: new Date() }
          : locale,
      ),
    );
    await expect(
      LocaleLayout({ children: "content", params: Promise.resolve({ locale: "ru" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/en");
  });

  it("404s a locale that was never registered", async () => {
    await expect(
      LocaleLayout({ children: "content", params: Promise.resolve({ locale: "de" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
