import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { product } = vi.hoisted(() => ({
  product: {
    id: "product-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    publishedAt: null,
    slug: "lava-ring",
    sku: "LAVA-1",
    name: "Lava Ring",
    seriesLabel: null,
    shortDescription: null,
    description: null,
    materialLine: null,
    symbolismLabel: null,
    symbolismTitle: null,
    symbolismBody: null,
    symbolismBody2: null,
    details: null,
    imageUrl: null,
    primaryAssetId: null,
    priceCents: 4500,
    status: "DRAFT" as const,
    visibility: "PRIVATE" as const,
    shopifyProductId: null,
    shopifyHandle: null,
    shopifyCategoryId: null,
    shopifyCategoryName: null,
    shopifyUpdatedAt: null,
    lastSyncedAt: null,
    syncStatus: "UNLINKED" as const,
    syncError: null,
    shopifySnapshot: null,
    extras: null,
    media: [],
    characteristics: [],
    variants: [],
    collections: [],
    tags: [],
    translations: [],
  },
}));

vi.mock("@/lib/auth/admin-session", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ username: "admin", sessionId: "s1" }),
}));

vi.mock("@/lib/content/catalog", () => ({
  getAdminCatalogData: vi.fn().mockResolvedValue({
    products: [product],
    collections: [],
  }),
}));

vi.mock("@/lib/i18n/admin-translation-locales", () => ({
  getAdminTranslationLocales: vi.fn().mockResolvedValue([{ code: "pt", label: "Português" }]),
}));

vi.mock("@/lib/shopify/catalog-conflict-signals-server", () => ({
  getCatalogConflictSignals: vi.fn().mockResolvedValue({
    state: "ready",
    totalCount: 0,
    checkedAt: null,
    products: {},
    recentlyUpdatedProducts: {},
  }),
}));

vi.mock("@/components/admin/products/product-incoming-update-marker", () => ({
  ProductIncomingUpdateMarker: () => null,
}));

vi.mock("@/app/admin/actions/products", () => ({
  saveProductAction: vi.fn(),
  deleteProductAction: vi.fn(),
  getSavedProductPayload: vi.fn(),
  updateProductMediaAltAction: vi.fn(),
  moveProductMediaAction: vi.fn(),
  removeProductMediaAction: vi.fn(),
  setPrimaryProductMediaAction: vi.fn(),
}));

vi.mock("@/app/admin/actions/sync", async () => {
  const { adminSyncActionMocks } = await import("@/test/mocks/admin-sync-actions");
  return { ...adminSyncActionMocks };
});

vi.mock("@/app/admin/actions/taxonomy", () => ({
  searchShopifyTaxonomyCategoriesAction: vi.fn().mockResolvedValue({ categories: [] }),
  getShopifyCategoryAttributesAction: vi.fn().mockResolvedValue({ attributes: [] }),
}));

vi.mock("@/app/admin/actions/product-organization", () => ({
  listShopifyProductOrganizationAction: vi.fn().mockResolvedValue({ options: [] }),
}));

vi.mock("@/app/admin/actions/sku-assign", () => ({
  loadSkuAssignContext: vi.fn().mockResolvedValue({
    configured: false,
    familyKeys: [],
    currentSku: null,
    pending: false,
  }),
  previewProductSkuAction: vi.fn(),
  assignProductSkuAction: vi.fn(),
  resumePendingSkuAction: vi.fn(),
}));

vi.mock("@/app/admin/actions/ai-content", () => ({
  generateProductContentAction: vi.fn(),
}));

vi.mock("@/components/admin/shared/admin-toast", () => ({
  useAdminToast: () => ({ pushToast: vi.fn() }),
}));

vi.mock("@/lib/admin/preserve-scroll", () => ({
  refreshPreservingScroll: vi.fn(),
}));

import EditProductPage from "@/app/admin/(admin)/products/[productId]/page";

describe("EditProductPage AI content flag", () => {
  const previous = process.env.AI_CONTENT_ENABLED;

  afterEach(() => {
    if (previous === undefined) delete process.env.AI_CONTENT_ENABLED;
    else process.env.AI_CONTENT_ENABLED = previous;
  });

  it("shows Generate with AI when AI_CONTENT_ENABLED=1", async () => {
    process.env.AI_CONTENT_ENABLED = "1";
    render(await EditProductPage({ params: Promise.resolve({ productId: "product-1" }) }));
    expect(screen.getByTestId("ai-content-generate-button")).toBeInTheDocument();
  });

  it("hides Generate with AI when AI_CONTENT_ENABLED=0", async () => {
    process.env.AI_CONTENT_ENABLED = "0";
    render(await EditProductPage({ params: Promise.resolve({ productId: "product-1" }) }));
    expect(screen.queryByTestId("ai-content-generate-button")).not.toBeInTheDocument();
  });
});
