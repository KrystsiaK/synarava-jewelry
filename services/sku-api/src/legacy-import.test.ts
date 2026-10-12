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
