import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  syncPage: vi.fn(),
  syncCopy: vi.fn(),
  pushProduct: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/admin-session", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@/lib/shopify/admin", () => ({ hasShopifyAdminConfig: () => true }));
vi.mock("@/lib/shopify/editorial-translation-sync", () => ({
  syncPageEditorialTranslation: mocks.syncPage,
  syncStorefrontCopyTranslation: mocks.syncCopy,
}));
vi.mock("@/lib/shopify/product-sync", () => ({ pushProductToShopify: mocks.pushProduct }));
vi.mock("@/lib/shopify/collection-translations", () => ({ registerCollectionTranslation: vi.fn() }));
vi.mock("@/lib/shopify/translation-sync", () => ({ ensureTranslationBinding: vi.fn(), recordSyncEvent: vi.fn() }));
vi.mock("@/lib/i18n/storefront-locale-registry", () => ({
  listStorefrontLocales: vi.fn().mockResolvedValue([
    { code: "en", routeSegment: "en", shopifyLocale: "en", name: "English", nativeName: "English", isDefault: true, isPublished: true },
    { code: "pt", routeSegment: "pt", shopifyLocale: "pt-PT", name: "Portuguese", nativeName: "Português", isDefault: false, isPublished: true },
  ]),
}));
vi.mock("@/lib/db", () => ({ db: {} }));

import { retryTranslationSyncAction } from "@/app/admin/actions/translation-sync";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdminSession.mockResolvedValue({ username: "editor@example.com" });
  mocks.syncPage.mockResolvedValue([
    { target: "PAGE", status: "SUCCEEDED" },
    { target: "METAOBJECT", status: "SUCCEEDED" },
  ]);
});

describe("retryTranslationSyncAction", () => {
  it("passes the authenticated actor to an idempotent Page sync", async () => {
    await expect(retryTranslationSyncAction("PAGE", "page-1")).resolves.toEqual({ success: "Translation synced." });
    expect(mocks.syncPage).toHaveBeenCalledWith("page-1", expect.objectContaining({ code: "pt" }), "editor@example.com");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/translations");
  });

  it("reports a target failure without claiming the retry succeeded", async () => {
    mocks.syncPage.mockResolvedValue([{ target: "PAGE", status: "FAILED", error: "Locale disabled" }]);
    await expect(retryTranslationSyncAction("PAGE", "page-1")).resolves.toEqual({ error: "Locale disabled" });
  });
});
