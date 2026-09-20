import "server-only";

import type { TranslationResourceType } from "@prisma/client";
import { db } from "@/lib/db";
import type { EntityFieldRegistry } from "@/lib/i18n/admin-field-registry";
import { localizedFields } from "@/lib/i18n/admin-field-registry";
import {
  type FieldConflict,
  type LocalizedRecord,
  type SyncDirection,
} from "@/lib/i18n/admin-localization";
import {
  compareLocalizedFields,
  type RemoteFieldMetadata,
  type SyncFieldDifference,
} from "@/lib/i18n/sync-comparison";
import { metaobjectFieldKey } from "@/lib/shopify/metaobject-field-key";
import { fetchTranslatableResourceIndex, type RemoteTranslation } from "@/lib/shopify/translations";

type RemoteValue = Pick<RemoteTranslation, "key" | "value"> & {
  updatedAt?: string | null;
  outdated?: boolean | null;
};

export type ReconcilePlan = {
  direction: SyncDirection;
  conflicts: FieldConflict[];
  differences: SyncFieldDifference[];
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
  remoteMetadata: Record<string, RemoteFieldMetadata> = {},
): ReconcilePlan {
  const differences = compareLocalizedFields(registry, base, local, remote, remoteMetadata);
  const hasLocal = differences.some(({ kind }) => kind === "local-only");
  const hasShopify = differences.some(({ kind }) => kind === "shopify-only");
  const conflicts = differences
    .filter(({ kind }) => kind === "conflict")
    .map(({ fieldKey, localValue, shopifyValue }) => ({
      field: fieldKey,
      local: String(localValue ?? ""),
      remote: String(shopifyValue ?? ""),
    }));

  let direction: SyncDirection = "noop";
  if (conflicts.length > 0 || (hasLocal && hasShopify)) direction = "conflict";
  else if (hasLocal) direction = "push";
  else if (hasShopify) direction = "pull";

  return {
    direction,
    conflicts,
    differences,
  };
}

/** Shopify's flat `{key, value}[]` translation list, projected onto registry field keys. Callers pass a target-filtered registry so native resources and their app-owned metaobjects remain independent review/apply scopes. */
export function projectRemoteTranslation(registry: EntityFieldRegistry, translations: RemoteValue[]): LocalizedRecord {
  return projectRemoteTranslationWithMetadata(registry, translations).values;
}

export function projectRemoteTranslationWithMetadata(
  registry: EntityFieldRegistry,
  translations: RemoteValue[],
): { values: LocalizedRecord; metadata: Record<string, RemoteFieldMetadata> } {
  const values = new Map(translations.map((t) => [t.key, t.value]));
  const projected: LocalizedRecord = {};
  const metadata: Record<string, RemoteFieldMetadata> = {};
  for (const field of localizedFields(registry)) {
    const target = field.shopifyTarget;
    const shopifyKey = target?.kind === "metaobject" ? metaobjectFieldKey(target.key) : target?.key ?? null;
    if (!shopifyKey || !values.has(shopifyKey)) continue;
    const translation = translations.find(({ key }) => key === shopifyKey);
    projected[field.key] = values.get(shopifyKey);
    metadata[field.key] = {
      updatedAt: translation?.updatedAt ?? null,
      outdated: translation?.outdated ?? null,
    };
  }
  return { values: projected, metadata };
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

    const remoteProjection = projectRemoteTranslationWithMetadata(registry, remoteTranslations);
    const base = (binding.lastSyncedSnapshot as LocalizedRecord | null) ?? null;
    results.push({
      bindingId: binding.id,
      entityId: binding.entityId,
      shopifyResourceId: binding.shopifyResourceId,
      plan: planReconcile(registry, base, local, remoteProjection.values, remoteProjection.metadata),
    });
  }
  return results;
}
