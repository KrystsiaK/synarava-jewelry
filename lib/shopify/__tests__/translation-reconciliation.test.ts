import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EntityFieldRegistry } from "@/lib/i18n/admin-field-registry";

const REGISTRY: EntityFieldRegistry = {
  entity: "widget",
  fields: [
    { key: "title", label: "Title", mode: "localized", required: "always", kind: "short-text", shopifyTarget: { kind: "native", resource: "WIDGET", key: "title" } },
    { key: "body", label: "Body", mode: "localized", required: "optional", kind: "long-text", shopifyTarget: { kind: "native", resource: "WIDGET", key: "body_html" } },
    { key: "structured", label: "Structured copy", mode: "localized", required: "optional", kind: "rich-text", shopifyTarget: { kind: "metaobject", definition: "widget_copy", key: "structured" } },
    { key: "sku", label: "SKU", mode: "shared", required: "always", kind: "short-text", shopifyTarget: null },
  ],
};

const mocks = vi.hoisted(() => ({
  shopifyAdminRequest: vi.fn(),
  bindingFindMany: vi.fn(),
}));

vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {},
}));

vi.mock("@/lib/db", () => ({
  db: { shopifyTranslationBinding: { findMany: mocks.bindingFindMany } },
}));

import { planReconcile, projectRemoteTranslation, reconcileResourceType } from "@/lib/shopify/translation-reconciliation";

beforeEach(() => vi.clearAllMocks());

describe("planReconcile", () => {
  const base = { title: "Ring", body: "Handmade" };

  it.each([
    ["noop", base, base, base, "noop", []],
    ["push", base, { ...base, title: "New Ring" }, base, "push", []],
    ["pull", base, base, { ...base, title: "Remote Ring" }, "pull", []],
    [
      "conflict on one field, unaffected field ignored",
      base,
      { ...base, title: "Local Ring" },
      { ...base, title: "Remote Ring" },
      "conflict",
      [{ field: "title", local: "Local Ring", remote: "Remote Ring" }],
    ],
    [
      "no base (first sync) still conflicts when local and remote disagree",
      null,
      { ...base, title: "Local Ring" },
      { ...base, title: "Remote Ring" },
      "conflict",
      [{ field: "title", local: "Local Ring", remote: "Remote Ring" }],
    ],
  ] as const)("%s", (_name, baseValue, local, remote, direction, conflicts) => {
    const plan = planReconcile(REGISTRY, baseValue, local, remote);
    expect(plan.direction).toBe(direction);
    expect(plan.conflicts).toEqual(conflicts);
  });

  it("reports a conflict per differing field when multiple fields diverge", () => {
    const plan = planReconcile(
      REGISTRY,
      base,
      { title: "Local Ring", body: "Local body" },
      { title: "Remote Ring", body: "Remote body" },
    );
    expect(plan.direction).toBe("conflict");
    expect(plan.conflicts).toEqual([
      { field: "title", local: "Local Ring", remote: "Remote Ring" },
      { field: "body", local: "Local body", remote: "Remote body" },
    ]);
    expect(plan.differences).toHaveLength(2);
  });

  it("never reports noop when different fields changed on opposite sides", () => {
    const plan = planReconcile(
      REGISTRY,
      base,
      { ...base, title: "Local Ring" },
      { ...base, body: "Remote body" },
    );

    expect(plan.direction).toBe("conflict");
    expect(plan.differences.map(({ fieldKey, kind }) => ({ fieldKey, kind }))).toEqual([
      { fieldKey: "title", kind: "local-only" },
      { fieldKey: "body", kind: "shopify-only" },
    ]);
  });
});

describe("projectRemoteTranslation", () => {
  it("maps native and metaobject Shopify keys onto registry field keys", () => {
    const projected = projectRemoteTranslation(REGISTRY, [
      { key: "title", value: "Anel", updatedAt: "2026-09-10T10:00:00Z", outdated: false },
      { key: "body_html", value: "<p>Feito</p>", updatedAt: "2026-09-10T10:00:00Z", outdated: false },
      { key: "structured", value: "{\"material\":\"silver\"}", updatedAt: "2026-09-10T10:00:00Z", outdated: false },
    ]);
    expect(projected).toEqual({ title: "Anel", body: "<p>Feito</p>", structured: "{\"material\":\"silver\"}" });
  });
});

describe("reconcileResourceType", () => {
  it("pages Shopify, matches known bindings, and plans each without writing", async () => {
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({ translatableResources: {
        pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
        nodes: [{ resourceId: "gid://shopify/Widget/1", translations: [
          { key: "title", value: "Remote title", updatedAt: "2026-09-10T10:00:00Z", outdated: false },
        ] }],
      } })
      .mockResolvedValueOnce({ translatableResources: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [{ resourceId: "gid://shopify/Widget/2", translations: [] }],
      } });

    mocks.bindingFindMany.mockResolvedValue([
      { id: "bind-1", entityId: "widget-1", shopifyResourceId: "gid://shopify/Widget/1", lastSyncedSnapshot: { title: "Old title" } },
      { id: "bind-2", entityId: "widget-2", shopifyResourceId: "gid://shopify/Widget/2", lastSyncedSnapshot: null },
    ]);

    const loadLocal = vi.fn(async (entityId: string) =>
      entityId === "widget-1" ? { title: "Old title" } : { title: "Local only title" });

    const results = await reconcileResourceType({
      registry: REGISTRY,
      resourceType: "WIDGET",
      locale: "pt-PT",
      loadLocal,
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ bindingId: "bind-1", plan: { direction: "pull", conflicts: [] } });
    expect(results[1]).toMatchObject({ bindingId: "bind-2", plan: { direction: "push", conflicts: [] } });
    expect(mocks.bindingFindMany).toHaveBeenCalledWith({
      where: { resourceType: "WIDGET", shopifyResourceId: { in: ["gid://shopify/Widget/1", "gid://shopify/Widget/2"] } },
    });
  });

  it("skips a binding whose local entity is missing (e.g. deleted) instead of throwing", async () => {
    mocks.shopifyAdminRequest.mockResolvedValueOnce({ translatableResources: {
      pageInfo: { hasNextPage: false, endCursor: null },
      nodes: [{ resourceId: "gid://shopify/Widget/1", translations: [] }],
    } });
    mocks.bindingFindMany.mockResolvedValue([
      { id: "bind-1", entityId: "widget-1", shopifyResourceId: "gid://shopify/Widget/1", lastSyncedSnapshot: null },
    ]);

    const results = await reconcileResourceType({
      registry: REGISTRY,
      resourceType: "WIDGET",
      locale: "pt-PT",
      loadLocal: async () => null,
    });

    expect(results).toEqual([]);
  });
});
