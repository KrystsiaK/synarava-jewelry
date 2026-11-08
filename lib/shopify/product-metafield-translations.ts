import "server-only";

import {
  customMetafieldsFromOurWindow,
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

/** Human-readable `namespace.key` for admin / Push errors. */
export function metafieldDotIdentity(identity: string): string {
  const separator = identity.indexOf("::");
  if (separator < 0) return identity;
  return `${identity.slice(0, separator)}.${identity.slice(separator + 2)}`;
}

/** Every `namespace::key` that has a non-empty locale overlay in the window. */
export function translationOverlayIdentities(translations: MetafieldTranslations): string[] {
  const identities = new Set<string>();
  for (const bucket of Object.values(translations)) {
    for (const [identity, value] of Object.entries(bucket)) {
      if (value.trim()) identities.add(identity);
    }
  }
  return [...identities];
}

/**
 * Push PT/RU text overlays to Shopify Metafield translations (`key: value`).
 *
 * Targets need a Metafield GID only when there is a **non-empty EN** value in OUR
 * window or a **non-empty** locale overlay. Empty EN rows (common after Save of
 * blank Product-tab specs) never get `metafieldsSet` GIDs — they are neither
 * translation targets nor missing-GID errors. Overlay-only products (EN on
 * Shopify, overlays in extras) still register. Real overlays / non-empty EN
 * without a GID fail explicitly.
 *
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
  const custom = customMetafieldsFromOurWindow(workingSnapshot);
  const byIdentity = new Map(
    custom.map((item) => [metafieldIdentityKey(item.namespace, item.key), item] as const),
  );
  const idByIdentity = new Map<string, string>();
  const typeByIdentity = new Map<string, string>();
  for (const ref of metafieldRefs) {
    if (!ref.id || isManagedProductMetafieldNamespace(ref.namespace)) continue;
    const identity = metafieldIdentityKey(ref.namespace, ref.key);
    idByIdentity.set(identity, ref.id);
    if (ref.type) typeByIdentity.set(identity, ref.type);
  }

  const translations = metafieldTranslationsFromSnapshot(workingSnapshot);
  const overlayIdentities = new Set(translationOverlayIdentities(translations));
  const identities = new Set<string>();

  for (const [identity, item] of byIdentity) {
    if (!isTranslatableMetafieldType(item.type)) continue;
    // Empty EN never creates a Shopify metafield on Push — skip as a target.
    if (!item.value.trim()) continue;
    identities.add(identity);
  }
  for (const identity of overlayIdentities) {
    const type = byIdentity.get(identity)?.type
      ?? typeByIdentity.get(identity)
      ?? "single_line_text_field";
    if (isTranslatableMetafieldType(type)) identities.add(identity);
  }

  if (identities.size === 0 || locales.length === 0) return;

  const missingGids = [...identities]
    .filter((identity) => !idByIdentity.has(identity))
    .map(metafieldDotIdentity)
    .toSorted();

  if (missingGids.length > 0) {
    throw new Error(
      `Cannot push metafield translations — Shopify metafield GID missing for: ${missingGids.join(", ")}. `
        + "Save English values and Push first so the metafields exist on the product, then retry translations.",
    );
  }

  for (const locale of locales) {
    const bucket = translations[locale.code] ?? {};
    for (const identity of identities) {
      const hasNonEmptyEn = Boolean(byIdentity.get(identity)?.value.trim());
      const overlay = bucket[identity];
      // Overlay-only: skip blank locales (do not clear unknown remote state).
      // Non-empty EN keeps clear-on-blank semantics for that locale.
      if (!hasNonEmptyEn && !(overlay?.trim())) continue;
      const resourceId = idByIdentity.get(identity);
      if (!resourceId) continue;
      await registerTranslations({
        resourceId,
        locale: locale.shopifyLocale,
        values: { value: overlay ?? "" },
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
