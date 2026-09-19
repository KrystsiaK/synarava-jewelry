import "server-only";

import type { TranslationResourceType } from "@prisma/client";
import { db } from "@/lib/db";
import type { EntityFieldRegistry } from "@/lib/i18n/admin-field-registry";
import { localizedFields } from "@/lib/i18n/admin-field-registry";
import {
  determineSyncDirection,
  diffFieldConflicts,
  type FieldConflict,
  type LocalizedRecord,
  type SyncDirection,
} from "@/lib/i18n/admin-localization";
import { fetchTranslatableResourceIndex, type RemoteTranslation } from "@/lib/shopify/translations";

export type ReconcilePlan = {
  direction: SyncDirection;
  conflicts: FieldConflict[];
};

/**
 * Pure three-way diff — no reads, no writes. `base` is the PT content as of
 * the last successful sync (`ShopifyTranslationBinding.lastSyncedSnapshot`);
 * null before the first sync. With no base, a field differing between local
 * and remote is still a conflict (both sides may have unsynced content and
 * neither is known-authoritative) — only a field matching the untouched
 * side resolves cleanly to push/pull.
 */
export function planReconcile<T extends LocalizedRecord>(
  registry: EntityFieldRegistry,
  base: T | null,
  local: T,
  remote: T,
): ReconcilePlan {
  return {
    direction: determineSyncDirection(registry, base, local, remote),
    conflicts: diffFieldConflicts(registry, base, local, remote),
  };
}

/** Shopify's flat `{key, value}[]` translation list, projected onto registry field keys via each field's native/metafield Shopify key. Fields with a metaobject target have no flat Shopify key here — reconciling those is the owning metaobject adapter's job (Task 16), not this generic sweep. */
export function projectRemoteTranslation(registry: EntityFieldRegistry, translations: RemoteTranslation[]): LocalizedRecord {
  const values = new Map(translations.map((t) => [t.key, t.value]));
  const projected: LocalizedRecord = {};
  for (const field of localizedFields(registry)) {
    const target = field.shopifyTarget;
    const shopifyKey = target && (target.kind === "native" || target.kind === "metafield") ? target.key : null;
    if (shopifyKey && values.has(shopifyKey)) projected[field.key] = values.get(shopifyKey);
  }
  return projected;
}

/**
 * Read-only sweep: pages every Shopify resource of `resourceType` with a PT
 * translation, matches it to a known local binding, and plans a reconcile
 * for each. Never writes — applying PUSH/PULL/CONFLICT resolutions is an
 * entity-specific concern (Task 9/11/16 adapters), this only reports what
 * each binding needs.
 */
export async function reconcileResourceType({
  registry,
  resourceType,
  locale,
  loadLocal,
}: {
  registry: EntityFieldRegistry;
  resourceType: TranslationResourceType;
  locale: string;
  loadLocal: (entityId: string) => Promise<LocalizedRecord | null>;
}) {
  const remoteByShopifyId = await fetchTranslatableResourceIndex(resourceType, locale);
  const bindings = await db.shopifyTranslationBinding.findMany({
    where: { resourceType, shopifyResourceId: { in: [...remoteByShopifyId.keys()] } },
  });

  const results: Array<{ bindingId: string; entityId: string; shopifyResourceId: string; plan: ReconcilePlan }> = [];
  for (const binding of bindings) {
    const remoteTranslations = remoteByShopifyId.get(binding.shopifyResourceId) ?? [];
    const local = await loadLocal(binding.entityId);
    if (!local) continue;

    const remote = projectRemoteTranslation(registry, remoteTranslations);
    const base = (binding.lastSyncedSnapshot as LocalizedRecord | null) ?? null;
    results.push({
      bindingId: binding.id,
      entityId: binding.entityId,
      shopifyResourceId: binding.shopifyResourceId,
      plan: planReconcile(registry, base, local, remote),
    });
  }
  return results;
}
