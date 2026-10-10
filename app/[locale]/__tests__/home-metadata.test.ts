import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPageBySlug: vi.fn(),
  getSiteSeo: vi.fn(),
  getServerTranslations: vi.fn(),
  buildAlternates: vi.fn(),
  buildOpenGraphLocales: vi.fn(),
}));

vi.mock("@/lib/content/catalog", () => ({
  getPageBySlug: mocks.getPageBySlug,
  listCollections: vi.fn(),
}));
vi.mock("@/lib/content/home-archive-section", () => ({
  resolveHomeArchiveCollections: vi.fn(() => []),
}));
vi.mock("@/lib/content/shop-listing", () => ({ listShopListingProducts: vi.fn() }));
vi.mock("@/lib/site-videos", () => ({ getSiteVideos: vi.fn() }));
vi.mock("@/lib/content/site-seo", () => ({ getSiteSeo: mocks.getSiteSeo }));
vi.mock("@/lib/i18n/server", () => ({ getServerTranslations: mocks.getServerTranslations }));
vi.mock("@/lib/seo/alternates", () => ({ buildAlternates: mocks.buildAlternates }));
vi.mock("@/lib/seo/open-graph-locale", () => ({
  buildOpenGraphLocales: mocks.buildOpenGraphLocales,
}));
vi.mock("@/components/home/home-page", () => ({ HomePage: () => null }));

import { SITE_SEO_DEFAULTS } from "@/lib/content/site-seo-fields";
import { HOME_SEO_TITLE_BY_LOCALE } from "@/lib/seo/home-seo-defaults";
import { generateMetadata } from "../page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSiteSeo.mockResolvedValue(SITE_SEO_DEFAULTS);
  mocks.buildAlternates.mockResolvedValue({ canonical: "/en" });
  mocks.buildOpenGraphLocales.mockResolvedValue({ locale: "en_US" });
});

describe("Home generateMetadata — localized seoTitle / og:title", () => {
  it.each([
    {
      locale: "en" as const,
      seoTitle: HOME_SEO_TITLE_BY_LOCALE.en,
      description: "EN description from page SEO.",
    },
    {
      locale: "pt" as const,
      seoTitle: HOME_SEO_TITLE_BY_LOCALE.pt,
      description: "Descrição PT.",
    },
    {
      locale: "ru" as const,
      seoTitle: HOME_SEO_TITLE_BY_LOCALE.ru,
      description: "Описание RU.",
    },
  ])("returns $locale document title and og:title from PageTranslation.seoTitle", async ({
    locale,
    seoTitle,
    description,
  }) => {
    mocks.getServerTranslations.mockResolvedValue({
      locale,
      t: (key: string) =>
        key === "home.metaTitle" ? HOME_SEO_TITLE_BY_LOCALE[locale] : key,
    });
    mocks.getPageBySlug.mockResolvedValue({
      slug: "home",
      title: "TODAY, THIS.",
      excerpt: "H1 excerpt",
      seoTitle,
      seoDescription: description,
      content: {},
    });

    const metadata = await generateMetadata();

    expect(mocks.getPageBySlug).toHaveBeenCalledWith("home", locale);
    expect(metadata.title).toEqual({ absolute: seoTitle });
    expect(metadata.openGraph?.title).toBe(seoTitle);
    expect(metadata.description).toBe(description);
    expect(metadata.openGraph?.description).toBe(description);
  });

  it("falls back to home.metaTitle when seoTitle is empty (EN)", async () => {
    mocks.getServerTranslations.mockResolvedValue({
      locale: "en",
      t: (key: string) =>
        key === "home.metaTitle" ? HOME_SEO_TITLE_BY_LOCALE.en : key,
    });
    mocks.getPageBySlug.mockResolvedValue({
      slug: "home",
      title: "TODAY, THIS.",
      excerpt: null,
      seoTitle: null,
      seoDescription: "Meta description only.",
      content: {},
    });

    const metadata = await generateMetadata();
    expect(metadata.title).toEqual({ absolute: HOME_SEO_TITLE_BY_LOCALE.en });
    expect(metadata.openGraph?.title).toBe(HOME_SEO_TITLE_BY_LOCALE.en);
    expect(metadata.description).toBe("Meta description only.");
  });
});
