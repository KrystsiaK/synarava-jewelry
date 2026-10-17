import { SYNARAVA_SHOP_PROFILE_V1_EXAMPLE } from "@synarava/sku-core";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { importLegacyFixture, loadLegacyFixture } from "./legacy-import.js";
import {
  createMemorySkuRegistryStore,
  publishExampleProfile,
} from "./registry/memory-store.js";
import { createAllocator } from "./allocator.js";

const FIXTURE = join(import.meta.dirname, "../fixtures/legacy-v0-sample.json");

describe("legacy importer", () => {
  it("preserves pre-cutover Shopify SKUs verbatim even when policy v1 cannot parse them", async () => {
    const store = createMemorySkuRegistryStore();
    await store.ensureWorkspace("synarava-shop");
    await publishExampleProfile(store, SYNARAVA_SHOP_PROFILE_V1_EXAMPLE);

    const imported = await importLegacyFixture(
      store,
      {
        workspaceKey: "synarava-shop",
        rows: [
          {
            sku: "Legacy SKU / Do Not Rewrite",
            externalSystem: "shopify",
            externalVariantId: "gid://shopify/ProductVariant/legacy-exception",
          },
        ],
      },
      {
        correlationId: "legacy-exception-import",
        actor: "importer",
      },
    );

    expect(imported.created).toBe(1);
    expect(imported.assignments[0]).toMatchObject({
      sku: "Legacy SKU / Do Not Rewrite",
      source: "LEGACY_V0",
      externalVariantId: "gid://shopify/ProductVariant/legacy-exception",
    });

    const repeated = await importLegacyFixture(
      store,
      {
        workspaceKey: "synarava-shop",
        rows: [
          {
            sku: "Legacy SKU / Do Not Rewrite",
            externalSystem: "shopify",
            externalVariantId: "gid://shopify/ProductVariant/legacy-exception",
          },
        ],
      },
      {
        correlationId: "legacy-exception-import-repeat",
        actor: "importer",
      },
    );

    expect(repeated.created).toBe(0);
    expect(repeated.skipped).toBe(1);
  });

  it("imports fixtures idempotently without Shopify writes", async () => {
    const store = createMemorySkuRegistryStore();
    const file = await loadLegacyFixture(FIXTURE);
    await store.ensureWorkspace(file.workspaceKey);
    await publishExampleProfile(store, SYNARAVA_SHOP_PROFILE_V1_EXAMPLE);

    const first = await importLegacyFixture(store, file, {
      correlationId: "import-1",
      actor: "importer",
    });
    expect(first.created).toBe(3);
    expect(first.skipped).toBe(0);

    const second = await importLegacyFixture(store, file, {
      correlationId: "import-2",
      actor: "importer",
    });
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(3);

    const assignments = await store.listAssignments(file.workspaceKey);
    expect(assignments).toHaveLength(3);
    expect(assignments.every((a) => a.source === "LEGACY_V0")).toBe(true);

    // Next reserve for same stem continues after imported max sequence.
    const allocator = createAllocator(store);
    const next = await allocator.reserve({
      workspaceKey: file.workspaceKey,
      familyKey: "jewelry.necklace",
      idempotencyKey: "after-legacy",
      correlationId: "corr-after",
      actor: "test",
    });
    expect(next.ok && next.value.sku).toBe("JW-NECK-002");
  });
});
