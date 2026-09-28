import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildOpenGraphLocales, toOpenGraphLocale } from "../open-graph-locale";

vi.mock("@/lib/i18n/storefront-locale-cache", () => ({
  getPublishedStorefrontLocales: vi.fn(),
}));

import { getPublishedStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";

const mockPublished = vi.mocked(getPublishedStorefrontLocales);

describe("toOpenGraphLocale", () => {
  it("maps storefront locales to og:locale underscore tags", () => {
    expect(toOpenGraphLocale("en")).toBe("en_IE");
    expect(toOpenGraphLocale("pt")).toBe("pt_PT");
    expect(toOpenGraphLocale("ru")).toBe("ru_RU");
  });
});

describe("buildOpenGraphLocales", () => {
  beforeEach(() => {
    mockPublished.mockResolvedValue([
      { routeSegment: "en", isDefault: true },
      { routeSegment: "pt", isDefault: false },
      { routeSegment: "ru", isDefault: false },
    ] as Awaited<ReturnType<typeof getPublishedStorefrontLocales>>);
  });

  it("returns current locale and other published alternates", async () => {
    await expect(buildOpenGraphLocales("ru")).resolves.toEqual({
      locale: "ru_RU",
      alternateLocale: ["en_IE", "pt_PT"],
    });
  });
});
