import {
  normalizeFamilyKey,
  previewSku,
  resolveStem,
  type PolicyProfileConfig,
  type SkuErrorCode,
  type SkuResult,
} from "@synarava/sku-core";
import { isDomainError } from "./registry/memory-store.js";
import type {
  ReservationRecord,
  SkuRegistryStore,
} from "./registry/types.js";

export type Allocator = {
  preview(
    workspaceKey: string,
    familyKey: string,
  ): Promise<
    SkuResult<{
      sku: string;
      stem: string;
      sequence: number;
      policyVersion: number;
      familyKey: string;
      provisional: true;
    }>
  >;
  reserve(input: {
    workspaceKey: string;
    familyKey: string;
    idempotencyKey: string;
    correlationId: string;
    actor: string;
  }): Promise<SkuResult<ReservationRecord>>;
};

export function createAllocator(store: SkuRegistryStore): Allocator {
  return {
    async preview(workspaceKey, familyKey) {
      const profile = await store.getPublishedProfile(workspaceKey);
      if (!profile) {
        return {
          ok: false,
          code: "PROFILE_NOT_PUBLISHED",
          message: `no published profile for ${workspaceKey}`,
        };
      }

      const family = normalizeFamilyKey(familyKey);
      if (!family.ok) return family;

      const stemResult = await resolveLastAllocated(store, profile, family.value);
      if (!stemResult.ok) return stemResult;

      return previewSku(profile.config, {
        familyKey: family.value,
        lastAllocatedSequence: stemResult.value,
      });
    },

    async reserve(input) {
      try {
        const reservation = await store.reserve(input);
        return { ok: true, value: reservation };
      } catch (error) {
        if (isDomainError(error)) {
          return {
            ok: false,
            code: error.code as SkuErrorCode,
            message: error.message,
          };
        }
        throw error;
      }
    },
  };
}

async function resolveLastAllocated(
  store: SkuRegistryStore,
  profile: { workspaceId: string; config: PolicyProfileConfig },
  familyKey: string,
): Promise<SkuResult<number | null>> {
  const stem = resolveStem(profile.config, familyKey);
  if (!stem.ok) return stem;
  const last = await store.getLastAllocatedSequence(
    profile.workspaceId,
    stem.value,
  );
  return { ok: true, value: last };
}
