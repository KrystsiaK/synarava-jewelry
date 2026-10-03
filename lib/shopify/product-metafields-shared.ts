import { adminLocaleFieldName } from "@/lib/i18n/admin-locale-fields";

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

/** locale → metafield identity (`namespace::key`) → translated value. */
export type MetafieldTranslations = Record<string, Record<string, string>>;

/** Form field prefixes — values write into workingSnapshot on Save; Push syncs to Shopify. */
export const CUSTOM_METAFIELD_VALUE_PREFIX = "customMetafieldValue:";
export const CUSTOM_METAFIELD_TYPE_PREFIX = "customMetafieldType:";

/** Sibling on workingSnapshot — stripped from commerce compare (not Shopify product JSON). */
export const METAFIELD_TRANSLATIONS_KEY = "metafieldTranslations";

const SOURCE_LOCALE = "en";

const TRANSLATABLE_METAFIELD_TYPES = new Set([
  "single_line_text_field",
  "multi_line_text_field",
  "rich_text_field",
]);

/** Passport + Shopify taxonomy namespaces — not shown as merchant “custom” fields. */
export function isManagedProductMetafieldNamespace(namespace: string) {
  return namespace === "synarava" || namespace === "shopify" || namespace === "global";
}

/** Text / rich-text metafields can use Shopify Translations API (`key: value`). */
export function isTranslatableMetafieldType(type: string) {
  return TRANSLATABLE_METAFIELD_TYPES.has(type);
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

export function customMetafieldValueFieldName(namespace: string, key: string, locale = SOURCE_LOCALE) {
  const base = `${CUSTOM_METAFIELD_VALUE_PREFIX}${namespace}:${key}`;
  return adminLocaleFieldName(locale, base, SOURCE_LOCALE);
}

export function customMetafieldTypeFieldName(namespace: string, key: string) {
  return `${CUSTOM_METAFIELD_TYPE_PREFIX}${namespace}:${key}`;
}

function isLocalePrefixedCustomMetafieldValueField(name: string) {
  // ptCustomMetafieldValue:ns:key / ruCustomMetafieldValue:ns:key
  return /^[a-z]{2}CustomMetafieldValue:/i.test(name);
}

export function isCustomMetafieldFormField(name: string) {
  return name.startsWith(CUSTOM_METAFIELD_VALUE_PREFIX)
    || name.startsWith(CUSTOM_METAFIELD_TYPE_PREFIX)
    || isLocalePrefixedCustomMetafieldValueField(name);
}

/** Whether a metafield FormData key belongs to the given editor locale. */
export function customMetafieldFieldBelongsToLocale(fieldName: string, locale: string) {
  if (fieldName.startsWith(CUSTOM_METAFIELD_TYPE_PREFIX)) {
    // Schema/type is shared; only English Save owns it.
    return locale === SOURCE_LOCALE;
  }
  if (fieldName.startsWith(CUSTOM_METAFIELD_VALUE_PREFIX)) {
    return locale === SOURCE_LOCALE;
  }
  if (isLocalePrefixedCustomMetafieldValueField(fieldName)) {
    const head = locale.toLowerCase();
    return fieldName.toLowerCase().startsWith(`${head}custommetafieldvalue:`);
  }
  return false;
}

/** Parse merchant metafield edits from the product Save FormData (source locale). */
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

/**
 * Parse per-locale text overlays (`ptCustomMetafieldValue:ns:key`).
 * Empty strings clear the overlay for that locale/field.
 */
export function parseCustomMetafieldTranslationsForm(formData: FormData): MetafieldTranslations {
  const out: MetafieldTranslations = {};
  for (const [name, raw] of formData.entries()) {
    if (typeof raw !== "string" || !isLocalePrefixedCustomMetafieldValueField(name)) continue;
    const match = /^([a-z]{2})CustomMetafieldValue:(.+)$/i.exec(name);
    if (!match) continue;
    const locale = match[1].toLowerCase();
    if (locale === SOURCE_LOCALE) continue;
    const rest = match[2];
    const sep = rest.indexOf(":");
    if (sep <= 0) continue;
    const namespace = rest.slice(0, sep).trim();
    const key = rest.slice(sep + 1).trim();
    if (!namespace || !key || isManagedProductMetafieldNamespace(namespace)) continue;
    const id = metafieldIdentityKey(namespace, key);
    const bucket = out[locale] ?? (out[locale] = {});
    const trimmed = raw.trim();
    if (trimmed) bucket[id] = raw;
    else delete bucket[id];
  }
  for (const locale of Object.keys(out)) {
    if (Object.keys(out[locale]).length === 0) delete out[locale];
  }
  return out;
}

export function formDataHasMetafieldTranslationFields(formData: FormData) {
  for (const name of formData.keys()) {
    if (isLocalePrefixedCustomMetafieldValueField(name)) return true;
  }
  return false;
}

export function metafieldTranslationsFromSnapshot(value: unknown): MetafieldTranslations {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = (value as Record<string, unknown>)[METAFIELD_TRANSLATIONS_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: MetafieldTranslations = {};
  for (const [locale, fields] of Object.entries(raw)) {
    if (!locale || locale === SOURCE_LOCALE) continue;
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) continue;
    const bucket: Record<string, string> = {};
    for (const [id, text] of Object.entries(fields)) {
      if (typeof text === "string" && text.trim()) bucket[id] = text;
    }
    if (Object.keys(bucket).length > 0) out[locale] = bucket;
  }
  return out;
}

export function metafieldTranslatedValue(
  translations: MetafieldTranslations,
  locale: string,
  namespace: string,
  key: string,
): string {
  if (!locale || locale === SOURCE_LOCALE) return "";
  return translations[locale]?.[metafieldIdentityKey(namespace, key)] ?? "";
}

/** Merge locale overlays (patch wins per locale key; empty patch locale clears nothing unless explicit). */
export function mergeMetafieldTranslations(
  existing: MetafieldTranslations,
  patch: MetafieldTranslations,
): MetafieldTranslations {
  const out: MetafieldTranslations = {};
  for (const [locale, fields] of Object.entries(existing)) {
    out[locale] = { ...fields };
  }
  for (const [locale, fields] of Object.entries(patch)) {
    out[locale] = { ...fields };
  }
  for (const locale of Object.keys(out)) {
    if (Object.keys(out[locale]).length === 0) delete out[locale];
  }
  return out;
}

/** Re-attach overlays after canonicalize (which strips the sibling key). */
export function withMetafieldTranslations(
  projection: unknown,
  translations: MetafieldTranslations,
): unknown {
  if (!projection || typeof projection !== "object" || Array.isArray(projection)) {
    return Object.keys(translations).length > 0
      ? { metafieldTranslations: translations }
      : projection;
  }
  const next = { ...(projection as Record<string, unknown>) };
  if (Object.keys(translations).length > 0) {
    next[METAFIELD_TRANSLATIONS_KEY] = translations;
  } else {
    delete next[METAFIELD_TRANSLATIONS_KEY];
  }
  return next;
}

type SnapshotMetafield = { namespace: string; key: string; type: string; value: string };

/** Stable identity for metafield compare / map keys (`namespace::key`). */
export function metafieldIdentityKey(namespace: string, key: string) {
  return `${namespace}::${key}`;
}

/**
 * Accept Shopify array shape or the canonical `namespace::key` map.
 * Compare persist uses the map; readers must accept both.
 */
export function coerceMetafieldRows(metafields: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(metafields)) {
    return metafields.flatMap((field) => {
      if (!field || typeof field !== "object") return [];
      return [field as Record<string, unknown>];
    });
  }
  if (metafields && typeof metafields === "object") {
    const record = metafields as Record<string, unknown>;
    // GraphQL connection shape before flatten (`{ nodes, pageInfo }`).
    if (Array.isArray(record.nodes)) return coerceMetafieldRows(record.nodes);
    return Object.values(record).flatMap((field) => {
      if (!field || typeof field !== "object" || Array.isArray(field)) return [];
      return [field as Record<string, unknown>];
    });
  }
  return [];
}

export function metafieldsArrayFromSnapshot(value: unknown): SnapshotMetafield[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const fields = (value as { metafields?: unknown }).metafields;
  return coerceMetafieldRows(fields).flatMap((row) => {
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
  const current = coerceMetafieldRows(existing).filter(
    (row) => typeof row.namespace === "string" && typeof row.key === "string",
  );

  const byId = new Map<string, Record<string, unknown>>(
    current.map((item) => [metafieldIdentityKey(String(item.namespace), String(item.key)), { ...item }]),
  );
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
