import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  inspectProductSyncState: vi.fn(),
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

    const result = await getProductCatalogConflict("product-1");

    expect(result.fields).toEqual([]);
  });

  it("includes a SHARED commerce field only when commerce state is CONFLICT", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(
      inspection({ state: "CONFLICT", differences: [{ field: "Vendor", local: "Synarava", shopify: "Other" }] }),
    );

    const result = await getProductCatalogConflict("product-1");

    expect(result.fields).toHaveLength(1);
    expect(result.fields[0]).toMatchObject({ scope: { kind: "SHARED" }, origin: "COMMERCE", label: "Vendor" });
  });

  it("drops one-directional commerce state without surfacing a conflict field", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(
      inspection({ state: "REMOTE_CHANGES", differences: [{ field: "Vendor", local: "Synarava", shopify: "Other" }] }),
    );

    const result = await getProductCatalogConflict("product-1");

    expect(result.fields).toEqual([]);
  });

  it("excludes a commerce EN-duplicate label only when translation reconcile actually reports that exact field as conflicting under en", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(
      inspection({ state: "CONFLICT", differences: [{ field: "Name", local: "A", shopify: "B" }] }),
    );
    mocks.getLatestReconcileDifferences.mockResolvedValue([translationDiff({ locale: "en", fieldKey: "title" })]);

    const result = await getProductCatalogConflict("product-1");

    // Only the translation-origin field remains — the commerce duplicate is dropped, not lost.
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0]).toMatchObject({ origin: "TRANSLATION", scope: { code: "en" } });
  });

  it("keeps the commerce EN-duplicate label whenever translation reconcile has not reported that exact field for en — never inferred merely from a binding existing", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(
      inspection({ state: "CONFLICT", differences: [{ field: "Name", local: "A", shopify: "B" }] }),
    );
    // No translation differences at all — e.g. the binding exists but this
    // product hasn't been (re)checked yet, or a run has simply never
    // reported "title" as conflicting under en.
    mocks.getLatestReconcileDifferences.mockResolvedValue([]);

    const result = await getProductCatalogConflict("product-1");

    expect(result.fields).toHaveLength(1);
    expect(result.fields[0]).toMatchObject({ origin: "COMMERCE", label: "Name" });
  });

  it("keeps the commerce EN-duplicate label when translation reconcile only conflicts on a different field (e.g. PT title)", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(
      inspection({ state: "CONFLICT", differences: [{ field: "Name", local: "A", shopify: "B" }] }),
    );
    mocks.getLatestReconcileDifferences.mockResolvedValue([translationDiff({ locale: "pt-PT", fieldKey: "title" })]);

    const result = await getProductCatalogConflict("product-1");

    expect(result.fields).toHaveLength(2);
    expect(result.fields.some((field) => field.origin === "COMMERCE" && field.label === "Name")).toBe(true);
  });

  it("resolves a PT translation conflict to its registry locale name", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(inspection());
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
    mocks.getLatestReconcileDifferences.mockResolvedValue([translationDiff({ locale: "en" })]);

    const result = await getProductCatalogConflict("product-1");

    expect(result.fields[0].scope).toEqual({ kind: "LOCALE", code: "en", name: "English", nativeName: "English" });
  });

  it("resolves a RU translation conflict", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(inspection());
    mocks.getLatestReconcileDifferences.mockResolvedValue([translationDiff({ locale: "ru", fieldLabel: "Title" })]);

    const result = await getProductCatalogConflict("product-1");

    expect(result.fields[0].scope).toMatchObject({ code: "ru", nativeName: "Русский" });
  });

  it("resolves a fourth registered locale (DE) with no hardcoded locale list", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(inspection());
    mocks.getLatestReconcileDifferences.mockResolvedValue([translationDiff({ locale: "de" })]);

    const result = await getProductCatalogConflict("product-1");

    expect(result.fields[0].scope).toMatchObject({ code: "de", nativeName: "Deutsch" });
  });

  it("keeps multiple locales of the same product as separate fields", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(inspection());
    mocks.getLatestReconcileDifferences.mockResolvedValue([
      translationDiff({ id: "diff-pt", locale: "pt-PT" }),
      translationDiff({ id: "diff-ru", locale: "ru" }),
    ]);

    const result = await getProductCatalogConflict("product-1");

    expect(result.fields.map((field) => (field.scope as { code: string }).code).sort()).toEqual(["pt", "ru"]);
  });

  it("does not let one product's translation conflict leak into another product's result", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(inspection());
    mocks.getLatestReconcileDifferences.mockResolvedValue([translationDiff({ rootEntityId: "product-2" })]);

    const result = await getProductCatalogConflict("product-1");

    expect(result.fields).toEqual([]);
  });

  it("does not treat a missing translation (LOCAL_ONLY/SHOPIFY_ONLY) as a conflict", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(inspection());
    mocks.getLatestReconcileDifferences.mockResolvedValue([
      translationDiff({ kind: "SHOPIFY_ONLY" }),
      translationDiff({ kind: "LOCAL_ONLY" }),
    ]);

    const result = await getProductCatalogConflict("product-1");

    expect(result.fields).toEqual([]);
  });

  it("still surfaces a translation conflict even when the most recent reconcile run elsewhere was scoped/failed", async () => {
    // getLatestReconcileDifferences is the source of truth here regardless of
    // any run's own status — this product's row simply exists or it doesn't.
    mocks.inspectProductSyncState.mockResolvedValue(inspection());
    mocks.getLatestReconcileDifferences.mockResolvedValue([translationDiff()]);

    const result = await getProductCatalogConflict("product-1");

    expect(result.fields).toHaveLength(1);
  });
});

describe("listConflictedProductIds", () => {
  it("unions commerce-flagged products with translation-conflicted products", async () => {
    mocks.findManyProduct.mockResolvedValue([{ id: "product-commerce" }]);
    mocks.getLatestReconcileDifferences.mockResolvedValue([
      translationDiff({ rootEntityId: "product-translation" }),
      translationDiff({ rootEntityId: "product-translation", locale: "ru" }),
    ]);

    const result = await listConflictedProductIds();

    expect(result.sort()).toEqual(["product-commerce", "product-translation"]);
    expect(mocks.findManyProduct).toHaveBeenCalledWith({ where: { syncStatus: "CONFLICT" }, select: { id: true } });
  });

  it("does not drop a product whose conflict came from an earlier, broader run than the most recent one", async () => {
    // No run-status gating: whatever getLatestReconcileDifferences returns is trusted as-is.
    mocks.getLatestReconcileDifferences.mockResolvedValue([translationDiff({ rootEntityId: "product-old-run" })]);

    const result = await listConflictedProductIds();

    expect(result).toEqual(["product-old-run"]);
  });
});
