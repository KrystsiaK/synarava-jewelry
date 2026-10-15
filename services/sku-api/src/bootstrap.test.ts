import { describe, expect, it } from "vitest";
import { bootstrapSynaravaShopWorkspace } from "./bootstrap.js";
import { createMemorySkuRegistryStore } from "./registry/memory-store.js";

describe("bootstrapSynaravaShopWorkspace", () => {
  it("creates workspace + published v1, then is idempotent", async () => {
    const store = createMemorySkuRegistryStore();
    const first = await bootstrapSynaravaShopWorkspace(store);
    expect(first).toMatchObject({
      workspaceKey: "synarava-shop",
      createdWorkspace: true,
      publishedProfileVersion: 1,
      action: "created",
    });

    const second = await bootstrapSynaravaShopWorkspace(store);
    expect(second.action).toBe("already-published");
    expect(second.createdWorkspace).toBe(false);

    const published = await store.getPublishedProfile("synarava-shop");
    expect(published?.version).toBe(1);
  });

  it("publishes an existing draft v1", async () => {
    const store = createMemorySkuRegistryStore();
    await store.ensureWorkspace("synarava-shop");
    await store.saveDraftProfile("synarava-shop", {
      workspace: "synarava-shop",
      version: 1,
      separator: "-",
      suffix: { width: 3, start: 1, reuse: false },
      families: { "jewelry.necklace": "JW-NECK" },
      allowedCharacters: "^[A-Z0-9]+(-[A-Z0-9.]+)*$",
    });

    const result = await bootstrapSynaravaShopWorkspace(store);
    expect(result.action).toBe("published-existing-draft");
    expect(result.publishedProfileVersion).toBe(1);
  });
});
