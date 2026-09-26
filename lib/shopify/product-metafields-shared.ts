export type ProductMetafieldDefinition = {
  id: string;
  namespace: string;
  key: string;
  name: string;
  type: string;
  description: string | null;
};

export type ProductMetafieldValueInput = {
  namespace: string;
  key: string;
  type: string;
  value: string;
};

/** Form field prefixes — values write into workingSnapshot on Save; Push syncs to Shopify. */
export const CUSTOM_METAFIELD_VALUE_PREFIX = "customMetafieldValue:";
export const CUSTOM_METAFIELD_TYPE_PREFIX = "customMetafieldType:";

/** Passport + Shopify taxonomy namespaces — not shown as merchant “custom” fields. */
export function isManagedProductMetafieldNamespace(namespace: string) {
  return namespace === "synarava" || namespace === "shopify" || namespace === "global";
}

export function listCustomProductMetafieldDefinitions(
  definitions: ProductMetafieldDefinition[],
): ProductMetafieldDefinition[] {
  return definitions
    .filter((item) => !isManagedProductMetafieldNamespace(item.namespace))
    .toSorted((left, right) => left.name.localeCompare(right.name) || left.key.localeCompare(right.key));
}

export function slugifyMetafieldKey(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64) || "custom_field";
}

export function metafieldValueFromSnapshot(
  metafields: ReadonlyArray<{ namespace: string; key: string; value: string; type?: string }>,
  namespace: string,
  key: string,
): string {
  return metafields.find((item) => item.namespace === namespace && item.key === key)?.value ?? "";
}

export function customMetafieldValueFieldName(namespace: string, key: string) {
  return `${CUSTOM_METAFIELD_VALUE_PREFIX}${namespace}:${key}`;
}

export function customMetafieldTypeFieldName(namespace: string, key: string) {
  return `${CUSTOM_METAFIELD_TYPE_PREFIX}${namespace}:${key}`;
}

export function isCustomMetafieldFormField(name: string) {
  return name.startsWith(CUSTOM_METAFIELD_VALUE_PREFIX) || name.startsWith(CUSTOM_METAFIELD_TYPE_PREFIX);
}

/** Parse merchant metafield edits from the product Save FormData. */
export function parseCustomMetafieldsForm(formData: FormData): ProductMetafieldValueInput[] {
  const values: ProductMetafieldValueInput[] = [];
  for (const [name, raw] of formData.entries()) {
    if (typeof raw !== "string" || !name.startsWith(CUSTOM_METAFIELD_VALUE_PREFIX)) continue;
    const rest = name.slice(CUSTOM_METAFIELD_VALUE_PREFIX.length);
    const sep = rest.indexOf(":");
    if (sep <= 0) continue;
    const namespace = rest.slice(0, sep).trim();
    const key = rest.slice(sep + 1).trim();
    if (!namespace || !key || isManagedProductMetafieldNamespace(namespace)) continue;
    const typeRaw = formData.get(customMetafieldTypeFieldName(namespace, key));
    const type = typeof typeRaw === "string" && typeRaw.trim()
      ? typeRaw.trim()
      : "single_line_text_field";
    values.push({ namespace, key, type, value: raw });
  }
  return values;
}

type SnapshotMetafield = { namespace: string; key: string; type: string; value: string };

export function metafieldsArrayFromSnapshot(value: unknown): SnapshotMetafield[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const fields = (value as { metafields?: unknown }).metafields;
  if (!Array.isArray(fields)) return [];
  return fields.flatMap((field) => {
    if (!field || typeof field !== "object") return [];
    const row = field as Record<string, unknown>;
    if (
      typeof row.namespace !== "string"
      || typeof row.key !== "string"
      || typeof row.type !== "string"
      || typeof row.value !== "string"
    ) return [];
    return [{ namespace: row.namespace, key: row.key, type: row.type, value: row.value }];
  });
}

/** Merchant-owned metafields from OUR working window (for Push). */
export function customMetafieldsFromWorkingSnapshot(workingSnapshot: unknown): ProductMetafieldValueInput[] {
  return metafieldsArrayFromSnapshot(workingSnapshot)
    .filter((item) => !isManagedProductMetafieldNamespace(item.namespace))
    .map((item) => ({
      namespace: item.namespace,
      key: item.key,
      type: item.type,
      value: item.value,
    }));
}

/**
 * Upsert merchant metafield values into a Shopify-shaped metafields array.
 * Managed namespaces (synarava / shopify / global) are left untouched.
 */
export function mergeCustomMetafieldsIntoList(
  existing: unknown,
  customValues: ReadonlyArray<ProductMetafieldValueInput>,
): Array<Record<string, unknown>> {
  const current: Array<Record<string, unknown>> = Array.isArray(existing)
    ? existing.flatMap((field) => {
      if (!field || typeof field !== "object") return [];
      const row = field as Record<string, unknown>;
      if (typeof row.namespace !== "string" || typeof row.key !== "string") return [];
      return [row];
    })
    : [];

  const byId = new Map(current.map((item) => [`${item.namespace}::${item.key}`, { ...item }] as const));
  for (const item of customValues) {
    if (isManagedProductMetafieldNamespace(item.namespace)) continue;
    const id = `${item.namespace}::${item.key}`;
    const previous = byId.get(id) ?? {};
    byId.set(id, {
      ...previous,
      namespace: item.namespace,
      key: item.key,
      type: item.type || (typeof previous.type === "string" ? previous.type : "single_line_text_field"),
      value: item.value,
    });
  }
  return [...byId.values()];
}
