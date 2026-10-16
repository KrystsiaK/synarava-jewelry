import { SYNARAVA_SHOP_PROFILE_V1_EXAMPLE } from "@synarava/sku-core";
import { describe, expect, it } from "vitest";
import { applyLegacyBackfill, planLegacyBackfill } from "./legacy-backfill.js";
import {
  createMemorySkuRegistryStore,
  publishExampleProfile,
} from "./registry/memory-store.js";

async function setup() {
  const store = createMemorySkuRegistryStore();
  await store.ensureWorkspace("synarava-shop");
  await publishExampleProfile(store, SYNARAVA_SHOP_PROFILE_V1_EXAMPLE);
  return store;
}

describe("legacy Shopify SKU backfill", () => {
  it("plans only non-empty, not-yet-recorded Shopify SKU exceptions", async () => {
    const store = await setup();
    await store.importLegacyAssignments(
      "synarava-shop",
      [
        {
          sku: "EY-ACC-001",
          externalSystem: "shopify",
          externalVariantId: "gid://shopify/ProductVariant/pilot",
        },
      ],
      "existing-pilot",
      "test",
    );

    const plan = await planLegacyBackfill({
      store,
      workspaceKey: "synarava-shop",
      items: [
        {
          externalVariantId: "gid://shopify/ProductVariant/pilot",
          sku: "EY-ACC-001",
        },
        {
          externalVariantId: "gid://shopify/ProductVariant/legacy",
          sku: "Legacy SKU / Keep Verbatim",
        },
        {
          externalVariantId: "gid://shopify/ProductVariant/empty",
          sku: "",
        },
      ],
    });

    expect(plan).toMatchObject({
      itemCount: 3,
      nonEmptyItemCount: 2,
      createCount: 1,
      existingCount: 1,
      conflictCount: 0,
    });
    expect(plan.rows).toEqual([
      {
        sku: "Legacy SKU / Keep Verbatim",
        externalSystem: "shopify",
        externalVariantId: "gid://shopify/ProductVariant/legacy",
      },
    ]);
    expect(plan.digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("requires the reviewed digest, applies idempotently, and never rewrites Shopify SKU", async () => {
    const store = await setup();
    const input = {
      store,
      workspaceKey: "synarava-shop",
      items: [
        {
          externalVariantId: "gid://shopify/ProductVariant/legacy",
          sku: "Legacy SKU / Keep Verbatim",
        },
      ],
    } as const;
    const plan = await planLegacyBackfill(input);

    await expect(
      applyLegacyBackfill({
        ...input,
        expectedDigest: "0".repeat(64),
        correlationId: "legacy-backfill-wrong-digest",
        actor: "test",
      }),
    ).rejects.toThrow("digest");

    const first = await applyLegacyBackfill({
      ...input,
      expectedDigest: plan.digest,
      correlationId: "legacy-backfill-apply",
      actor: "test",
    });
    expect(first).toMatchObject({ created: 1, skipped: 0 });
    expect(first.assignments[0]?.sku).toBe("Legacy SKU / Keep Verbatim");

    const repeatedPlan = await planLegacyBackfill(input);
    const repeated = await applyLegacyBackfill({
      ...input,
      expectedDigest: repeatedPlan.digest,
      correlationId: "legacy-backfill-repeat",
      actor: "test",
    });
    expect(repeated).toMatchObject({ created: 0, skipped: 1 });
  });
});
