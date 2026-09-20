import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EntityFieldRegistry } from "@/lib/i18n/admin-field-registry";
import { fingerprintSyncValue } from "@/lib/i18n/sync-comparison";

const REGISTRY: EntityFieldRegistry = {
  entity: "product",
  fields: [
    { key: "title", label: "Title", mode: "localized", required: "always", kind: "short-text", shopifyTarget: { kind: "native", resource: "PRODUCT", key: "title" } },
  ],
};
const field = REGISTRY.fields[0];

const mocks = vi.hoisted(() => ({
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
  saveSnapshot: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: mocks.queryRaw,
    $executeRaw: mocks.executeRaw,
  },
}));
vi.mock("@/lib/shopify/reconciliation-source", () => ({
  contentLocaleForShopify: (locale: string) => locale.toLowerCase().startsWith("en") ? "EN" : "PT",
  loadReconcileSubject: mocks.loadSubject,
  writeLocalReconcileField: mocks.writeLocal,
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
  saveTranslationSnapshot: mocks.saveSnapshot,
}));

import { applyReconcileChoice } from "@/lib/shopify/reconciliation-apply";

function claimRow(local: string, shopify: string, locale = "pt-PT") {
  return {
    id: "difference-1",
    bindingId: "binding-1",
    locale,
    fieldKey: "title",
    localFingerprint: fingerprintSyncValue(field, local),
    shopifyFingerprint: fingerprintSyncValue(field, shopify),
    bindingResourceType: "PRODUCT",
    bindingEntityId: "product-1",
    shopifyResourceId: "gid://shopify/Product/1",
    lastSyncedSnapshot: { title: "Old title" },
  };
}

function subject(title: string) {
  return {
    rootEntityType: "PRODUCT",
    rootEntityId: "product-1",
    label: "Ring",
    registry: REGISTRY,
    local: { title },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.executeRaw.mockResolvedValue(1);
  mocks.recordSyncEvent.mockResolvedValue({ id: "event-1" });
  mocks.recordAuditDetails.mockResolvedValue(undefined);
  mocks.saveSnapshot.mockResolvedValue(undefined);
  mocks.registerTranslations.mockResolvedValue({ registeredKeys: ["title"] });
  mocks.updateSource.mockResolvedValue({ mutation: "productUpdate", key: "title" });
});

describe("applyReconcileChoice", () => {
  it("rejects a stale review before reading or writing Shopify", async () => {
    const row = claimRow("Local", "Remote");
    mocks.queryRaw.mockResolvedValueOnce([row]);

    const result = await applyReconcileChoice({
      divergenceId: row.id,
      choice: "SYNARAVA",
      expectedLocalFingerprint: "0".repeat(64),
      expectedShopifyFingerprint: row.shopifyFingerprint,
      actorUsername: "admin",
    });

    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("stale") });
    expect(mocks.fetchTranslation).not.toHaveBeenCalled();
    expect(mocks.registerTranslations).not.toHaveBeenCalled();
  });

  it("pushes one selected field, reads it back, and only then records the new base", async () => {
    const row = claimRow("Local title", "Remote title");
    mocks.queryRaw.mockResolvedValueOnce([row]).mockResolvedValueOnce([{ values: { title: "Old title" } }]);
    mocks.loadSubject.mockResolvedValue(subject("Local title"));
    mocks.fetchTranslation
      .mockResolvedValueOnce([{ key: "title", value: "Remote title", updatedAt: "2026-09-20T10:00:00Z", outdated: false }])
      .mockResolvedValueOnce([{ key: "title", value: "Local title", updatedAt: "2026-09-20T10:00:01Z", outdated: false }]);

    const result = await applyReconcileChoice({
      divergenceId: row.id,
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
    expect(mocks.saveSnapshot).toHaveBeenCalledWith({
      bindingId: row.bindingId,
      locale: "pt-PT",
      values: { title: "Local title" },
    });
    expect(mocks.recordSyncEvent).toHaveBeenCalledWith(expect.objectContaining({ direction: "PUSH", status: "SUCCEEDED" }));
    expect(mocks.recordAuditDetails).toHaveBeenCalledWith(expect.objectContaining({
      eventId: "event-1",
      selectedSide: "SYNARAVA",
      localFingerprint: row.localFingerprint,
      shopifyFingerprint: row.shopifyFingerprint,
      resultFingerprint: row.localFingerprint,
    }));
  });

  it("pulls one selected field and verifies the local reload", async () => {
    const row = claimRow("Local title", "Remote title");
    mocks.queryRaw.mockResolvedValueOnce([row]).mockResolvedValueOnce([{ values: { title: "Old title" } }]);
    mocks.loadSubject
      .mockResolvedValueOnce(subject("Local title"))
      .mockResolvedValueOnce(subject("Remote title"));
    mocks.fetchTranslation.mockResolvedValueOnce([
      { key: "title", value: "Remote title", updatedAt: "2026-09-20T10:00:00Z", outdated: false },
    ]);
    mocks.writeLocal.mockResolvedValue("Remote title");

    const result = await applyReconcileChoice({
      divergenceId: row.id,
      choice: "SHOPIFY",
      expectedLocalFingerprint: row.localFingerprint,
      expectedShopifyFingerprint: row.shopifyFingerprint,
      actorUsername: "admin",
    });

    expect(result.ok).toBe(true);
    expect(mocks.writeLocal).toHaveBeenCalledWith(expect.objectContaining({
      fieldKey: "title",
      shopifyValue: "Remote title",
    }));
    expect(mocks.registerTranslations).not.toHaveBeenCalled();
    expect(mocks.recordSyncEvent).toHaveBeenCalledWith(expect.objectContaining({ direction: "PULL", status: "SUCCEEDED" }));
  });

  it("updates English as Shopify source content instead of registering a translation", async () => {
    const row = claimRow("Local title", "Remote title", "en");
    mocks.queryRaw.mockResolvedValueOnce([row]).mockResolvedValueOnce([{ values: { title: "Old title" } }]);
    mocks.loadSubject.mockResolvedValue(subject("Local title"));
    mocks.fetchState
      .mockResolvedValueOnce({ translatableContent: [{ key: "title", value: "Remote title", locale: "en" }], translations: [] })
      .mockResolvedValueOnce({ translatableContent: [{ key: "title", value: "Local title", locale: "en" }], translations: [] });

    const result = await applyReconcileChoice({
      divergenceId: row.id,
      choice: "SYNARAVA",
      expectedLocalFingerprint: row.localFingerprint,
      expectedShopifyFingerprint: row.shopifyFingerprint,
      actorUsername: "admin",
    });

    expect(result.ok).toBe(true);
    expect(mocks.updateSource).toHaveBeenCalledWith(expect.objectContaining({
      resourceType: "PRODUCT",
      resourceId: row.shopifyResourceId,
      value: "Local title",
    }));
    expect(mocks.registerTranslations).not.toHaveBeenCalled();
    expect(mocks.recordSyncEvent).toHaveBeenCalledWith(expect.objectContaining({ locale: "EN" }));
  });

  it("refuses a second concurrent resolver that cannot claim the field", async () => {
    mocks.queryRaw.mockResolvedValueOnce([]);

    const result = await applyReconcileChoice({
      divergenceId: "difference-1",
      choice: "SHOPIFY",
      expectedLocalFingerprint: "a".repeat(64),
      expectedShopifyFingerprint: "b".repeat(64),
      actorUsername: "admin",
    });

    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("already") });
    expect(mocks.loadSubject).not.toHaveBeenCalled();
  });
});
