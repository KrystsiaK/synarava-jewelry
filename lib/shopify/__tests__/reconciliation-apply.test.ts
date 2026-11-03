import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EntityFieldRegistry } from "@/lib/i18n/admin-field-registry";
import { fingerprintSyncValue } from "@/lib/i18n/sync-comparison";

const REGISTRY: EntityFieldRegistry = {
  entity: "product",
  fields: [
    { key: "title", label: "Title", mode: "localized", required: "always", kind: "short-text", shopifyTarget: { kind: "native", resource: "PRODUCT", key: "title" } },
    { key: "description", label: "Description", mode: "localized", required: "optional", kind: "rich-text", shopifyTarget: { kind: "native", resource: "PRODUCT", key: "body_html" } },
    { key: "seoTitle", label: "SEO title", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: { kind: "native", resource: "PRODUCT", key: "meta_title" } },
    { key: "meta:custom:key", label: "Custom", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: { kind: "native", resource: "PRODUCT", key: "meta:custom:key" } },
  ],
};

const mocks = vi.hoisted(() => ({
  adoptProjection: vi.fn(),
  queryRaw: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  loadSubject: vi.fn(),
  writeLocal: vi.fn(),
  fetchTranslation: vi.fn(),
  fetchState: vi.fn(),
  registerTranslations: vi.fn(),
  updateSource: vi.fn(),
  recordSyncEvent: vi.fn(),
  recordAuditDetails: vi.fn(),
}));

vi.mock("@/lib/shopify/product-sync", () => ({ adoptShopifyProjectionField: mocks.adoptProjection }));
vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: mocks.queryRaw,
    shopifyFieldDivergence: {
      findFirst: mocks.findFirst,
      updateMany: mocks.updateMany,
    },
  },
}));
vi.mock("@/lib/shopify/reconciliation-source", () => ({
  contentLocaleForShopify: (locale: string) => locale.toLowerCase().startsWith("en") ? "en" : "pt",
  loadReconcileSubject: mocks.loadSubject,
  writeLocalReconcileField: mocks.writeLocal,
}));
vi.mock("@/lib/i18n/storefront-locale-cache", () => ({
  getPublishedStorefrontLocales: vi.fn().mockResolvedValue([
    { code: "en", isDefault: true, shopifyLocale: "en" },
    { code: "pt", isDefault: false, shopifyLocale: "pt-PT" },
  ]),
}));
vi.mock("@/lib/shopify/translations", () => ({
  fetchResourceTranslation: mocks.fetchTranslation,
  fetchResourceTranslationState: mocks.fetchState,
  registerTranslations: mocks.registerTranslations,
}));
vi.mock("@/lib/shopify/source-content", () => ({
  sourceContentAsRemoteValues: (content: Array<{ key: string; value: string }>) => content,
  updateShopifySourceField: mocks.updateSource,
}));
vi.mock("@/lib/shopify/translation-sync", () => ({
  recordReconcileAuditDetails: mocks.recordAuditDetails,
  recordSyncEvent: mocks.recordSyncEvent,
}));

import {
  applyReconcileChoice,
  applyTranslationConflictChoice,
  parseTranslationConflictFieldKey,
} from "@/lib/shopify/reconciliation-apply";

function fp(key: string, value: string) {
  return fingerprintSyncValue(REGISTRY.fields.find((field) => field.key === key)!, value);
}

function claimRow(
  fieldKey = "title",
  id = "difference-1",
  local = "Local title",
  shopify = "Remote title",
  locale = "pt-PT",
  bindingId = "binding-1",
) {
  return {
    id,
    bindingId,
    locale,
    fieldKey,
    localFingerprint: fp(fieldKey === "meta:custom:key" ? "meta:custom:key" : fieldKey, local),
    shopifyFingerprint: fp(fieldKey === "meta:custom:key" ? "meta:custom:key" : fieldKey, shopify),
    bindingResourceType: "PRODUCT" as const,
    bindingEntityId: "product-1",
    shopifyResourceId: "gid://shopify/Product/1",
  };
}

function subject(local: Record<string, string>) {
  return { rootEntityType: "PRODUCT" as const, rootEntityId: "product-1", label: "Ring", registry: REGISTRY, local };
}

function sqlOf(call: unknown): string {
  const value = call as { strings?: TemplateStringsArray } | string;
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "strings" in value && value.strings) return value.strings.join("?");
  return String(value);
}

const PRODUCT = { rootEntityType: "PRODUCT" as const, rootEntityId: "product-1" };
const COLLECTION = { rootEntityType: "COLLECTION" as const, rootEntityId: "collection-1" };

function localFor(key: string) {
  return key === "title" ? "Local title" : key === "description" ? "L-desc" : "L-seo";
}
function shopifyFor(key: string) {
  return key === "title" ? "Remote title" : key === "description" ? "R-desc" : "R-seo";
}

async function pushOk(row: ReturnType<typeof claimRow>) {
  const registryKey = row.fieldKey;
  const shopifyKey = REGISTRY.fields.find((field) => field.key === registryKey)!.shopifyTarget!.key;
  const localValue = localFor(registryKey);
  const shopifyValue = shopifyFor(registryKey);
  mocks.loadSubject.mockResolvedValue(subject({ [registryKey]: localValue }));
  mocks.fetchTranslation
    .mockResolvedValueOnce([{ key: shopifyKey, value: shopifyValue, updatedAt: "2026-09-20T10:00:00Z", outdated: false }])
    .mockResolvedValueOnce([{ key: shopifyKey, value: localValue, updatedAt: "2026-09-20T10:00:01Z", outdated: false }]);
  mocks.registerTranslations.mockResolvedValue({ registeredKeys: [shopifyKey] });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.recordSyncEvent.mockResolvedValue({ id: "event-1" });
  mocks.recordAuditDetails.mockResolvedValue(undefined);
  mocks.registerTranslations.mockResolvedValue({ registeredKeys: ["title"] });
  mocks.updateSource.mockResolvedValue({ mutation: "productUpdate", key: "title" });
});

describe("natural-key reconcile apply", () => {
  it("parses translation keys; fieldKey may contain colons", () => {
    expect(parseTranslationConflictFieldKey("translation:pt-PT:title")).toEqual({
      locale: "pt-PT", fieldKey: "title",
    });
    expect(parseTranslationConflictFieldKey("translation:pt-PT:meta:custom:key")).toEqual({
      locale: "pt-PT", fieldKey: "meta:custom:key",
    });
  });

  it("claims newest open row by natural key (LIMIT 1), not random id", async () => {
    const row = claimRow("title", "fresh-after-recheck");
    mocks.queryRaw.mockResolvedValueOnce([row]);
    await pushOk(row);
    const result = await applyReconcileChoice({
      ...PRODUCT, locale: row.locale, fieldKey: row.fieldKey,
      choice: "SYNARAVA",
      expectedLocalFingerprint: row.localFingerprint,
      expectedShopifyFingerprint: row.shopifyFingerprint,
      actorUsername: "admin",
    });
    expect(result.ok).toBe(true);
    const claimSql = sqlOf(mocks.queryRaw.mock.calls[0][0]);
    expect(claimSql).toMatch(/ORDER BY candidate\."createdAt" DESC/);
    expect(claimSql).toMatch(/LIMIT 1/);
    expect(claimSql).not.toMatch(/difference\."id" = \$\{/);
    expect(claimSql).not.toMatch(/difference\."id" = \?/);
  });

  it("regression: batch of 3 fields applies after DB-layer row retire+recreate between fields", async () => {
    // Mirrors persistDifferences: after each successful claim the open row for
    // remaining fields is retired and a new id is inserted. Natural-key claim
    // must find the live id — frozen preview ids would fail fields 2+.
    const specs = [
      { key: "title", local: "Local title", shopify: "Remote title" },
      { key: "description", local: "L-desc", shopify: "R-desc" },
      { key: "seoTitle", local: "L-seo", shopify: "R-seo" },
    ] as const;
    const openByField = new Map<string, ReturnType<typeof claimRow>>();
    for (const [index, spec] of specs.entries()) {
      openByField.set(spec.key, claimRow(spec.key, `gen0-${spec.key}-${index}`, spec.local, spec.shopify));
    }

    mocks.queryRaw.mockImplementation(async (query: unknown) => {
      const sql = sqlOf(query);
      if (!(sql.includes("UPDATE") && sql.includes('"resolutionToken"'))) return [];
      // Claim returns current open row for the addressed field (by presence in map).
      for (const [key, row] of openByField) {
        openByField.delete(key);
        // Recreate remaining fields with new ids (persistDifferences recycle).
        for (const [otherKey, other] of [...openByField.entries()]) {
          openByField.set(otherKey, { ...other, id: `recycled-${otherKey}-${other.id}` });
        }
        return [{ ...row }];
      }
      return [];
    });

    const results = [];
    for (const spec of specs) {
      // Preview still holds gen0 ids; apply must not use them.
      const previewId = `gen0-${spec.key}-stale`;
      void previewId;
      const live = claimRow(spec.key, `ignored-preview`, spec.local, spec.shopify);
      // Fingerprints from the field values (stable); row id is whatever DB returns.
      await pushOk(live);
      results.push(await applyTranslationConflictChoice({
        ...PRODUCT,
        conflictFieldKey: `translation:pt-PT:${spec.key}`,
        choice: "SYNARAVA",
        expectedLocalFingerprint: live.localFingerprint,
        expectedShopifyFingerprint: live.shopifyFingerprint,
        actorUsername: "admin",
      }));
    }
    expect(results.map((item) => item.ok)).toEqual([true, true, true]);
    // title claimed at gen0; description/seoTitle ids change each prior claim's recycle.
    expect(results[0]?.divergenceId).toBe("gen0-title-0");
    expect(results[1]?.divergenceId).toMatch(/^recycled-description-/);
    expect(results[2]?.divergenceId).toMatch(/^recycled-seoTitle-/);
    expect(new Set(results.map((item) => item.divergenceId)).size).toBe(3);
    expect(mocks.registerTranslations).toHaveBeenCalledTimes(3);
  });

  it("collection root: same natural-key batch after row recycle", async () => {
    const specs = ["title", "description", "seoTitle"] as const;
    const live = new Map<string, ReturnType<typeof claimRow>>();
    mocks.queryRaw.mockImplementation(async (query: unknown) => {
      const sql = sqlOf(query);
      if (sql.includes("UPDATE") && sql.includes('"resolutionToken"')) {
        for (const [key, row] of live) {
          live.delete(key);
          return [{ ...row, bindingResourceType: "COLLECTION", bindingEntityId: "collection-1" }];
        }
        return [];
      }
      return [];
    });
    const results = [];
    for (const [index, key] of specs.entries()) {
      const row = claimRow(key, `col-recycled-${key}-${index}`, localFor(key), shopifyFor(key));
      live.set(key, row);
      await pushOk(row);
      results.push(await applyTranslationConflictChoice({
        ...COLLECTION,
        conflictFieldKey: `translation:pt-PT:${key}`,
        choice: "SYNARAVA",
        expectedLocalFingerprint: row.localFingerprint,
        expectedShopifyFingerprint: row.shopifyFingerprint,
        actorUsername: "admin",
      }));
    }
    expect(results.every((item) => item.ok)).toBe(true);
  });

  it("two open bindings same locale+fieldKey: claim LIMIT 1 leaves the other unblocked", async () => {
    const newer = claimRow("title", "newer-row", "Local title", "Remote title", "pt-PT", "binding-new");
    const older = claimRow("title", "older-row", "Local title", "Remote title", "pt-PT", "binding-old");
    let claimCount = 0;
    mocks.queryRaw.mockImplementation(async (query: unknown) => {
      const sql = sqlOf(query);
      expect(sql).toMatch(/ORDER BY candidate\."createdAt" DESC/);
      expect(sql).toMatch(/LIMIT 1/);
      if (!(sql.includes("UPDATE") && sql.includes('"resolutionToken"'))) return [];
      claimCount += 1;
      // Newest first, then the remaining open row — never both at once.
      return claimCount === 1 ? [{ ...newer }] : [{ ...older }];
    });
    await pushOk(newer);
    const first = await applyReconcileChoice({
      ...PRODUCT, locale: "pt-PT", fieldKey: "title",
      choice: "SYNARAVA",
      expectedLocalFingerprint: newer.localFingerprint,
      expectedShopifyFingerprint: newer.shopifyFingerprint,
      actorUsername: "admin",
    });
    await pushOk(older);
    const second = await applyReconcileChoice({
      ...PRODUCT, locale: "pt-PT", fieldKey: "title",
      choice: "SYNARAVA",
      expectedLocalFingerprint: older.localFingerprint,
      expectedShopifyFingerprint: older.shopifyFingerprint,
      actorUsername: "admin",
    });
    expect(first).toMatchObject({ ok: true, divergenceId: "newer-row" });
    expect(second).toMatchObject({ ok: true, divergenceId: "older-row" });
    expect(mocks.registerTranslations).toHaveBeenCalledTimes(2);
  });

  it("second apply returns already applied only when closed fingerprints match", async () => {
    const row = claimRow();
    mocks.queryRaw.mockResolvedValueOnce([row]);
    await pushOk(row);
    const first = await applyReconcileChoice({
      ...PRODUCT, locale: row.locale, fieldKey: row.fieldKey,
      choice: "SYNARAVA",
      expectedLocalFingerprint: row.localFingerprint,
      expectedShopifyFingerprint: row.shopifyFingerprint,
      actorUsername: "admin",
    });
    expect(first.ok).toBe(true);

    mocks.queryRaw.mockResolvedValueOnce([]);
    mocks.findFirst.mockResolvedValueOnce({
      id: row.id,
      localFingerprint: row.localFingerprint,
      shopifyFingerprint: row.shopifyFingerprint,
      resolvedAt: new Date(),
      resolutionToken: null,
      resolutionStartedAt: null,
    });
    const second = await applyReconcileChoice({
      ...PRODUCT, locale: row.locale, fieldKey: row.fieldKey,
      choice: "SYNARAVA",
      expectedLocalFingerprint: row.localFingerprint,
      expectedShopifyFingerprint: row.shopifyFingerprint,
      actorUsername: "admin",
    });
    expect(second).toEqual({ divergenceId: row.id, ok: true, message: "Already applied." });
    expect(mocks.registerTranslations).toHaveBeenCalledTimes(1);

    // Closed with different fingerprints → closed error, not already-applied.
    mocks.queryRaw.mockResolvedValueOnce([]);
    mocks.findFirst.mockResolvedValueOnce({
      id: row.id,
      localFingerprint: "other-local",
      shopifyFingerprint: "other-shopify",
      resolvedAt: new Date(),
      resolutionToken: null,
      resolutionStartedAt: null,
    });
    await expect(applyReconcileChoice({
      ...PRODUCT, locale: row.locale, fieldKey: row.fieldKey,
      choice: "SYNARAVA",
      expectedLocalFingerprint: row.localFingerprint,
      expectedShopifyFingerprint: row.shopifyFingerprint,
      actorUsername: "admin",
    })).resolves.toMatchObject({ ok: false, message: /already been resolved/ });
  });

  it("stale fingerprints refuse the write and release the lock", async () => {
    const row = claimRow();
    mocks.queryRaw.mockResolvedValueOnce([row]);
    const result = await applyReconcileChoice({
      ...PRODUCT, locale: row.locale, fieldKey: row.fieldKey,
      choice: "SYNARAVA",
      expectedLocalFingerprint: "0".repeat(64),
      expectedShopifyFingerprint: row.shopifyFingerprint,
      actorUsername: "admin",
    });
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("stale") });
    expect(mocks.registerTranslations).not.toHaveBeenCalled();
    expect(mocks.updateMany).toHaveBeenCalled();
  });

  it("distinguishes held, closed, and missing claim failures", async () => {
    const address = { ...PRODUCT, locale: "pt-PT", fieldKey: "title" };
    const fps = { expectedLocalFingerprint: "a".repeat(64), expectedShopifyFingerprint: "b".repeat(64) };

    mocks.queryRaw.mockResolvedValueOnce([]);
    mocks.findFirst.mockResolvedValueOnce({
      id: "held", localFingerprint: fps.expectedLocalFingerprint, shopifyFingerprint: fps.expectedShopifyFingerprint,
      resolvedAt: null, resolutionToken: "tok", resolutionStartedAt: new Date(),
    });
    await expect(applyReconcileChoice({
      ...address, choice: "SHOPIFY", ...fps, actorUsername: "admin",
    })).resolves.toMatchObject({ ok: false, message: /currently being applied/ });

    mocks.queryRaw.mockResolvedValueOnce([]);
    mocks.findFirst.mockResolvedValueOnce({
      id: "closed", localFingerprint: "x", shopifyFingerprint: "y",
      resolvedAt: new Date(), resolutionToken: null, resolutionStartedAt: null,
    });
    await expect(applyReconcileChoice({
      ...address, choice: "SYNARAVA", ...fps, actorUsername: "admin",
    })).resolves.toMatchObject({ ok: false, message: /already been resolved/ });

    mocks.queryRaw.mockResolvedValueOnce([]);
    mocks.findFirst.mockResolvedValueOnce(null);
    await expect(applyReconcileChoice({
      ...address, choice: "SHOPIFY", ...fps, actorUsername: "admin",
    })).resolves.toMatchObject({ ok: false, message: /no longer present/ });
  });

  it("pushes one selected field and reads it back", async () => {
    const row = claimRow();
    mocks.queryRaw.mockResolvedValueOnce([row]);
    await pushOk(row);
    const result = await applyReconcileChoice({
      ...PRODUCT, locale: row.locale, fieldKey: row.fieldKey,
      choice: "SYNARAVA",
      expectedLocalFingerprint: row.localFingerprint,
      expectedShopifyFingerprint: row.shopifyFingerprint,
      actorUsername: "admin",
    });
    expect(result.ok).toBe(true);
    expect(mocks.registerTranslations).toHaveBeenCalledWith({
      resourceId: row.shopifyResourceId,
      locale: "pt-PT",
      values: { title: "Local title" },
    });
  });

  it("pulls Shopify → Synarava for one field", async () => {
    const row = claimRow();
    mocks.queryRaw.mockResolvedValueOnce([row]);
    mocks.loadSubject
      .mockResolvedValueOnce(subject({ title: "Local title" }))
      .mockResolvedValueOnce(subject({ title: "Remote title" }));
    mocks.fetchTranslation.mockResolvedValueOnce([
      { key: "title", value: "Remote title", updatedAt: "2026-09-20T10:00:00Z", outdated: false },
    ]);
    mocks.writeLocal.mockResolvedValue("Remote title");
    await expect(applyReconcileChoice({
      ...PRODUCT, locale: row.locale, fieldKey: row.fieldKey,
      choice: "SHOPIFY",
      expectedLocalFingerprint: row.localFingerprint,
      expectedShopifyFingerprint: row.shopifyFingerprint,
      actorUsername: "admin",
    })).resolves.toMatchObject({ ok: true });
    expect(mocks.writeLocal).toHaveBeenCalled();
  });

  it("updates English as Shopify source content", async () => {
    const row = claimRow("title", "difference-1", "Local title", "Remote title", "en");
    mocks.queryRaw.mockResolvedValueOnce([row]);
    mocks.loadSubject.mockResolvedValue(subject({ title: "Local title" }));
    mocks.fetchState
      .mockResolvedValueOnce({ translatableContent: [{ key: "title", value: "Remote title", locale: "en" }], translations: [] })
      .mockResolvedValueOnce({ translatableContent: [{ key: "title", value: "Local title", locale: "en" }], translations: [] });
    await expect(applyReconcileChoice({
      ...PRODUCT, locale: row.locale, fieldKey: row.fieldKey,
      choice: "SYNARAVA",
      expectedLocalFingerprint: row.localFingerprint,
      expectedShopifyFingerprint: row.shopifyFingerprint,
      actorUsername: "admin",
    })).resolves.toMatchObject({ ok: true });
    expect(mocks.updateSource).toHaveBeenCalled();
    expect(mocks.adoptProjection).toHaveBeenCalledWith("product-1", "title");
  });
});
