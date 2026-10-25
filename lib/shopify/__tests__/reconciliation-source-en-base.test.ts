import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pageFindUnique: vi.fn(),
  pageUpdate: vi.fn(),
  pageTranslationUpdate: vi.fn(),
  getPublishedStorefrontLocales: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    page: {
      findUnique: mocks.pageFindUnique,
      update: mocks.pageUpdate,
    },
    pageTranslation: {
      update: mocks.pageTranslationUpdate,
    },
  },
}));

vi.mock("@/lib/i18n/storefront-locale-cache", () => ({
  getPublishedStorefrontLocales: mocks.getPublishedStorefrontLocales,
}));

import {
  loadReconcileSubject,
  writeLocalReconcileField,
} from "@/lib/shopify/reconciliation-source";

const pageBinding = {
  id: "binding-page-1",
  resourceType: "PAGE" as const,
  entityId: "page-1",
  shopifyResourceId: "gid://shopify/OnlineStorePage/1",
};

describe("reconciliation-source EN base columns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPublishedStorefrontLocales.mockResolvedValue([
      { code: "en", isDefault: true, shopifyLocale: "en" },
      { code: "pt", isDefault: false, shopifyLocale: "pt-PT" },
    ]);
  });

  it("loads page EN title from base columns", async () => {
    mocks.pageFindUnique.mockResolvedValue({
      id: "page-1",
      title: "Home",
      slug: "home",
      excerpt: null,
      content: null,
      seoTitle: null,
      seoDescription: null,
      translations: [],
    });

    const subject = await loadReconcileSubject(pageBinding, "en");

    expect(subject?.local.title).toBe("Home");
    expect(mocks.pageFindUnique).toHaveBeenCalled();
  });

  it("applies page EN title conflict to Page base column", async () => {
    mocks.pageFindUnique.mockResolvedValue({
      id: "page-1",
      title: "Home",
      slug: "home",
      excerpt: null,
      content: null,
      seoTitle: null,
      seoDescription: null,
      translations: [],
    });
    mocks.pageUpdate.mockResolvedValue({});

    await writeLocalReconcileField({
      binding: pageBinding,
      locale: "en",
      fieldKey: "title",
      shopifyValue: "Home EN",
    });

    expect(mocks.pageUpdate).toHaveBeenCalledWith({
      where: { id: "page-1" },
      data: { title: "Home EN" },
    });
    expect(mocks.pageTranslationUpdate).not.toHaveBeenCalled();
  });
});
