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
  // createOrReuseRun's advisory lock uses the interactive-transaction form
  // (a callback); persistDifferences' retire+insert uses the
  // array-of-promises form. Both go through this one $transaction mock.
  mocks.transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: unknown) => unknown)({ $queryRaw: mocks.queryRaw, $executeRaw: mocks.executeRaw })
      : Promise.all(arg as Promise<unknown>[]),
  );
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

  function setUpSingleBindingSingleLocaleCheck(differences: Array<Record<string, unknown>>) {
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
    mocks.planReconcile.mockReturnValue({ differences });
    mocks.queryRaw.mockResolvedValueOnce([]); // lastSnapshot(en)
  }

  it("retires every unresolved row for the (binding, locale) and inserts the fresh ones in the same transaction — including a field still found different, so resolving the new row can never uncover a stale duplicate", async () => {
    setUpSingleBindingSingleLocaleCheck([{
      fieldKey: "title", fieldLabel: "Title", targetKind: "native", kind: "conflict",
      baseValue: null, localValue: "A", shopifyValue: "B",
      localFingerprint: "fp-a", shopifyFingerprint: "fp-b", shopifyUpdatedAt: null, shopifyOutdated: false,
    }]);
    mocks.queryRaw.mockResolvedValueOnce([runRow({ status: "SUCCEEDED", checkedCount: 1, differenceCount: 1 })]); // runById after finishRun

    await runTranslationReconciliation({ trigger: "MANUAL", scope: { locale: "en" } });

    // persistDifferences' one $transaction call is the 2nd (the 1st is
    // createOrReuseRun's advisory lock) and must carry both the retire and
    // the insert together — that's what makes them atomic.
    const [operations] = mocks.transaction.mock.calls[1] as [unknown[]];
    expect(operations).toHaveLength(2);

    const retireCall = mocks.executeRaw.mock.calls.find(
      ([query]) => (query as { sql: string }).sql.includes('UPDATE "ShopifyFieldDivergence"'),
    );
    expect(retireCall).toBeTruthy();
    const [query] = retireCall!;
    // No field-key exclusion: every previously unresolved row for this
    // (binding, locale) is retired, even the field the fresh check still
    // reports as different — a new row for it is inserted right after.
    expect((query as { sql: string }).sql).not.toContain("NOT IN");
    expect((query as { sql: string }).sql).toContain('"bindingId" = ?');
    expect((query as { sql: string }).sql).toContain('"resolvedAt" IS NULL');
    expect((query as { values: unknown[] }).values).toEqual(["binding-1", "en"]);

    const insertCall = mocks.executeRaw.mock.calls.find(
      ([query]) => (query as { sql: string }).sql.includes("INSERT INTO \"ShopifyFieldDivergence\""),
    );
    expect(insertCall).toBeTruthy();

    // Retire must be built (and therefore ordered) before the insert within
    // the transaction's operation list, or the fresh row could be resolved
    // by the same sweep.
    const retireIndex = mocks.executeRaw.mock.calls.indexOf(retireCall!);
    const insertIndex = mocks.executeRaw.mock.calls.indexOf(insertCall!);
    expect(retireIndex).toBeLessThan(insertIndex);
  });

  it("does not lose existing conflicts when the insert half of persistDifferences fails — retire and insert roll back together", async () => {
    setUpSingleBindingSingleLocaleCheck([{
      fieldKey: "title", fieldLabel: "Title", targetKind: "native", kind: "conflict",
      baseValue: null, localValue: "A", shopifyValue: "B",
      localFingerprint: "fp-a", shopifyFingerprint: "fp-b", shopifyUpdatedAt: null, shopifyOutdated: false,
    }]);
    mocks.queryRaw.mockResolvedValueOnce([runRow({
      status: "FAILED", checkedCount: 0, differenceCount: 0,
      error: "1 check could not be completed. product-1 (en): insert failed.",
    })]); // runById after finishRun
    // 1st $transaction call: createOrReuseRun's advisory lock (still the
    // function form). 2nd: persistDifferences' retire+insert batch — reject
    // it exactly like a real Postgres transaction that fails and rolls back
    // every statement in it, including the retire.
    mocks.transaction
      .mockImplementationOnce(async (fn: (tx: unknown) => unknown) => fn({ $queryRaw: mocks.queryRaw, $executeRaw: mocks.executeRaw }))
      .mockImplementationOnce(async () => {
        throw new Error("insert failed.");
      });

    const result = await runTranslationReconciliation({ trigger: "MANUAL", scope: { locale: "en" } });

    // The failure must be visible on the run, not swallowed as a quiet
    // success with the old conflict simply gone.
    expect(result.run).toMatchObject({ status: "FAILED", checkedCount: 0 });
    expect(result.run?.error).toMatch(/insert failed/);
    // Nothing beyond the failed transaction's own retire attempt should
    // have run — in particular, no separate/earlier retire outside of it
    // (which would mean the retire could commit independently of the insert).
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
  });
});
