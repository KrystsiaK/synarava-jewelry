import "server-only";

import {
  customMetafieldsFromWorkingSnapshot,
  isManagedProductMetafieldNamespace,
  isTranslatableMetafieldType,
  metafieldIdentityKey,
  metafieldTranslationsFromSnapshot,
  type MetafieldTranslations,
  type ProductMetafieldValueInput,
} from "@/lib/shopify/product-metafields-shared";
import { fetchResourceTranslation, registerTranslations } from "@/lib/shopify/translations";

type MetafieldRef = {
  id?: string | null;
  namespace: string;
  key: string;
  type: string;
};

/**
 * Push PT/RU text overlays to Shopify Metafield translations (`key: value`).
 * @see https://shopify.dev/docs/apps/build/markets/manage-translated-content
 */
export async function pushCustomMetafieldTranslations({
  metafieldRefs,
  workingSnapshot,
  locales,
}: {
  metafieldRefs: ReadonlyArray<MetafieldRef>;
  workingSnapshot: unknown;
  locales: ReadonlyArray<{ code: string; shopifyLocale: string }>;
}): Promise<void> {
  const custom = customMetafieldsFromWorkingSnapshot(workingSnapshot);
  const byIdentity = new Map(
    custom.map((item) => [metafieldIdentityKey(item.namespace, item.key), item] as const),
  );
  const idByIdentity = new Map<string, string>();
  for (const ref of metafieldRefs) {
    if (!ref.id || isManagedProductMetafieldNamespace(ref.namespace)) continue;
    idByIdentity.set(metafieldIdentityKey(ref.namespace, ref.key), ref.id);
  }

  const translations = metafieldTranslationsFromSnapshot(workingSnapshot);
  const targets = [...byIdentity.entries()].filter(([, item]) => isTranslatableMetafieldType(item.type));
  if (targets.length === 0 || locales.length === 0) return;

  for (const locale of locales) {
    const bucket = translations[locale.code] ?? {};
    for (const [identity] of targets) {
      const resourceId = idByIdentity.get(identity);
      if (!resourceId) continue;
      await registerTranslations({
        resourceId,
        locale: locale.shopifyLocale,
        values: { value: bucket[identity] ?? "" },
      });
    }
  }
}

/** Pull Metafield `value` translations for merchant text fields into the local overlay map. */
export async function fetchCustomMetafieldTranslations(
  metafieldRefs: ReadonlyArray<MetafieldRef>,
  locales: ReadonlyArray<{ code: string; shopifyLocale: string }>,
): Promise<MetafieldTranslations> {
  const out: MetafieldTranslations = {};
  const targets = metafieldRefs.filter(
    (item) =>
      item.id
      && !isManagedProductMetafieldNamespace(item.namespace)
      && isTranslatableMetafieldType(item.type),
  );
  if (targets.length === 0 || locales.length === 0) return out;

  for (const locale of locales) {
    const bucket: Record<string, string> = {};
    for (const item of targets) {
      if (!item.id) continue;
      const remote = await fetchResourceTranslation(item.id, locale.shopifyLocale);
      const value = remote?.find((entry) => entry.key === "value")?.value?.trim();
      if (value) bucket[metafieldIdentityKey(item.namespace, item.key)] = value;
    }
    if (Object.keys(bucket).length > 0) out[locale.code] = bucket;
  }
  return out;
}

export function metafieldRefsFromNodes(
  nodes: ReadonlyArray<{ id?: string | null; namespace: string; key: string; type: string }>,
): MetafieldRef[] {
  return nodes.map((node) => ({
    id: node.id,
    namespace: node.namespace,
    key: node.key,
    type: node.type,
  }));
}

export type { ProductMetafieldValueInput };
