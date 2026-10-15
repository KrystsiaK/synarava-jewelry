import { SYNARAVA_SHOP_PROFILE_V1_EXAMPLE } from "@synarava/sku-core";
import { describe, expect, it } from "vitest";
import {
  createMemorySkuRegistryStore,
  publishExampleProfile,
} from "../registry/memory-store.js";
import {
  CATALOG_AUDIT_MAX_BATCH,
  classifyCatalogItem,
  computeCatalogAuditDigest,
  runCatalogAudit,
} from "./catalog-audit.js";

describe("catalog audit (Этап 5 Slice A)", () => {
  it("classifies missing assignment, mismatch, empty external, invalid format", () => {
    const allowed = SYNARAVA_SHOP_PROFILE_V1_EXAMPLE.allowedCharacters;
    expect(
      classifyCatalogItem({
        item: { externalVariantId: "v-missing", sku: "JW-NECK-001" },
        assignment: undefined,
        allowedCharacters: allowed,
      }),
    ).toMatchObject({
      codes: ["MISSING_ASSIGNMENT"],
      observedSku: "JW-NECK-001",
    });

    expect(
      classifyCatalogItem({
        item: { externalVariantId: "v1", sku: "JW-NECK-002" },
        assignment: {
          id: "a1",
          workspaceId: "w",
          sku: "JW-NECK-001",
          policyVersion: 1,
          source: "RESERVED",
          status: "ACTIVE",
          lockState: "NONE",
          externalSystem: "shopify",
          externalShop: "s",
          externalProductId: "p",
          externalVariantId: "v1",
          reservationId: null,
          correlationId: "c",
          createdAt: new Date(),
        },
        allowedCharacters: allowed,
      }),
    ).toMatchObject({ codes: ["SKU_MISMATCH"], ledgerSku: "JW-NECK-001" });

    expect(
      classifyCatalogItem({
        item: { externalVariantId: "v1", sku: "" },
        assignment: {
          id: "a1",
          workspaceId: "w",
          sku: "JW-NECK-001",
          policyVersion: 1,
          source: "RESERVED",
          status: "ACTIVE",
          lockState: "NONE",
          externalSystem: "shopify",
          externalShop: "s",
          externalProductId: "p",
          externalVariantId: "v1",
          reservationId: null,
          correlationId: "c",
          createdAt: new Date(),
        },
        allowedCharacters: allowed,
      }),
    ).toMatchObject({ codes: ["EXTERNAL_EMPTY"] });

    expect(
      classifyCatalogItem({
        item: { externalVariantId: "v-bad", sku: "bad sku!!" },
        assignment: undefined,
        allowedCharacters: allowed,
      }),
    ).toMatchObject({
      codes: expect.arrayContaining(["INVALID_FORMAT", "MISSING_ASSIGNMENT"]),
    });

    expect(
      classifyCatalogItem({
        item: { externalVariantId: "v1", sku: "JW-NECK-001" },
        assignment: {
          id: "a1",
          workspaceId: "w",
          sku: "JW-NECK-001",
          policyVersion: 1,
          source: "RESERVED",
          status: "ACTIVE",
          lockState: "NONE",
          externalSystem: "shopify",
          externalShop: "s",
          externalProductId: "p",
          externalVariantId: "v1",
          reservationId: null,
          correlationId: "c",
          createdAt: new Date(),
        },
        allowedCharacters: allowed,
      }),
    ).toBeNull();
  });

  it("digest is stable; identical re-run does not notify again", async () => {
    const store = createMemorySkuRegistryStore();
    await store.ensureWorkspace("synarava-shop");
    await publishExampleProfile(store, SYNARAVA_SHOP_PROFILE_V1_EXAMPLE);

    const reserved = await store.reserve({
      workspaceKey: "synarava-shop",
      familyKey: "jewelry.necklace",
      idempotencyKey: "audit-idem-1",
      correlationId: "corr-audit-reserve",
      actor: "test",
    });
    await store.confirmAssignment({
      workspaceKey: "synarava-shop",
      reservationId: reserved.id,
      sku: reserved.sku,
      externalSystem: "shopify",
      externalShop: "staging.myshopify.com",
      externalProductId: "gid://shopify/Product/1",
      externalVariantId: "gid://shopify/ProductVariant/1",
      shopifyReadBackSku: reserved.sku,
      correlationId: "corr-audit-confirm",
      actor: "test",
    });

    const items = [
      {
        externalVariantId: "gid://shopify/ProductVariant/1",
        sku: "JW-NECK-999",
      },
      {
        externalVariantId: "gid://shopify/ProductVariant/99",
        sku: "JW-RING-001",
      },
    ];

    const first = await runCatalogAudit({
      store,
      workspaceKey: "synarava-shop",
      items,
      previousDigest: null,
      correlationId: "corr-audit-1",
    });
    expect(first.deviationCount).toBe(2);
    expect(first.shouldNotify).toBe(true);
    expect(first.llmEnabled).toBe(false);
    expect(first.digest).toBe(computeCatalogAuditDigest(first.deviations));

    const second = await runCatalogAudit({
      store,
      workspaceKey: "synarava-shop",
      items,
      previousDigest: first.digest,
      correlationId: "corr-audit-2",
    });
    expect(second.digest).toBe(first.digest);
    expect(second.shouldNotify).toBe(false);
    expect(second.deviationCount).toBe(2);
  });

  it("rejects batches over the max", async () => {
    const store = createMemorySkuRegistryStore();
    await store.ensureWorkspace("synarava-shop");
    await publishExampleProfile(store, SYNARAVA_SHOP_PROFILE_V1_EXAMPLE);
    const items = Array.from({ length: CATALOG_AUDIT_MAX_BATCH + 1 }, (_, i) => ({
      externalVariantId: `v-${i}`,
      sku: "JW-NECK-001",
    }));
    await expect(
      runCatalogAudit({
        store,
        workspaceKey: "synarava-shop",
        items,
        previousDigest: null,
        correlationId: "corr-audit-oversize",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("matching catalog rows produce empty digest and no notify", async () => {
    const store = createMemorySkuRegistryStore();
    await store.ensureWorkspace("synarava-shop");
    await publishExampleProfile(store, SYNARAVA_SHOP_PROFILE_V1_EXAMPLE);
    const reserved = await store.reserve({
      workspaceKey: "synarava-shop",
      familyKey: "jewelry.necklace",
      idempotencyKey: "audit-idem-ok",
      correlationId: "corr-audit-ok-r",
      actor: "test",
    });
    await store.confirmAssignment({
      workspaceKey: "synarava-shop",
      reservationId: reserved.id,
      sku: reserved.sku,
      externalSystem: "shopify",
      externalShop: "staging.myshopify.com",
      externalProductId: "gid://shopify/Product/2",
      externalVariantId: "gid://shopify/ProductVariant/2",
      shopifyReadBackSku: reserved.sku,
      correlationId: "corr-audit-ok-c",
      actor: "test",
    });
    const result = await runCatalogAudit({
      store,
      workspaceKey: "synarava-shop",
      items: [
        {
          externalVariantId: "gid://shopify/ProductVariant/2",
          sku: reserved.sku,
        },
      ],
      previousDigest: null,
      correlationId: "corr-audit-ok",
    });
    expect(result.deviationCount).toBe(0);
    expect(result.shouldNotify).toBe(false);
    expect(result.digest).toBe(computeCatalogAuditDigest([]));
  });
});
