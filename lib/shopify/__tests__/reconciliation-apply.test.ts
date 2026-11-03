import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EntityFieldRegistry } from "@/lib/i18n/admin-field-registry";
import { fingerprintSyncValue } from "@/lib/i18n/sync-comparison";

const REGISTRY: EntityFieldRegistry = {
  entity: "product",
  fields: [
    { key: "title", label: "Title", mode: "localized", required: "always", kind: "short-text", shopifyTarget: { kind: "native", resource: "PRODUCT", key: "title" } },
    { key: "description", label: "Description", mode: "localized", required: "optional", kind: "rich-text", shopifyTarget: { kind: "native", resource: "PRODUCT", key: "body_html" } },
    { key: "seoTitle", label: "SEO title", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: { kind: "native", resource: "PRODUCT", key: "meta_title" } },
  ],
};

const mocks = vi.hoisted(() => ({
  adoptProjection: vi.fn(),
  queryRaw: vi.fn(),
  executeRaw: vi.fn(),
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
vi.mock("@/lib/db", () => ({ db: { $queryRaw: mocks.queryRaw, $executeRaw: mocks.executeRaw } }));
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
) {
  return {
    id,
    bindingId: "binding-1",
    locale,
    fieldKey,
    localFingerprint: fp(fieldKey, local),
    shopifyFingerprint: fp(fieldKey, shopify),
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
  const shopifyKey = REGISTRY.fields.find((field) => field.key === row.fieldKey)!.shopifyTarget!.key;
  const localValue = localFor(row.fieldKey);
  const shopifyValue = shopifyFor(row.fieldKey);
  mocks.loadSubject.mockResolvedValue(subject({ [row.fieldKey]: localValue }));
  mocks.fetchTranslation
    .mockResolvedValueOnce([{ key: shopifyKey, value: shopifyValue, updatedAt: "2026-09-20T10:00:00Z", outdated: false }])
    .mockResolvedValueOnce([{ key: shopifyKey, value: localValue, updatedAt: "2026-09-20T10:00:01Z", outdated: false }]);
  mocks.registerTranslations.mockResolvedValue({ registeredKeys: [shopifyKey] });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.executeRaw.mockResolvedValue(1);
  mocks.recordSyncEvent.mockResolvedValue({ id: "event-1" });
  mocks.recordAuditDetails.mockResolvedValue(undefined);
  mocks.registerTranslations.mockResolvedValue({ registeredKeys: ["title"] });
  mocks.updateSource.mockResolvedValue({ mutation: "productUpdate", key: "title" });
});

describe("natural-key reconcile apply", () => {
  it("parses translation conflict field keys", () => {
    expect(parseTranslationConflictFieldKey("translation:pt-PT:title")).toEqual({
      locale: "pt-PT", fieldKey: "title",
    });
  });

  it("claims by root entity + locale + fieldKey, not random id", async () => {
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
    expect(claimSql).toMatch(/difference\."rootEntityType"/);
    expect(claimSql).toMatch(/difference\."fieldKey"/);
    expect(claimSql).not.toMatch(/difference\."id" =/);
  });

  it("batch of 3+ fields still applies after persistDifferences recycles row ids", async () => {
    const specs = [
      { key: "title", local: "Local title", shopify: "Remote title" },
      { key: "description", local: "L-desc", shopify: "R-desc" },
      { key: "seoTitle", local: "L-seo", shopify: "R-seo" },
    ] as const;
    const live = new Map<string, ReturnType<typeof claimRow>>();
    mocks.queryRaw.mockImplementation(async (query: unknown) => {
      const sql = sqlOf(query);
      if (sql.includes("UPDATE") && sql.includes('"resolutionToken"')) {
        for (const [key, row] of live) {
          live.delete(key);
          return [{ ...row }];
        }
        return [];
      }
      return [];
    });

    const results = [];
    for (const [index, spec] of specs.entries()) {
      const row = claimRow(spec.key, `recycled-${spec.key}-${index}`, spec.local, spec.shopify);
      live.set(spec.key, row);
      await pushOk(row);
      results.push(await applyTranslationConflictChoice({
        ...PRODUCT,
        conflictFieldKey: `translation:pt-PT:${spec.key}`,
        choice: "SYNARAVA",
        expectedLocalFingerprint: row.localFingerprint,
        expectedShopifyFingerprint: row.shopifyFingerprint,
        actorUsername: "admin",
      }));
    }
    expect(results.every((item) => item.ok)).toBe(true);
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
    expect(sqlOf(mocks.queryRaw.mock.calls[0][0])).toMatch(/difference\."rootEntityType"/);
  });

  it("second apply returns already applied (ok), without rewriting", async () => {
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

    mocks.queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{
      id: row.id,
      localFingerprint: row.localFingerprint,
      shopifyFingerprint: row.shopifyFingerprint,
      resolvedAt: new Date(),
      resolutionToken: null,
      resolutionStartedAt: null,
      selectedSide: "SYNARAVA",
    }]);
    const second = await applyReconcileChoice({
      ...PRODUCT, locale: row.locale, fieldKey: row.fieldKey,
      choice: "SYNARAVA",
      expectedLocalFingerprint: row.localFingerprint,
      expectedShopifyFingerprint: row.shopifyFingerprint,
      actorUsername: "admin",
    });
    expect(second).toEqual({ divergenceId: row.id, ok: true, message: "Already applied." });
    expect(mocks.registerTranslations).toHaveBeenCalledTimes(1);
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
    expect(mocks.executeRaw).toHaveBeenCalled();
  });

  it("distinguishes held, closed, and missing claim failures", async () => {
    const address = { ...PRODUCT, locale: "pt-PT", fieldKey: "title" };
    const fps = { expectedLocalFingerprint: "a".repeat(64), expectedShopifyFingerprint: "b".repeat(64) };

    mocks.queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{
      id: "held", localFingerprint: fps.expectedLocalFingerprint, shopifyFingerprint: fps.expectedShopifyFingerprint,
      resolvedAt: null, resolutionToken: "tok", resolutionStartedAt: new Date(), selectedSide: null,
    }]);
    await expect(applyReconcileChoice({
      ...address, choice: "SHOPIFY", ...fps, actorUsername: "admin",
    })).resolves.toMatchObject({ ok: false, message: /currently being applied/ });

    mocks.queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{
      id: "closed", localFingerprint: "x", shopifyFingerprint: "y",
      resolvedAt: new Date(), resolutionToken: null, resolutionStartedAt: null, selectedSide: "SHOPIFY",
    }]);
    await expect(applyReconcileChoice({
      ...address, choice: "SYNARAVA", ...fps, actorUsername: "admin",
    })).resolves.toMatchObject({ ok: false, message: /already been resolved/ });

    mocks.queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
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
