import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  getPublishedStorefrontLocales: vi.fn(),
  getStorefrontLocales: vi.fn(),
  headersGet: vi.fn(() => "/en"),
  resolveStorefrontAnnouncementMessage: vi.fn(async () => "Free shipping from €45"),
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

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: mocks.headersGet,
  }),
}));

vi.mock("@/lib/content/resolve-storefront-announcement-message", () => ({
  resolveStorefrontAnnouncementMessage: mocks.resolveStorefrontAnnouncementMessage,
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

function childrenOf(node: ReactNode): ReactNode[] {
  if (!isValidElement(node)) return [node];
  const el = node as ReactElement<{ children?: ReactNode }>;
  const kids = el.props.children;
  if (kids == null) return [];
  return Array.isArray(kids) ? kids : [kids];
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headersGet.mockReturnValue("/en");
  mocks.resolveStorefrontAnnouncementMessage.mockResolvedValue("Free shipping from €45");
  mocks.getPublishedStorefrontLocales.mockResolvedValue(ALL.filter((locale) => locale.status === "PUBLISHED"));
  mocks.getStorefrontLocales.mockResolvedValue(ALL);
});

describe("generateStaticParams", () => {
  it("pre-renders one param per published locale", async () => {
    expect(await generateStaticParams()).toEqual([{ locale: "en" }, { locale: "pt" }]);
  });
});

describe("LocaleLayout", () => {
  it("mounts layout marquee on home", async () => {
    mocks.headersGet.mockReturnValue("/en");
    const result = await LocaleLayout({ children: "content", params: Promise.resolve({ locale: "pt" }) });
    const kids = childrenOf(result);
    expect(kids).toContain("content");
    expect(mocks.resolveStorefrontAnnouncementMessage).toHaveBeenCalledTimes(1);
    const marquee = kids.find(
      (child) => isValidElement(child) && child.props && (child.props as { message?: string }).message,
    ) as ReactElement<{ message: string }> | undefined;
    expect(marquee?.props.message).toBe("Free shipping from €45");
  });

  it("mounts layout marquee on allowlisted storefront routes", async () => {
    mocks.headersGet.mockReturnValue("/en/shop");
    const result = await LocaleLayout({ children: "shop", params: Promise.resolve({ locale: "en" }) });
    const kids = childrenOf(result);
    expect(kids).toContain("shop");
    expect(mocks.resolveStorefrontAnnouncementMessage).toHaveBeenCalledTimes(1);
    const marquee = kids.find(
      (child) => isValidElement(child) && child.props && (child.props as { message?: string }).message,
    ) as ReactElement<{ message: string }> | undefined;
    expect(marquee?.props.message).toBe("Free shipping from €45");
  });

  it("skips layout marquee on about", async () => {
    mocks.headersGet.mockReturnValue("/en/about");
    const result = await LocaleLayout({ children: "about", params: Promise.resolve({ locale: "en" }) });
    const kids = childrenOf(result);
    expect(kids).toEqual(["about"]);
    expect(mocks.resolveStorefrontAnnouncementMessage).not.toHaveBeenCalled();
  });

  it("skips layout marquee when message resolves empty", async () => {
    mocks.headersGet.mockReturnValue("/en/cart");
    mocks.resolveStorefrontAnnouncementMessage.mockResolvedValue(null);
    const result = await LocaleLayout({ children: "cart", params: Promise.resolve({ locale: "en" }) });
    const kids = childrenOf(result);
    expect(kids).toEqual(["cart"]);
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
