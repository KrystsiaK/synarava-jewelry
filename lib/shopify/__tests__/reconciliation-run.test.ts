import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  executeRaw: vi.fn(),
  transaction: vi.fn(),
  findMany: vi.fn(),
  loadReconcileSubject: vi.fn(),
  fetchResourceTranslationState: vi.fn(),
  planReconcile: vi.fn(),
  projectRemoteTranslationWithMetadata: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: mocks.queryRaw,
    $executeRaw: mocks.executeRaw,
    $transaction: mocks.transaction,
    shopifyTranslationBinding: { findMany: mocks.findMany },
  },
}));
vi.mock("@/lib/shopify/admin", () => ({ hasShopifyAdminConfig: () => true }));
vi.mock("@/lib/shopify/reconciliation-source", () => ({
  loadReconcileSubject: mocks.loadReconcileSubject,
}));
vi.mock("@/lib/shopify/translations", () => ({
  fetchResourceTranslationState: mocks.fetchResourceTranslationState,
}));
vi.mock("@/lib/shopify/translation-reconciliation", () => ({
  planReconcile: mocks.planReconcile,
  projectRemoteTranslationWithMetadata: mocks.projectRemoteTranslationWithMetadata,
}));
// Two published, non-default locales — proves the reconcile sweep loops
// over every registered target locale, not a hardcoded Portuguese pair.
vi.mock("@/lib/i18n/storefront-locale-cache", () => ({
  getPublishedStorefrontLocales: vi.fn().mockResolvedValue([
    { code: "en", isDefault: true, shopifyLocale: "en" },
    { code: "pt", isDefault: false, shopifyLocale: "pt-PT" },
    { code: "ru", isDefault: false, shopifyLocale: "ru" },
  ]),
}));

import { runTranslationReconciliation } from "@/lib/shopify/reconciliation-run";

function runRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "run-1",
    trigger: "MANUAL",
    status: "RUNNING",
    checkedCount: 0,
    differenceCount: 0,
    error: null,
    startedAt: new Date(),
    completedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // createOrReuseRun: no active run, no recent run, then insert + read back the new row.
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
    $queryRaw: mocks.queryRaw,
    $executeRaw: mocks.executeRaw,
  }));
  mocks.executeRaw.mockResolvedValueOnce(undefined); // advisory lock (void-returning, must use $executeRaw)
  mocks.queryRaw
    .mockResolvedValueOnce([]) // no active QUEUED/RUNNING run
    .mockResolvedValueOnce([runRow()]); // runById after insert
});

describe("runTranslationReconciliation", () => {
  it("closes the run as FAILED instead of throwing when a step outside the per-binding loop breaks", async () => {
    mocks.findMany.mockRejectedValue(new Error("connection to database lost"));
    mocks.queryRaw.mockResolvedValueOnce([runRow({ status: "FAILED", error: "connection to database lost" })]); // runById after finishRun

    await expect(runTranslationReconciliation({ trigger: "MANUAL" })).resolves.toMatchObject({
      run: { status: "FAILED", error: "connection to database lost" },
      reused: false,
    });

    // advisory lock + insert (createOrReuseRun) + update (finishRun) — the run must be closed out, not left RUNNING.
    expect(mocks.executeRaw).toHaveBeenCalledTimes(3);
  });

  it("checks one binding independently against every published locale — English plus two non-default ones", async () => {
    mocks.findMany.mockResolvedValue([{
      id: "binding-1",
      shopifyResourceId: "gid://shopify/Product/1",
      entityId: "product-1",
      lastSyncedSnapshot: null,
      createdAt: new Date(),
    }]);
    mocks.loadReconcileSubject.mockResolvedValue({
      rootEntityType: "PRODUCT",
      rootEntityId: "product-1",
      label: "Ring",
      registry: { entity: "product", fields: [] },
      local: {},
    });
    mocks.fetchResourceTranslationState.mockResolvedValue({ translatableContent: [], translations: [] });
    mocks.projectRemoteTranslationWithMetadata.mockReturnValue({ values: {}, metadata: {} });
    mocks.planReconcile.mockReturnValue({ differences: [] });
    // lastSnapshot: one $queryRaw per locale, none found.
    mocks.queryRaw
      .mockResolvedValueOnce([]) // lastSnapshot(en)
      .mockResolvedValueOnce([]) // lastSnapshot(pt-PT)
      .mockResolvedValueOnce([]) // lastSnapshot(ru)
      .mockResolvedValueOnce([runRow({ status: "SUCCEEDED", checkedCount: 3, differenceCount: 0 })]); // runById after finishRun

    const result = await runTranslationReconciliation({ trigger: "MANUAL" });

    expect(result).toMatchObject({
      run: { status: "SUCCEEDED", checkedCount: 3, differenceCount: 0 },
      reused: false,
    });
    expect(mocks.loadReconcileSubject).toHaveBeenCalledTimes(3);
    const checkedLocales = mocks.loadReconcileSubject.mock.calls.map((call) => call[1]);
    expect(checkedLocales).toEqual(["en", "pt-PT", "ru"]);
  });

  it("retires stale unresolved rows for the exact (binding, locale) it just rechecked, keeping only the field still found different", async () => {
    // Both the interactive-transaction form (createOrReuseRun's advisory lock)
    // and the array-of-promises form (persistDifferences' inserts) go through
    // the same $transaction mock here.
    mocks.transaction.mockImplementation(async (arg: unknown) =>
      typeof arg === "function"
        ? (arg as (tx: unknown) => unknown)({ $queryRaw: mocks.queryRaw, $executeRaw: mocks.executeRaw })
        : Promise.all(arg as Promise<unknown>[]),
    );
    mocks.findMany.mockResolvedValue([{
      id: "binding-1",
      shopifyResourceId: "gid://shopify/Product/1",
      entityId: "product-1",
      lastSyncedSnapshot: null,
      createdAt: new Date(),
    }]);
    mocks.loadReconcileSubject.mockResolvedValue({
      rootEntityType: "PRODUCT",
      rootEntityId: "product-1",
      label: "Ring",
      registry: { entity: "product", fields: [] },
      local: {},
    });
    mocks.fetchResourceTranslationState.mockResolvedValue({ translatableContent: [], translations: [] });
    mocks.projectRemoteTranslationWithMetadata.mockReturnValue({ values: {}, metadata: {} });
    mocks.planReconcile.mockReturnValue({
      differences: [{
        fieldKey: "title", fieldLabel: "Title", targetKind: "native", kind: "conflict",
        baseValue: null, localValue: "A", shopifyValue: "B",
        localFingerprint: "fp-a", shopifyFingerprint: "fp-b", shopifyUpdatedAt: null, shopifyOutdated: false,
      }],
    });
    mocks.queryRaw
      .mockResolvedValueOnce([]) // lastSnapshot(en)
      .mockResolvedValueOnce([runRow({ status: "SUCCEEDED", checkedCount: 1, differenceCount: 1 })]); // runById after finishRun

    await runTranslationReconciliation({ trigger: "MANUAL", scope: { locale: "en" } });

    const retireCall = mocks.executeRaw.mock.calls.find(
      ([query]) => (query as { sql: string }).sql.includes("NOT IN"),
    );
    expect(retireCall).toBeTruthy();
    const [query] = retireCall!;
    expect((query as { sql: string }).sql).toContain('"bindingId" = ?');
    expect((query as { sql: string }).sql).toContain('"resolvedAt" IS NULL');
    expect((query as { values: unknown[] }).values).toEqual(["binding-1", "en", "title"]);

    const insertCall = mocks.executeRaw.mock.calls.find(
      ([query]) => (query as { sql: string }).sql.includes("INSERT INTO \"ShopifyFieldDivergence\""),
    );
    expect(insertCall).toBeTruthy();
  });
});
