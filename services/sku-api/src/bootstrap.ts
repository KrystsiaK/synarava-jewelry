import { SYNARAVA_SHOP_PROFILE_V1_EXAMPLE } from "@synarava/sku-core";
import { isDomainError } from "./registry/errors.js";
import type { SkuRegistryStore } from "./registry/types.js";

export type BootstrapResult = {
  readonly workspaceKey: string;
  readonly createdWorkspace: boolean;
  readonly publishedProfileVersion: number;
  readonly action: "created" | "already-published" | "published-existing-draft";
};

async function workspaceExists(
  store: SkuRegistryStore,
  workspaceKey: string,
): Promise<boolean> {
  if ((await store.getPublishedProfile(workspaceKey)) !== null) {
    return true;
  }
  try {
    await store.listProfiles(workspaceKey);
    return true;
  } catch (error) {
    if (isDomainError(error) && error.code === "WORKSPACE_NOT_FOUND") {
      return false;
    }
    throw error;
  }
}

/**
 * Idempotent staging bootstrap: ensure workspace + published profile v1.
 * Safe to re-run. Does not use SKU_SEED_EXAMPLE (removed from staging/prod paths).
 */
export async function bootstrapSynaravaShopWorkspace(
  store: SkuRegistryStore,
  options?: { readonly workspaceKey?: string },
): Promise<BootstrapResult> {
  const workspaceKey = options?.workspaceKey ?? "synarava-shop";
  const existed = await workspaceExists(store, workspaceKey);

  await store.ensureWorkspace(workspaceKey);

  const published = await store.getPublishedProfile(workspaceKey);
  if (published) {
    return {
      workspaceKey,
      createdWorkspace: !existed,
      publishedProfileVersion: published.version,
      action: "already-published",
    };
  }

  const profiles = await store.listProfiles(workspaceKey);
  const draftV1 = profiles.find((p) => p.version === 1 && p.status === "DRAFT");
  if (draftV1) {
    const result = await store.publishProfileVersion(workspaceKey, 1);
    return {
      workspaceKey,
      createdWorkspace: !existed,
      publishedProfileVersion: result.version,
      action: "published-existing-draft",
    };
  }

  const config = {
    ...SYNARAVA_SHOP_PROFILE_V1_EXAMPLE,
    workspace: workspaceKey,
  };
  await store.saveDraftProfile(workspaceKey, config);
  const result = await store.publishProfileVersion(workspaceKey, config.version);
  return {
    workspaceKey,
    createdWorkspace: !existed,
    publishedProfileVersion: result.version,
    action: "created",
  };
}
