import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  inspectProductSyncState: vi.fn(),
  getLatestReconcileDifferences: vi.fn(),
  getPublishedStorefrontLocales: vi.fn(),
  findManyProduct: vi.fn(),
  findUniqueProduct: vi.fn(),
  getLatestCatalogPresenceDifferences: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    product: {
      findMany: mocks.findManyProduct,
      findUnique: mocks.findUniqueProduct,
    },
  },
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
vi.mock("@/lib/shopify/catalog-presence-server", () => ({
  getLatestCatalogPresenceDifferences: mocks.getLatestCatalogPresenceDifferences,
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

function presenceDiff(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "shopify:42", kind: "SHOPIFY_ONLY", localProductId: null,
    shopifyProductId: "gid://shopify/Product/42", name: "Remote ring", handle: "remote-ring", sku: "R-42",
    localFingerprint: "missing", shopifyFingerprint: "remote-fp", remoteMissing: false, matchReason: null,
    localIdentity: null, shopifyIdentity: { name: "Remote ring", handle: "remote-ring", sku: "R-42" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPublishedStorefrontLocales.mockResolvedValue(LOCALES);
  mocks.getLatestReconcileDifferences.mockResolvedValue([]);
  mocks.findManyProduct.mockResolvedValue([]);
  mocks.findUniqueProduct.mockResolvedValue({ id: "product-1" });
  mocks.getLatestCatalogPresenceDifferences.mockResolvedValue([]);
});

describe("getProductCatalogConflict", () => {
  it("returns a one-direction presence field without inspecting a virtual local product", async () => {
    mocks.getLatestCatalogPresenceDifferences.mockResolvedValue([presenceDiff()]);

    const result = await getProductCatalogConflict("shopify:42");

    expect(mocks.inspectProductSyncState).not.toHaveBeenCalled();
    expect(mocks.findUniqueProduct).not.toHaveBeenCalled();
    expect(result.fields[0]).toMatchObject({
      origin: "PRESENCE",
      label: "Product exists only in Shopify",
      allowedDirections: ["SHOPIFY_TO_SYNARAVA"],
      synaravaValue: "— Product is missing —",
      shopifyValue: "Remote ring · SKU R-42",
    });
  });

  it("resolves a remapped Shopify-only row by Shopify GID after re-scan changes the presence id", async () => {
    mocks.getLatestCatalogPresenceDifferences.mockResolvedValue([presenceDiff({
      id: "local-matched",
      localProductId: "local-matched",
      matchReason: "SKU",
      localIdentity: { name: "Draft", handle: "draft", sku: "R-42" },
    })]);

    const result = await getProductCatalogConflict("shopify:42");

    expect(mocks.inspectProductSyncState).not.toHaveBeenCalled();
    expect(result.fields[0]?.presenceDifference?.id).toBe("local-matched");
    expect(result.fields[0]).toMatchObject({
      origin: "PRESENCE",
      synaravaValue: "Draft · SKU R-42",
    });
  });

  it("does not throw when a virtual Shopify-only id is gone from the presence snapshot", async () => {
    mocks.getLatestCatalogPresenceDifferences.mockResolvedValue([]);

    const result = await getProductCatalogConflict("shopify:42");

    expect(result.fields).toEqual([]);
    expect(mocks.inspectProductSyncState).not.toHaveBeenCalled();
    expect(mocks.findUniqueProduct).not.toHaveBeenCalled();
  });

  it("does not throw when a local product id no longer exists", async () => {
    mocks.findUniqueProduct.mockResolvedValue(null);

    const result = await getProductCatalogConflict("deleted-product");

    expect(result.fields).toEqual([]);
    expect(mocks.inspectProductSyncState).not.toHaveBeenCalled();
  });

  it("keeps local and Shopify identity distinct when Pull will link an existing local match", async () => {
    mocks.getLatestCatalogPresenceDifferences.mockResolvedValue([presenceDiff({
      id: "local-42",
      localProductId: "local-42",
      matchReason: "SKU",
      localIdentity: { name: "Local draft ring", handle: "draft-ring", sku: "R-42" },
    })]);

    const result = await getProductCatalogConflict("local-42");

    expect(result.fields[0]).toMatchObject({
      synaravaValue: "Local draft ring · SKU R-42",
      shopifyValue: "Remote ring · SKU R-42",
    });
  });

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

  it("gives a commerce field real, stable sha256 fingerprints and no sourceId (whole-product apply, not one row per field)", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(
      inspection({ state: "CONFLICT", differences: [{ field: "Vendor", local: "Synarava", shopify: "Other" }] }),
    );

    const result = await getProductCatalogConflict("product-1");

    const field = result.fields[0];
    expect(field.localFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(field.shopifyFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(field.localFingerprint).not.toEqual(field.shopifyFingerprint);
    expect(field.sourceId).toBeNull();

    // Same value on both sides -> same fingerprint, deterministic hash.
    mocks.inspectProductSyncState.mockResolvedValue(
      inspection({ state: "CONFLICT", differences: [{ field: "Vendor", local: "Same", shopify: "Same" }] }),
    );
    const same = await getProductCatalogConflict("product-1");
    expect(same.fields[0].localFingerprint).toEqual(same.fields[0].shopifyFingerprint);
  });

  it("carries the underlying divergence row id as sourceId on a translation field", async () => {
    mocks.inspectProductSyncState.mockResolvedValue(inspection());
    mocks.getLatestReconcileDifferences.mockResolvedValue([translationDiff({ id: "divergence-42" })]);

    const result = await getProductCatalogConflict("product-1");

    expect(result.fields[0].sourceId).toBe("divergence-42");
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

  it("includes one-sided catalog products from the persisted presence snapshot", async () => {
    mocks.getLatestCatalogPresenceDifferences.mockResolvedValue([
      presenceDiff(),
      presenceDiff({ id: "local-7", kind: "SYNARAVA_ONLY", localProductId: "local-7", shopifyProductId: null }),
    ]);

    const result = await listConflictedProductIds();

    expect(result.sort()).toEqual(["local-7", "shopify:42"]);
  });

  it("does not drop a product whose conflict came from an earlier, broader run than the most recent one", async () => {
    // No run-status gating: whatever getLatestReconcileDifferences returns is trusted as-is.
    mocks.getLatestReconcileDifferences.mockResolvedValue([translationDiff({ rootEntityId: "product-old-run" })]);

    const result = await listConflictedProductIds();

    expect(result).toEqual(["product-old-run"]);
  });
});
