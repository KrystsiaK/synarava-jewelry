import { SYNARAVA_SHOP_PROFILE_V1_EXAMPLE } from "@synarava/sku-core";
import { describe, expect, it } from "vitest";
import { createAllocator } from "./allocator.js";
import {
  createMemorySkuRegistryStore,
  publishExampleProfile,
} from "./registry/memory-store.js";

describe("allocator", () => {
  it("previews without reserving", async () => {
    const store = createMemorySkuRegistryStore();
    await store.ensureWorkspace("synarava-shop");
    await publishExampleProfile(store, SYNARAVA_SHOP_PROFILE_V1_EXAMPLE);
    const allocator = createAllocator(store);

    const preview = await allocator.preview("synarava-shop", "jewelry.necklace");
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.value.sku).toBe("JW-NECK-001");
    expect(preview.value.provisional).toBe(true);

    const again = await allocator.preview("synarava-shop", "jewelry.necklace");
    expect(again.ok && again.value.sku).toBe("JW-NECK-001");
  });

  it("reserves atomically and advances sequence", async () => {
    const store = createMemorySkuRegistryStore();
    await store.ensureWorkspace("synarava-shop");
    await publishExampleProfile(store, SYNARAVA_SHOP_PROFILE_V1_EXAMPLE);
    const allocator = createAllocator(store);

    const first = await allocator.reserve({
      workspaceKey: "synarava-shop",
      familyKey: "jewelry.necklace",
      idempotencyKey: "idem-1",
      correlationId: "corr-1",
      actor: "test",
    });
    const second = await allocator.reserve({
      workspaceKey: "synarava-shop",
      familyKey: "jewelry.necklace",
      idempotencyKey: "idem-2",
      correlationId: "corr-2",
      actor: "test",
    });

    expect(first.ok && first.value.sku).toBe("JW-NECK-001");
    expect(second.ok && second.value.sku).toBe("JW-NECK-002");
  });

  it("returns the same reservation for a repeated idempotency key", async () => {
    const store = createMemorySkuRegistryStore();
    await store.ensureWorkspace("synarava-shop");
    await publishExampleProfile(store, SYNARAVA_SHOP_PROFILE_V1_EXAMPLE);
    const allocator = createAllocator(store);

    const a = await allocator.reserve({
      workspaceKey: "synarava-shop",
      familyKey: "bag.charm",
      idempotencyKey: "same-key",
      correlationId: "corr-a",
      actor: "test",
    });
    const b = await allocator.reserve({
      workspaceKey: "synarava-shop",
      familyKey: "bag.charm",
      idempotencyKey: "same-key",
      correlationId: "corr-b",
      actor: "test",
    });

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(b.value.id).toBe(a.value.id);
    expect(b.value.sku).toBe(a.value.sku);
  });

  it("keeps cancelled sequence as tombstone (no reuse)", async () => {
    const store = createMemorySkuRegistryStore();
    await store.ensureWorkspace("synarava-shop");
    await publishExampleProfile(store, SYNARAVA_SHOP_PROFILE_V1_EXAMPLE);
    const allocator = createAllocator(store);

    const reserved = await allocator.reserve({
      workspaceKey: "synarava-shop",
      familyKey: "craft.thread",
      idempotencyKey: "tomb-1",
      correlationId: "corr-t",
      actor: "test",
    });
    expect(reserved.ok).toBe(true);
    if (!reserved.ok) return;

    await store.cancelReservationAsTombstone(
      "synarava-shop",
      reserved.value.id,
      "corr-cancel",
      "test",
    );

    const next = await allocator.reserve({
      workspaceKey: "synarava-shop",
      familyKey: "craft.thread",
      idempotencyKey: "tomb-2",
      correlationId: "corr-next",
      actor: "test",
    });
    expect(next.ok && next.value.sku).toBe("DIY-THREAD-002");
    expect(next.ok && next.value.sku).not.toBe(reserved.value.sku);
  });

  it("concurrency: parallel reserves never collide", async () => {
    const store = createMemorySkuRegistryStore();
    await store.ensureWorkspace("synarava-shop");
    await publishExampleProfile(store, SYNARAVA_SHOP_PROFILE_V1_EXAMPLE);
    const allocator = createAllocator(store);

    const results = await Promise.all(
      Array.from({ length: 40 }, (_, index) =>
        allocator.reserve({
          workspaceKey: "synarava-shop",
          familyKey: "jewelry.bracelet",
          idempotencyKey: `parallel-${index}`,
          correlationId: `corr-p-${index}`,
          actor: "test",
        }),
      ),
    );

    const skus = results.map((r) => {
      expect(r.ok).toBe(true);
      return r.ok ? r.value.sku : "";
    });

    expect(new Set(skus).size).toBe(40);
    expect(skus).toContain("JW-BRACELET-001");
    expect(skus).toContain("JW-BRACELET-040");
  });
});
