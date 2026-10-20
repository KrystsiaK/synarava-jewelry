import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: { storefrontLocale: { findMany: mocks.findMany } },
}));

import { buildAlternates } from "@/lib/seo/alternates";
import { buildOpenGraphLocales } from "@/lib/seo/open-graph-locale";
import { invalidateStorefrontLocaleCache } from "@/lib/i18n/storefront-locale-cache";

const ROWS = [
  {
    routeSegment: "en",
    isDefault: true,
    status: "PUBLISHED",
    isPublished: true,
    deletedAt: null,
    retiredAt: null,
  },
  {
    routeSegment: "pt",
    isDefault: false,
    status: "PUBLISHED",
    isPublished: true,
    deletedAt: null,
    retiredAt: null,
  },
  {
    routeSegment: "ru",
    isDefault: false,
    status: "RETIRED",
    isPublished: false,
    deletedAt: null,
    retiredAt: new Date(),
  },
  {
    routeSegment: "de",
    isDefault: false,
    status: "DRAFT",
    isPublished: false,
    deletedAt: null,
    retiredAt: null,
  },
];

beforeEach(() => {
  mocks.findMany.mockReset();
  mocks.findMany.mockResolvedValue(ROWS);
  invalidateStorefrontLocaleCache();
});

describe("A4 SEO published locales only", () => {
  it("omits Draft and Retired from hreflang alternates", async () => {
    const alternates = await buildAlternates("en", "/shop");
    expect(Object.keys(alternates.languages).sort()).toEqual(["en", "pt", "x-default"]);
  });

  it("omits Draft and Retired from Open Graph alternate locales", async () => {
    const og = await buildOpenGraphLocales("en");
    expect(og.alternateLocale).toEqual(["pt_PT"]);
  });
});
