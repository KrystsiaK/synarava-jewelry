import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProductCatalogConflict: vi.fn(),
  listConflictedProductIds: vi.fn(),
  pushProductToShopify: vi.fn(),
  pullShopifyProduct: vi.fn(),
  applyReconcileChoice: vi.fn(),
  findUniqueProduct: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { product: { findUnique: mocks.findUniqueProduct } },
}));
vi.mock("@/lib/shopify/catalog-conflict", async () => {
  const actual = await vi.importActual<typeof import("@/lib/shopify/catalog-conflict")>("@/lib/shopify/catalog-conflict");
  return {
    ...actual,
    getProductCatalogConflict: mocks.getProductCatalogConflict,
    listConflictedProductIds: mocks.listConflictedProductIds,
  };
});
vi.mock("@/lib/shopify/product-sync", () => ({
  pushProductToShopify: mocks.pushProductToShopify,
  pullShopifyProduct: mocks.pullShopifyProduct,
}));
vi.mock("@/lib/shopify/reconciliation-apply", () => ({
  applyReconcileChoice: mocks.applyReconcileChoice,
}));

import { applyCatalogConflictResolution, previewCatalogConflictResolution } from "@/lib/shopify/catalog-conflict-apply";
import type { CatalogConflictField, ProductCatalogConflict } from "@/lib/shopify/catalog-conflict";

function commerceField(overrides: Partial<CatalogConflictField> = {}): CatalogConflictField {
  return {
    fieldKey: "commerce:vendor",
    label: "Vendor",
    scope: { kind: "SHARED" },
    origin: "COMMERCE",
    targetKind: "NATIVE",
    synaravaValue: "Synarava",
    shopifyValue: "Other",
    baseValue: null,
    localFingerprint: "local-fp",
    shopifyFingerprint: "shopify-fp",
    allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
    blockedReason: null,
    sourceId: null,
    ...overrides,
  };
}

function translationField(overrides: Partial<CatalogConflictField> = {}): CatalogConflictField {
  return {
    fieldKey: "translation:pt-PT:title",
    label: "Title",
    scope: { kind: "LOCALE", code: "pt", name: "Portuguese", nativeName: "Português" },
    origin: "TRANSLATION",
    targetKind: "NATIVE",
    synaravaValue: "Anel",
    shopifyValue: "Anel PT",
    baseValue: null,
    localFingerprint: "local-fp",
    shopifyFingerprint: "shopify-fp",
    allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
    blockedReason: null,
    sourceId: "divergence-1",
    ...overrides,
  };
}

function conflict(fields: CatalogConflictField[], productId = "product-1"): ProductCatalogConflict {
  return { productId, fields };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("previewCatalogConflictResolution", () => {
  it("resolves a BULK scope from listConflictedProductIds", async () => {
    mocks.listConflictedProductIds.mockResolvedValue(["product-1", "product-2"]);
    mocks.getProductCatalogConflict.mockImplementation(async (productId: string) => conflict([commerceField()], productId));

    const preview = await previewCatalogConflictResolution({ kind: "BULK", direction: "SHOPIFY_TO_SYNARAVA" });

    expect(preview.entries).toHaveLength(2);
    expect(preview.entries.map((entry) => entry.productId).sort()).toEqual(["product-1", "product-2"]);
    expect(preview.truncated).toBe(false);
  });

  it("resolves a PRODUCT scope to that product's fields only", async () => {
    mocks.getProductCatalogConflict.mockResolvedValue(conflict([commerceField(), translationField()]));

    const preview = await previewCatalogConflictResolution({ kind: "PRODUCT", productId: "product-1", direction: "SHOPIFY_TO_SYNARAVA" });

    expect(preview.entries).toHaveLength(2);
    expect(mocks.listConflictedProductIds).not.toHaveBeenCalled();
  });

  it("resolves a MANUAL scope to only the selected field keys, excluding one no longer conflicting", async () => {
    mocks.getProductCatalogConflict.mockResolvedValue(conflict([commerceField()]));

    const preview = await previewCatalogConflictResolution({
      kind: "MANUAL",
      selections: [
        { productId: "product-1", fieldKey: "commerce:vendor", direction: "SHOPIFY_TO_SYNARAVA" },
        { productId: "product-1", fieldKey: "commerce:status", direction: "SHOPIFY_TO_SYNARAVA" },
      ],
    });

    expect(preview.entries).toHaveLength(1);
    expect(preview.entries[0].field.fieldKey).toBe("commerce:vendor");
    expect(preview.excluded).toContainEqual(expect.objectContaining({ fieldKey: "commerce:status", reason: expect.stringContaining("no longer conflicting") }));
  });

  it("excludes a commerce field whose requested direction would mix with another commerce field already chosen for the same product", async () => {
    mocks.getProductCatalogConflict.mockResolvedValue(
      conflict([commerceField({ fieldKey: "commerce:vendor" }), commerceField({ fieldKey: "commerce:status", label: "Status" })]),
    );

    const preview = await previewCatalogConflictResolution({
      kind: "MANUAL",
      selections: [
        { productId: "product-1", fieldKey: "commerce:vendor", direction: "SHOPIFY_TO_SYNARAVA" },
        { productId: "product-1", fieldKey: "commerce:status", direction: "SYNARAVA_TO_SHOPIFY" },
      ],
    });

    expect(preview.entries).toHaveLength(1);
    expect(preview.entries[0].field.fieldKey).toBe("commerce:vendor");
    expect(preview.excluded).toContainEqual(expect.objectContaining({ fieldKey: "commerce:status", reason: expect.stringContaining("one direction per product") }));
  });

  it("flags a field that would clear a non-empty destination value", async () => {
    mocks.getProductCatalogConflict.mockResolvedValue(
      conflict([commerceField({ shopifyValue: "—", synaravaValue: "Synarava" })]),
    );

    const preview = await previewCatalogConflictResolution({ kind: "PRODUCT", productId: "product-1", direction: "SHOPIFY_TO_SYNARAVA" });

    expect(preview.entries[0].willClearNonEmptyValue).toBe(true);
  });

  it("truncates a BULK scope over the product cap", async () => {
    const manyIds = Array.from({ length: 60 }, (_, index) => `product-${index}`);
    mocks.listConflictedProductIds.mockResolvedValue(manyIds);
    mocks.getProductCatalogConflict.mockImplementation(async (productId: string) => conflict([commerceField()], productId));

    const preview = await previewCatalogConflictResolution({ kind: "BULK", direction: "SHOPIFY_TO_SYNARAVA" });

    expect(preview.entries).toHaveLength(50);
    expect(preview.truncated).toBe(true);
  });
});

describe("applyCatalogConflictResolution", () => {
  function entryFor(field: CatalogConflictField, direction: "SHOPIFY_TO_SYNARAVA" | "SYNARAVA_TO_SHOPIFY" = "SHOPIFY_TO_SYNARAVA", productId = "product-1") {
    return {
      productId,
      fieldKey: field.fieldKey,
      direction,
      expectedLocalFingerprint: field.localFingerprint,
      expectedShopifyFingerprint: field.shopifyFingerprint,
    };
  }

  it("applies a translation field through applyReconcileChoice with the matching divergenceId and choice", async () => {
    const field = translationField();
    mocks.getProductCatalogConflict.mockResolvedValue(conflict([field]));
    mocks.applyReconcileChoice.mockResolvedValue({ divergenceId: "divergence-1", ok: true, message: "Shopify was applied to Synarava." });

    const outcome = await applyCatalogConflictResolution({
      entries: [entryFor(field)],
      acknowledgeClears: false,
      actorUsername: "admin",
    });

    expect(mocks.applyReconcileChoice).toHaveBeenCalledWith({
      divergenceId: "divergence-1",
      choice: "SHOPIFY",
      expectedLocalFingerprint: field.localFingerprint,
      expectedShopifyFingerprint: field.shopifyFingerprint,
      actorUsername: "admin",
    });
    expect(outcome).toMatchObject({ appliedCount: 1, failedCount: 0 });
    expect(outcome.results[0]).toMatchObject({ ok: true });
  });

  it("groups multiple commerce fields for the same (product, direction) into a single push/pull call, applying the same result to all of them", async () => {
    const vendor = commerceField({ fieldKey: "commerce:vendor" });
    const status = commerceField({ fieldKey: "commerce:status", label: "Status" });
    mocks.getProductCatalogConflict.mockResolvedValue(conflict([vendor, status]));
    mocks.pushProductToShopify.mockResolvedValue({ ok: true, shopifyProductId: "gid://shopify/Product/1" });

    const outcome = await applyCatalogConflictResolution({
      entries: [entryFor(vendor, "SYNARAVA_TO_SHOPIFY"), entryFor(status, "SYNARAVA_TO_SHOPIFY")],
      acknowledgeClears: false,
      actorUsername: "admin",
    });

    expect(mocks.pushProductToShopify).toHaveBeenCalledTimes(1);
    expect(mocks.pushProductToShopify).toHaveBeenCalledWith("product-1", true);
    expect(outcome.appliedCount).toBe(2);
    expect(outcome.results.every((result) => result.ok)).toBe(true);
  });

  it("pulls from Shopify for a SHOPIFY_TO_SYNARAVA commerce group using the product's shopifyProductId", async () => {
    const vendor = commerceField();
    mocks.getProductCatalogConflict.mockResolvedValue(conflict([vendor]));
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/9" });
    mocks.pullShopifyProduct.mockResolvedValue({ productId: "product-1", status: "SYNCED" });

    const outcome = await applyCatalogConflictResolution({
      entries: [entryFor(vendor, "SHOPIFY_TO_SYNARAVA")],
      acknowledgeClears: false,
      actorUsername: "admin",
    });

    expect(mocks.pullShopifyProduct).toHaveBeenCalledWith("gid://shopify/Product/9", undefined, true);
    expect(outcome.appliedCount).toBe(1);
  });

  it("reports STALE and writes nothing when the current fingerprint no longer matches what preview showed", async () => {
    const field = commerceField();
    mocks.getProductCatalogConflict.mockResolvedValue(conflict([{ ...field, shopifyFingerprint: "changed-fp" }]));

    const outcome = await applyCatalogConflictResolution({
      entries: [entryFor(field)],
      acknowledgeClears: false,
      actorUsername: "admin",
    });

    expect(outcome.results[0]).toMatchObject({ ok: false, reason: "STALE" });
    expect(mocks.pushProductToShopify).not.toHaveBeenCalled();
    expect(mocks.pullShopifyProduct).not.toHaveBeenCalled();
    expect(mocks.applyReconcileChoice).not.toHaveBeenCalled();
  });

  it("reports STALE when the field is no longer present at all (already resolved elsewhere)", async () => {
    mocks.getProductCatalogConflict.mockResolvedValue(conflict([]));

    const outcome = await applyCatalogConflictResolution({
      entries: [entryFor(commerceField())],
      acknowledgeClears: false,
      actorUsername: "admin",
    });

    expect(outcome.results[0]).toMatchObject({ ok: false, reason: "STALE" });
  });

  it("blocks a clearing write without acknowledgeClears, and allows it once acknowledged", async () => {
    const field = commerceField({ shopifyValue: "—", synaravaValue: "Synarava" });
    mocks.getProductCatalogConflict.mockResolvedValue(conflict([field]));

    const blocked = await applyCatalogConflictResolution({
      entries: [entryFor(field, "SHOPIFY_TO_SYNARAVA")],
      acknowledgeClears: false,
      actorUsername: "admin",
    });
    expect(blocked.results[0]).toMatchObject({ ok: false, reason: "NEEDS_CLEAR_CONFIRMATION" });
    expect(mocks.pullShopifyProduct).not.toHaveBeenCalled();

    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/1" });
    mocks.pullShopifyProduct.mockResolvedValue({ productId: "product-1", status: "SYNCED" });
    const allowed = await applyCatalogConflictResolution({
      entries: [entryFor(field, "SHOPIFY_TO_SYNARAVA")],
      acknowledgeClears: true,
      actorUsername: "admin",
    });
    expect(allowed.results[0]).toMatchObject({ ok: true });
  });

  it("keeps partial success visible: one product's write fails, another's succeeds, independently", async () => {
    const fieldA = commerceField({ fieldKey: "commerce:vendor" });
    const fieldB = commerceField({ fieldKey: "commerce:vendor" });
    mocks.getProductCatalogConflict.mockImplementation(async (productId: string) =>
      conflict([productId === "product-a" ? fieldA : fieldB], productId),
    );
    mocks.pushProductToShopify.mockImplementation(async (productId: string) =>
      productId === "product-a" ? { ok: true, shopifyProductId: "gid://shopify/Product/1" } : { ok: false, error: "Shopify rejected the write." },
    );

    const outcome = await applyCatalogConflictResolution({
      entries: [entryFor(fieldA, "SYNARAVA_TO_SHOPIFY", "product-a"), entryFor(fieldB, "SYNARAVA_TO_SHOPIFY", "product-b")],
      acknowledgeClears: false,
      actorUsername: "admin",
    });

    expect(outcome.appliedCount).toBe(1);
    expect(outcome.failedCount).toBe(1);
    expect(outcome.results.find((result) => result.productId === "product-a")).toMatchObject({ ok: true });
    expect(outcome.results.find((result) => result.productId === "product-b")).toMatchObject({ ok: false, reason: "WRITE_FAILED" });
  });

  it("is idempotent: resubmitting the exact same request after a successful apply reports STALE instead of writing again", async () => {
    const field = translationField();
    mocks.getProductCatalogConflict.mockResolvedValueOnce(conflict([field]));
    mocks.applyReconcileChoice.mockResolvedValue({ divergenceId: "divergence-1", ok: true, message: "applied" });

    const first = await applyCatalogConflictResolution({
      entries: [entryFor(field)],
      acknowledgeClears: false,
      actorUsername: "admin",
    });
    expect(first.results[0]).toMatchObject({ ok: true });

    // After the first apply, the field's fingerprint has moved on — the second
    // call re-fetches and no longer sees the value this request still expects.
    mocks.getProductCatalogConflict.mockResolvedValueOnce(
      conflict([{ ...field, localFingerprint: "new-local-fp", shopifyFingerprint: "new-shopify-fp" }]),
    );
    const second = await applyCatalogConflictResolution({
      entries: [entryFor(field)],
      acknowledgeClears: false,
      actorUsername: "admin",
    });

    expect(second.results[0]).toMatchObject({ ok: false, reason: "STALE" });
    expect(mocks.applyReconcileChoice).toHaveBeenCalledTimes(1);
  });

  it("rejects an oversized batch outright, writing nothing", async () => {
    const entries = Array.from({ length: 201 }, (_, index) => entryFor(commerceField({ fieldKey: `commerce:field-${index}` })));

    await expect(applyCatalogConflictResolution({ entries, acknowledgeClears: false, actorUsername: "admin" }))
      .rejects.toThrow(/too many/i);
    expect(mocks.getProductCatalogConflict).not.toHaveBeenCalled();
  });
});
