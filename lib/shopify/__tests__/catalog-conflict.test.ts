import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  inspectProductSyncState: vi.fn(),
  getLatestReconcileRun: vi.fn(),
  getLatestReconcileDifferences: vi.fn(),
  getPublishedStorefrontLocales: vi.fn(),
  findManyProduct: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { product: { findMany: mocks.findManyProduct } },
}));
vi.mock("@/lib/shopify/product-sync", () => ({
  inspectProductSyncState: mocks.inspectProductSyncState,
}));
vi.mock("@/lib/shopify/reconciliation-run", () => ({
  getLatestReconcileRun: mocks.getLatestReconcileRun,
  getLatestReconcileDifferences: mocks.getLatestReconcileDifferences,
}));
vi.mock("@/lib/i18n/storefront-locale-cache", () => ({
  getPublishedStorefrontLocales: mocks.getPublishedStorefrontLocales,
}));

import { getProductCatalogConflict, listConflictedProductIds } from "@/lib/shopify/catalog-conflict";

const LOCALES = [
  { code: "en", shopifyLocale: "en", isDefault: true, name: "English", nativeName: "English" },
  { code: "pt", shopifyLocale: "pt-PT", isDefault: false, name: "Portuguese", nativeName: "Português" },
  { code: "ru", shopifyLocale: "ru", isDefault: false, name: "Russian", nativeName: "Русский" },
  { code: "de", shopifyLocale: "de", isDefault: false, name: "German", nativeName: "Deutsch" },
];

function inspection(overrides: Partial<Record<string, unknown>> = {}) {
  return { state: "SYNCED", remoteUpdatedAt: null, publications: [], differences: [], ...overrides };
}

function run(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "run-1", trigger: "MANUAL", status: "SUCCEEDED", checkedCount: 1, differenceCount: 0,
    error: null, startedAt: "2026-09-22T00:00:00.000Z", completedAt: "2026-09-22T00:01:00.000Z",
    createdAt: "2026-09-22T00:00:00.000Z", ...overrides,
  };
}

function translationDiff(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "diff-1", runId: "run-1", bindingId: "binding-1", rootEntityType: "PRODUCT", rootEntityId: "product-1",
    entityLabel: "Ring", locale: "pt-PT", fieldKey: "title", fieldLabel: "Title", targetKind: "NATIVE",
    kind: "CONFLICT", baseValue: null, localValue: "Anel", shopifyValue: "Anel PT",
    localFingerprint: "fp-local", shopifyFingerprint: "fp-shopify", shopifyUpdatedAt: null, shopifyOutdated: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPublishedStorefrontLocales.mockResolvedValue(LOCALES);
  mocks.getLatestReconcileDifferences.mockResolvedValue([]);
  mocks.findManyProduct.mockResolvedValue([]);
});

describe("getProductCatalogConflict", () => {
  it("returns no fields when neither side has a conflict", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(inspection());
    mocks.getLatestReconcileRun.mockResolvedValue(run());

    const result = await getProductCatalogConflict("product-1");

    expect(result.fields).toEqual([]);
    expect(result.translationChecked).toBe(true);
  });

  it("includes a SHARED commerce field only when commerce state is CONFLICT", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(
      inspection({ state: "CONFLICT", differences: [{ field: "Vendor", local: "Synarava", shopify: "Other" }] }),
    );
    mocks.getLatestReconcileRun.mockResolvedValue(run());

    const result = await getProductCatalogConflict("product-1");

    expect(result.fields).toHaveLength(1);
    expect(result.fields[0]).toMatchObject({ scope: { kind: "SHARED" }, origin: "COMMERCE", label: "Vendor" });
  });

  it("drops one-directional commerce state without surfacing a conflict field", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(
      inspection({ state: "REMOTE_CHANGES", differences: [{ field: "Vendor", local: "Synarava", shopify: "Other" }] }),
    );
    mocks.getLatestReconcileRun.mockResolvedValue(run());

    const result = await getProductCatalogConflict("product-1");

    expect(result.fields).toEqual([]);
  });

  it("excludes commerce differences that duplicate locale content covered by translation reconcile", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(
      inspection({ state: "CONFLICT", differences: [{ field: "Name", local: "A", shopify: "B" }] }),
    );
    mocks.getLatestReconcileRun.mockResolvedValue(run());

    const result = await getProductCatalogConflict("product-1");

    expect(result.fields).toEqual([]);
  });

  it("resolves a PT translation conflict to its registry locale name", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(inspection());
    mocks.getLatestReconcileRun.mockResolvedValue(run());
    mocks.getLatestReconcileDifferences.mockResolvedValue([translationDiff()]);

    const result = await getProductCatalogConflict("product-1");

    expect(result.fields).toHaveLength(1);
    expect(result.fields[0]).toMatchObject({
      scope: { kind: "LOCALE", code: "pt", name: "Portuguese", nativeName: "Português" },
      origin: "TRANSLATION",
      synaravaValue: "Anel",
      shopifyValue: "Anel PT",
      localFingerprint: "fp-local",
      shopifyFingerprint: "fp-shopify",
    });
  });

  it("resolves the EN source locale distinctly from other locales", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(inspection());
    mocks.getLatestReconcileRun.mockResolvedValue(run());
    mocks.getLatestReconcileDifferences.mockResolvedValue([translationDiff({ locale: "en" })]);

    const result = await getProductCatalogConflict("product-1");

    expect(result.fields[0].scope).toEqual({ kind: "LOCALE", code: "en", name: "English", nativeName: "English" });
  });

  it("resolves a RU translation conflict", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(inspection());
    mocks.getLatestReconcileRun.mockResolvedValue(run());
    mocks.getLatestReconcileDifferences.mockResolvedValue([translationDiff({ locale: "ru", fieldLabel: "Title" })]);

    const result = await getProductCatalogConflict("product-1");

    expect(result.fields[0].scope).toMatchObject({ code: "ru", nativeName: "Русский" });
  });

  it("resolves a fourth registered locale (DE) with no hardcoded locale list", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(inspection());
    mocks.getLatestReconcileRun.mockResolvedValue(run());
    mocks.getLatestReconcileDifferences.mockResolvedValue([translationDiff({ locale: "de" })]);

    const result = await getProductCatalogConflict("product-1");

    expect(result.fields[0].scope).toMatchObject({ code: "de", nativeName: "Deutsch" });
  });

  it("keeps multiple locales of the same product as separate fields", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(inspection());
    mocks.getLatestReconcileRun.mockResolvedValue(run());
    mocks.getLatestReconcileDifferences.mockResolvedValue([
      translationDiff({ id: "diff-pt", locale: "pt-PT" }),
      translationDiff({ id: "diff-ru", locale: "ru" }),
    ]);

    const result = await getProductCatalogConflict("product-1");

    expect(result.fields.map((field) => (field.scope as { code: string }).code).sort()).toEqual(["pt", "ru"]);
  });

  it("does not let one product's translation conflict leak into another product's result", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(inspection());
    mocks.getLatestReconcileRun.mockResolvedValue(run());
    mocks.getLatestReconcileDifferences.mockResolvedValue([translationDiff({ rootEntityId: "product-2" })]);

    const result = await getProductCatalogConflict("product-1");

    expect(result.fields).toEqual([]);
  });

  it("does not treat a missing translation (LOCAL_ONLY/SHOPIFY_ONLY) as a conflict", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(inspection());
    mocks.getLatestReconcileRun.mockResolvedValue(run());
    mocks.getLatestReconcileDifferences.mockResolvedValue([
      translationDiff({ kind: "SHOPIFY_ONLY" }),
      translationDiff({ kind: "LOCAL_ONLY" }),
    ]);

    const result = await getProductCatalogConflict("product-1");

    expect(result.fields).toEqual([]);
  });

  it("marks the translation portion unchecked instead of reporting zero conflicts when the run is stale/failed", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(inspection());
    mocks.getLatestReconcileRun.mockResolvedValue(run({ status: "FAILED" }));
    mocks.getLatestReconcileDifferences.mockResolvedValue([translationDiff()]);

    const result = await getProductCatalogConflict("product-1");

    expect(result.translationChecked).toBe(false);
    expect(result.fields).toEqual([]);
    expect(mocks.getLatestReconcileDifferences).not.toHaveBeenCalled();
  });

  it("treats a missing run (never checked) as unchecked, not zero conflicts", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(inspection());
    mocks.getLatestReconcileRun.mockResolvedValue(null);

    const result = await getProductCatalogConflict("product-1");

    expect(result.translationChecked).toBe(false);
  });
});

describe("listConflictedProductIds", () => {
  it("unions commerce-flagged products with translation-conflicted products", async () => {
    mocks.findManyProduct.mockResolvedValue([{ id: "product-commerce" }]);
    mocks.getLatestReconcileRun.mockResolvedValue(run());
    mocks.getLatestReconcileDifferences.mockResolvedValue([
      translationDiff({ rootEntityId: "product-translation" }),
      translationDiff({ rootEntityId: "product-translation", locale: "ru" }),
    ]);

    const result = await listConflictedProductIds();

    expect(result.productIds.sort()).toEqual(["product-commerce", "product-translation"]);
    expect(mocks.findManyProduct).toHaveBeenCalledWith({ where: { syncStatus: "CONFLICT" }, select: { id: true } });
  });

  it("excludes translation ids when the run is stale, but keeps the cheap commerce flag", async () => {
    mocks.findManyProduct.mockResolvedValue([{ id: "product-commerce" }]);
    mocks.getLatestReconcileRun.mockResolvedValue(run({ status: "QUEUED" }));

    const result = await listConflictedProductIds();

    expect(result.productIds).toEqual(["product-commerce"]);
    expect(result.translationChecked).toBe(false);
  });
});
