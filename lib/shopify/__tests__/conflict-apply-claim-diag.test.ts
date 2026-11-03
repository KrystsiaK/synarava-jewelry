/**
 * Diagnostic only — no production fix.
 *
 * Hypothesis: applyCatalogConflictResolution captures field.sourceId
 * (ShopifyFieldDivergence.id) once from the pre-loop conflict load, then
 * calls recheckEntityConflictLeaves before each translation apply. That
 * recheck runs runSyncWaterfall(skipRefresh:false) → refreshShopifyState(product)
 * → runTranslationReconciliation → persistDifferences, which retires unresolved
 * rows and inserts new randomUUID() ids. claimDifference(oldId) then returns null.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadProductConflictFromSyncResult: vi.fn(),
  listConflictedProductIds: vi.fn(),
  applyReconcileChoice: vi.fn(),
  applyCommerceField: vi.fn(),
  applyCatalogPresenceDifference: vi.fn(),
  scanAndSaveCatalogPresence: vi.fn(),
  applyShopifyProductToSynarava: vi.fn(),
  findUniqueProduct: vi.fn(),
  recheckEntityConflictLeaves: vi.fn(),
  gateWriteConvergence: vi.fn(),
}));

vi.mock("@/lib/shopify/catalog-conflict", async () => {
  const actual = await vi.importActual<typeof import("@/lib/shopify/catalog-conflict")>("@/lib/shopify/catalog-conflict");
  return {
    ...actual,
    loadProductConflictFromSyncResult: mocks.loadProductConflictFromSyncResult,
    listConflictedProductIds: mocks.listConflictedProductIds,
  };
});
vi.mock("@/lib/shopify/reconciliation-apply", () => ({
  applyReconcileChoice: mocks.applyReconcileChoice,
}));
vi.mock("@/lib/shopify/commerce-field-apply", async () => {
  const actual = await vi.importActual<typeof import("@/lib/shopify/commerce-field-apply")>("@/lib/shopify/commerce-field-apply");
  return {
    ...actual,
    applyCommerceField: mocks.applyCommerceField,
  };
});
vi.mock("@/lib/shopify/catalog-presence-server", () => ({
  applyCatalogPresenceDifference: mocks.applyCatalogPresenceDifference,
  scanAndSaveCatalogPresence: mocks.scanAndSaveCatalogPresence,
}));
vi.mock("@/lib/shopify/product-sync", async () => {
  const actual = await vi.importActual<typeof import("@/lib/shopify/product-sync")>("@/lib/shopify/product-sync");
  return {
    ...actual,
    applyShopifyProductToSynarava: mocks.applyShopifyProductToSynarava,
  };
});
vi.mock("@/lib/db", () => ({
  db: {
    product: {
      findUnique: mocks.findUniqueProduct,
    },
  },
}));
vi.mock("@/lib/sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sync")>();
  return {
    ...actual,
    recheckEntityConflictLeaves: mocks.recheckEntityConflictLeaves,
    gateWriteConvergence: mocks.gateWriteConvergence,
  };
});

import { applyCatalogConflictResolution } from "@/lib/shopify/catalog-conflict-apply";
import type { CatalogConflictField, ProductCatalogConflict } from "@/lib/shopify/catalog-conflict";

const CLAIM_NULL_MESSAGE = "This change is already being reviewed or has been resolved.";

function translationField(overrides: Partial<CatalogConflictField> = {}): CatalogConflictField {
  return {
    fieldKey: "translation:pt-PT:title",
    label: "Title",
    scope: { kind: "LOCALE", code: "pt", name: "Portuguese", nativeName: "Português" },
    origin: "TRANSLATION",
    targetKind: "NATIVE",
    synaravaValue: "Anel",
    shopifyValue: "Anel PT",
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

function entryFor(field: CatalogConflictField) {
  return {
    productId: "product-1",
    fieldKey: field.fieldKey,
    direction: "SHOPIFY_TO_SYNARAVA" as const,
    expectedLocalFingerprint: field.localFingerprint,
    expectedShopifyFingerprint: field.shopifyFingerprint,
  };
}

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.recheckEntityConflictLeaves.mockResolvedValue({ leaves: [] });
  mocks.gateWriteConvergence.mockResolvedValue({ ok: true });
});

describe("DIAG: recheck → persistDifferences call chain (source)", () => {
  it("recheckEntityConflictLeaves → runSyncWaterfall(skipRefresh: false)", () => {
    const source = read("lib/sync/recheck-entity-leaves.ts");
    expect(source).toMatch(/runSyncWaterfall\(\{[\s\S]*skipRefresh:\s*false/);
  });

  it("runSyncWaterfall refreshes via refreshShopifyState when skipRefresh is false", () => {
    const source = read("lib/sync/waterfall.ts");
    expect(source).toMatch(/if\s*\(\s*!input\.skipRefresh\s*\)/);
    expect(source).toMatch(/refreshShopifyState\(input\.scope/);
  });

  it("product-scope refreshShopifyState calls runTranslationReconciliation for that product", () => {
    const source = read("lib/sync/refresh-shopify-state.ts");
    const productBranch = source.slice(source.indexOf('if (scope.kind === "product")'));
    expect(productBranch).toMatch(/runTranslationReconciliation\(\{/);
    expect(productBranch).toMatch(/entityType:\s*"PRODUCT"/);
    expect(productBranch).toMatch(/entityId:\s*scope\.productId/);
  });

  it("runTranslationReconciliation awaits persistDifferences which retires then inserts randomUUID ids", () => {
    const source = read("lib/shopify/reconciliation-run.ts");
    expect(source).toMatch(/await persistDifferences\(\{/);
    expect(source).toMatch(/retireStaleDifferences\(bindingId,\s*locale\)/);
    expect(source).toMatch(/\$\{randomUUID\(\)\}/);
    expect(source).toMatch(/SET "resolvedAt" = CURRENT_TIMESTAMP/);
  });

  it("translation apply loop rechecks before applyReconcileChoice using field.sourceId from the pre-loop load", () => {
    const source = read("lib/shopify/catalog-conflict-apply.ts");
    const readyBlock = source.slice(source.indexOf("for (const { input, field } of readyTranslation)"));
    // Match the live call sites, not the earlier comment that names claimDifference.
    const recheckIdx = readyBlock.search(/await recheckEntityConflictLeaves\s*\(/);
    const claimIdx = readyBlock.search(/await applyReconcileChoice\s*\(/);
    const sourceIdIdx = readyBlock.search(/divergenceId:\s*field\.sourceId/);
    expect(recheckIdx).toBeGreaterThan(-1);
    expect(claimIdx).toBeGreaterThan(recheckIdx);
    expect(sourceIdIdx).toBeGreaterThan(claimIdx);
    // sourceId is taken from `field` closed over from conflictsByProduct — not re-read after recheck.
    expect(source).toMatch(/conflictsByProduct/);
  });
});


describe("DIAG: batch apply claim failure after per-field recheck recycles divergence ids", () => {
  it("applies a batch of 3+ translation fields and shows none applied when recheck extinguishes pre-loop sourceIds", async () => {
    const fields = [
      translationField({
        fieldKey: "translation:pt-PT:title",
        label: "Title",
        sourceId: "div-old-title",
        localFingerprint: "local-title",
        shopifyFingerprint: "shopify-title",
      }),
      translationField({
        fieldKey: "translation:pt-PT:description",
        label: "Description",
        sourceId: "div-old-desc",
        localFingerprint: "local-desc",
        shopifyFingerprint: "shopify-desc",
      }),
      translationField({
        fieldKey: "translation:pt-PT:seoTitle",
        label: "SEO title",
        sourceId: "div-old-seo",
        localFingerprint: "local-seo",
        shopifyFingerprint: "shopify-seo",
      }),
    ];
    mocks.loadProductConflictFromSyncResult.mockResolvedValue(conflict(fields));

    // Live unresolved ids after each simulated persistDifferences recycle.
    let liveIds = new Set(fields.map((field) => field.sourceId!));
    let recycleCount = 0;
    mocks.recheckEntityConflictLeaves.mockImplementation(async () => {
      recycleCount += 1;
      // Same contract as persistDifferences: retire all unresolved for the
      // (binding, locale) pair, then insert fresh randomUUID rows.
      liveIds = new Set([
        `div-new-title-${recycleCount}`,
        `div-new-desc-${recycleCount}`,
        `div-new-seo-${recycleCount}`,
      ]);
      return { leaves: [] };
    });

    mocks.applyReconcileChoice.mockImplementation(async ({ divergenceId }: { divergenceId: string }) => {
      if (!liveIds.has(divergenceId)) {
        return { divergenceId, ok: false, message: CLAIM_NULL_MESSAGE };
      }
      return { divergenceId, ok: true, message: "applied" };
    });

    const outcome = await applyCatalogConflictResolution({
      entries: fields.map(entryFor),
      acknowledgeClears: false,
      actorUsername: "admin",
    });

    const claimedIds = mocks.applyReconcileChoice.mock.calls.map(
      (call) => (call[0] as { divergenceId: string }).divergenceId,
    );

    // Pre-loop sourceIds are still what claim receives — never refreshed after recheck.
    expect(claimedIds).toEqual(["div-old-title", "div-old-desc", "div-old-seo"]);
    expect(mocks.recheckEntityConflictLeaves).toHaveBeenCalledTimes(3);
    // Matches admin: "None of the selected changes could be applied"
    expect(outcome.appliedCount).toBe(0);
    expect(outcome.failedCount).toBe(3);
    expect(outcome.results.map((result) => ({
      fieldKey: result.fieldKey,
      ok: result.ok,
      message: result.message,
    }))).toEqual([
      { fieldKey: "translation:pt-PT:title", ok: false, message: CLAIM_NULL_MESSAGE },
      { fieldKey: "translation:pt-PT:description", ok: false, message: CLAIM_NULL_MESSAGE },
      { fieldKey: "translation:pt-PT:seoTitle", ok: false, message: CLAIM_NULL_MESSAGE },
    ]);
    // Live ids after the last recheck are the recycled set — never claimed.
    expect([...liveIds]).toEqual(["div-new-title-3", "div-new-desc-3", "div-new-seo-3"]);
  });

  it("still calls recheck once per translation field even when the first claim already failed", async () => {
    const fields = [
      translationField({ fieldKey: "translation:pt-PT:title", sourceId: "a" }),
      translationField({ fieldKey: "translation:pt-PT:description", sourceId: "b" }),
      translationField({ fieldKey: "translation:pt-PT:seoTitle", sourceId: "c" }),
    ];
    mocks.loadProductConflictFromSyncResult.mockResolvedValue(conflict(fields));
    mocks.applyReconcileChoice.mockResolvedValue({
      divergenceId: "x",
      ok: false,
      message: CLAIM_NULL_MESSAGE,
    });

    await applyCatalogConflictResolution({
      entries: fields.map(entryFor),
      acknowledgeClears: false,
      actorUsername: "admin",
    });

    expect(mocks.recheckEntityConflictLeaves).toHaveBeenCalledTimes(3);
    expect(mocks.applyReconcileChoice).toHaveBeenCalledTimes(3);
  });
});

describe("DIAG: claimDifference returns null — SQL gates (mock applyReconcileChoice layer)", () => {
  /**
   * claimDifference UPDATE … RETURNING is empty when ANY of:
   * 1. resolvedAt IS NOT NULL (row retired by persistDifferences, or already applied)
   * 2. resolutionToken held and resolutionStartedAt within last 5 minutes
   * 3. id does not exist
   * All three surface the same applyReconcileChoice message.
   */
  it("documents that retired / held / missing ids all surface the claim-null message at the apply boundary", async () => {
    const source = read("lib/shopify/reconciliation-apply.ts");
    expect(source).toMatch(/difference\."resolvedAt" IS NULL/);
    expect(source).toMatch(/difference\."resolutionToken" IS NULL/);
    expect(source).toMatch(/INTERVAL '5 minutes'/);
    expect(source).toMatch(/This change is already being reviewed or has been resolved\./);

    const field = translationField({ sourceId: "missing-or-retired" });
    mocks.loadProductConflictFromSyncResult.mockResolvedValue(conflict([field]));
    mocks.applyReconcileChoice.mockResolvedValue({
      divergenceId: "missing-or-retired",
      ok: false,
      message: CLAIM_NULL_MESSAGE,
    });

    const outcome = await applyCatalogConflictResolution({
      entries: [entryFor(field)],
      acknowledgeClears: false,
      actorUsername: "admin",
    });

    expect(outcome.results[0]).toMatchObject({
      ok: false,
      reason: "WRITE_FAILED",
      message: CLAIM_NULL_MESSAGE,
    });
  });
});
