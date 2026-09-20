import { createHash } from "node:crypto";

import {
  localizedFields,
  type EntityFieldRegistry,
  type LocalizedFieldDefinition,
} from "@/lib/i18n/admin-field-registry";

export type SyncDifferenceKind = "local-only" | "shopify-only" | "conflict";

export type RemoteFieldMetadata = {
  updatedAt?: string | null;
  outdated?: boolean | null;
};

export type SyncFieldDifference = {
  fieldKey: string;
  fieldLabel: string;
  targetKind: "native" | "metafield" | "metaobject";
  kind: SyncDifferenceKind;
  baseValue: unknown;
  localValue: unknown;
  shopifyValue: unknown;
  localFingerprint: string;
  shopifyFingerprint: string;
  shopifyUpdatedAt: string | null;
  shopifyOutdated: boolean | null;
};

type SyncRecord = Record<string, unknown>;

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith("#x")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return named[code.toLowerCase()] ?? entity;
  });
}

function normalizeText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeHtmlAsText(value: string): string {
  return normalizeText(decodeHtmlEntities(
    value
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(?:br|hr)\s*\/?\s*>/gi, " ")
      .replace(/<\/(?:p|div|li|h[1-6]|blockquote)>/gi, " ")
      .replace(/<[^>]*>/g, ""),
  ));
}

/** Converts Shopify's wire representation into the shape stored by local editors. */
export function shopifyValueForLocal(field: LocalizedFieldDefinition, value: unknown): unknown {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string" && isHtmlBody(field)) return normalizeHtmlAsText(value);
  if (field.kind === "rich-text" && typeof value === "string") {
    try {
      return stableValue(JSON.parse(value));
    } catch {
      return value.trim();
    }
  }
  return value;
}

function stableValue(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

function isHtmlBody(field: LocalizedFieldDefinition): boolean {
  return field.shopifyTarget?.kind === "native" && field.shopifyTarget.key === "body_html";
}

/**
 * Produces a comparison-only canonical value. It never mutates or replaces
 * the value shown to the operator: the merge UI keeps both originals.
 */
export function normalizeSyncValue(field: LocalizedFieldDefinition, value: unknown): string {
  if (value === undefined || value === null) return "";

  if (field.kind === "rich-text") {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return "";
      try {
        return JSON.stringify(stableValue(JSON.parse(trimmed)));
      } catch {
        return normalizeText(trimmed);
      }
    }
    return JSON.stringify(stableValue(value));
  }

  if (typeof value === "string") {
    return isHtmlBody(field) ? normalizeHtmlAsText(value) : normalizeText(value);
  }

  return JSON.stringify(stableValue(value));
}

export function fingerprintSyncValue(field: LocalizedFieldDefinition, value: unknown): string {
  return createHash("sha256").update(normalizeSyncValue(field, value)).digest("hex");
}

function differenceKind(
  field: LocalizedFieldDefinition,
  base: unknown,
  local: unknown,
  shopify: unknown,
  hasBase: boolean,
): SyncDifferenceKind {
  const normalizedLocal = normalizeSyncValue(field, local);
  const normalizedShopify = normalizeSyncValue(field, shopify);

  if (!hasBase) {
    if (normalizedLocal && !normalizedShopify) return "local-only";
    if (!normalizedLocal && normalizedShopify) return "shopify-only";
    return "conflict";
  }

  const normalizedBase = normalizeSyncValue(field, base);
  const localChanged = normalizedLocal !== normalizedBase;
  const shopifyChanged = normalizedShopify !== normalizedBase;

  if (localChanged && !shopifyChanged) return "local-only";
  if (!localChanged && shopifyChanged) return "shopify-only";
  return "conflict";
}

/**
 * Field-level three-way comparison for localized registry fields only.
 * Equal fields are deliberately omitted so the admin sees decisions, not
 * a wall of disabled controls. Shared catalog/media fields never enter this
 * translation workflow.
 */
export function compareLocalizedFields(
  registry: EntityFieldRegistry,
  base: SyncRecord | null | undefined,
  local: SyncRecord,
  shopify: SyncRecord,
  remoteMetadata: Record<string, RemoteFieldMetadata> = {},
): SyncFieldDifference[] {
  const differences: SyncFieldDifference[] = [];

  for (const field of localizedFields(registry)) {
    const target = field.shopifyTarget;
    if (!target) continue;

    const localValue = local[field.key];
    const shopifyValue = shopify[field.key];
    if (normalizeSyncValue(field, localValue) === normalizeSyncValue(field, shopifyValue)) continue;

    const metadata = remoteMetadata[field.key];
    differences.push({
      fieldKey: field.key,
      fieldLabel: field.label,
      targetKind: target.kind,
      kind: differenceKind(field, base?.[field.key], localValue, shopifyValue, base != null),
      baseValue: base?.[field.key] ?? null,
      localValue: localValue ?? null,
      shopifyValue: shopifyValue ?? null,
      localFingerprint: fingerprintSyncValue(field, localValue),
      shopifyFingerprint: fingerprintSyncValue(field, shopifyValue),
      shopifyUpdatedAt: metadata?.updatedAt ?? null,
      shopifyOutdated: metadata?.outdated ?? null,
    });
  }

  return differences;
}
