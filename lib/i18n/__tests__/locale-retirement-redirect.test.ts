import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  productTranslationFindFirst: vi.fn(),
  productFindUnique: vi.fn(),
  productFindFirst: vi.fn(),
  collectionTranslationFindFirst: vi.fn(),
  collectionFindUnique: vi.fn(),
  collectionFindFirst: vi.fn(),
  pageTranslationFindFirst: vi.fn(),
  pageFindUnique: vi.fn(),
  pageFindFirst: vi.fn(),
  findLocalizedHandleRedirect: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    productTranslation: { findFirst: mocks.productTranslationFindFirst },
    product: { findUnique: mocks.productFindUnique, findFirst: mocks.productFindFirst },
    collectionTranslation: { findFirst: mocks.collectionTranslationFindFirst },
    collection: { findUnique: mocks.collectionFindUnique, findFirst: mocks.collectionFindFirst },
    pageTranslation: { findFirst: mocks.pageTranslationFindFirst },
    page: { findUnique: mocks.pageFindUnique, findFirst: mocks.pageFindFirst },
  },
}));

vi.mock("@/lib/content/handle-redirects", () => ({
  findLocalizedHandleRedirect: mocks.findLocalizedHandleRedirect,
}));

import {
  buildDefaultLocaleRedirectPath,
  dispositionForLocaleSegment,
  resolveLocaleRequestDisposition,
} from "@/lib/i18n/locale-retirement-redirect";
import { resetRegisteredRouteSegmentsForTests, setRegisteredRouteSegments } from "@/lib/i18n/registered-route-segments";
import type { StorefrontLocaleRecord } from "@/lib/i18n/storefront-locale-registry";

const LOCALES: StorefrontLocaleRecord[] = [
  {
    id: "1",
    code: "en",
    routeSegment: "en",
    shopifyLocale: "en",
    intlLocale: "en",
    name: "English",
    nativeName: "English",
    isDefault: true,
    status: "PUBLISHED",
    isPublished: true,
    sortOrder: 0,
    retiredAt: null,
    deletedAt: null,
    shopifyUpdatedAt: null,
  },
  {
    id: "2",
    code: "pt",
    routeSegment: "pt",
    shopifyLocale: "pt-PT",
    intlLocale: "pt-PT",
    name: "Portuguese",
    nativeName: "Português",
    isDefault: false,
    status: "PUBLISHED",
    isPublished: true,
    sortOrder: 1,
    retiredAt: null,
    deletedAt: null,
    shopifyUpdatedAt: null,
  },
  {
    id: "3",
    code: "ru",
    routeSegment: "ru",
    shopifyLocale: "ru",
    intlLocale: "ru",
    name: "Russian",
    nativeName: "Русский",
    isDefault: false,
    status: "DRAFT",
    isPublished: false,
    sortOrder: 2,
    retiredAt: null,
    deletedAt: null,
    shopifyUpdatedAt: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  resetRegisteredRouteSegmentsForTests();
  setRegisteredRouteSegments(["en", "pt", "ru"]);
  mocks.findLocalizedHandleRedirect.mockResolvedValue(null);
  mocks.productTranslationFindFirst.mockResolvedValue(null);
  mocks.productFindUnique.mockResolvedValue(null);
  mocks.productFindFirst.mockResolvedValue(null);
  mocks.collectionTranslationFindFirst.mockResolvedValue(null);
  mocks.collectionFindUnique.mockResolvedValue(null);
  mocks.collectionFindFirst.mockResolvedValue(null);
  mocks.pageTranslationFindFirst.mockResolvedValue(null);
  mocks.pageFindUnique.mockResolvedValue(null);
  mocks.pageFindFirst.mockResolvedValue(null);
});

describe("dispositionForLocaleSegment", () => {
  it("allows published and default locales", () => {
    expect(dispositionForLocaleSegment(LOCALES[0])).toBe("allow");
    expect(dispositionForLocaleSegment(LOCALES[1])).toBe("allow");
  });

  it("404s draft locales that were never published", () => {
    expect(dispositionForLocaleSegment(LOCALES[2])).toBe("not-found");
  });

  it("redirects retired and deleted locales", () => {
    expect(
      dispositionForLocaleSegment({
        ...LOCALES[2],
        status: "RETIRED",
        retiredAt: new Date(),
      }),
    ).toBe("redirect");
    expect(
      dispositionForLocaleSegment({
        ...LOCALES[2],
        status: "RETIRED",
        deletedAt: new Date(),
      }),
    ).toBe("redirect");
  });
});

describe("buildDefaultLocaleRedirectPath", () => {
  it("swaps locale on ordinary paths", async () => {
    expect(await buildDefaultLocaleRedirectPath("ru", "/ru/shop", "en")).toBe("/en/shop");
    expect(await buildDefaultLocaleRedirectPath("ru", "/ru", "en")).toBe("/en");
  });

  it("remaps a translated product handle to the English slug", async () => {
    mocks.productTranslationFindFirst.mockResolvedValue({ product: { slug: "oak-ring" } });
    expect(await buildDefaultLocaleRedirectPath("ru", "/ru/products/dubovoe-kolco", "en")).toBe(
      "/en/products/oak-ring",
    );
  });

  it("falls back to the default home when no product match exists", async () => {
    expect(await buildDefaultLocaleRedirectPath("ru", "/ru/products/missing", "en")).toBe("/en");
  });
});

describe("resolveLocaleRequestDisposition", () => {
  it("returns not-found for draft ru and allow for published pt", async () => {
    expect(
      await resolveLocaleRequestDisposition({
        localeSegment: "ru",
        pathname: "/ru/shop",
        locales: LOCALES,
      }),
    ).toEqual({ kind: "not-found" });
    expect(
      await resolveLocaleRequestDisposition({
        localeSegment: "pt",
        pathname: "/pt/shop",
        locales: LOCALES,
      }),
    ).toEqual({ kind: "allow" });
  });

  it("returns a permanent redirect for a retired locale", async () => {
    const retired = LOCALES.map((locale) =>
      locale.code === "ru"
        ? { ...locale, status: "RETIRED" as const, isPublished: false, retiredAt: new Date() }
        : locale,
    );
    expect(
      await resolveLocaleRequestDisposition({
        localeSegment: "ru",
        pathname: "/ru/shop",
        locales: retired,
      }),
    ).toEqual({ kind: "redirect", pathname: "/en/shop", status: 301 });
  });

  it("404s an unknown locale segment", async () => {
    expect(
      await resolveLocaleRequestDisposition({
        localeSegment: "de",
        pathname: "/de",
        locales: LOCALES,
      }),
    ).toEqual({ kind: "not-found" });
  });
});
