/**
 * Plain-language confirm/preview model for ConflictResolver.
 * Pure helpers — no server apply/preview logic.
 */

import type { CatalogConflictDirection, CatalogConflictField } from "@/lib/shopify/catalog-conflict";

export type ConflictConfirmConsequence = "create" | "update" | "remove";
export type ConflictConfirmSide = "shopify" | "synarava";

export type ConflictConfirmEntity = {
  id: string;
  name: string;
  detail?: string | null;
};

export type ConflictConfirmEntry = {
  field: CatalogConflictField;
  direction: CatalogConflictDirection;
  wholeRecord?: boolean;
};

export type ConflictConfirmChangeView = {
  headline: string;
  consequence: ConflictConfirmConsequence;
  sourceSide: ConflictConfirmSide;
  targetSide: ConflictConfirmSide;
  sourceLabel: string;
  targetLabel: string;
  sourceValue: string;
  beforeValue: string;
  afterValue: string;
};

const SIDE_LABEL: Record<ConflictConfirmSide, string> = {
  shopify: "Shopify",
  synarava: "Synarava (ours)",
};

const TO_SYNARAVA: CatalogConflictDirection = "SHOPIFY_TO_SYNARAVA";
const TO_SHOPIFY: CatalogConflictDirection = "SYNARAVA_TO_SHOPIFY";

/** Technical / virtual ids must never appear as human titles in admin UI. */
export function isTechnicalEntityId(id: string): boolean {
  return (
    id.startsWith("shopify:")
    || id.startsWith("shopify-collection:")
    || /^gid:\/\//i.test(id)
  );
}

function untitledEntity(entityNoun: string): string {
  return `Untitled ${entityNoun}`;
}

/** Human title for ConflictResolver list/confirm — never a synthetic Shopify id. */
export function humanConflictEntityTitle(
  candidate: string | null | undefined,
  entityNoun: string,
): string {
  const trimmed = candidate?.trim() ?? "";
  if (!trimmed || isTechnicalEntityId(trimmed)) return untitledEntity(entityNoun);
  return trimmed;
}

type PresenceIdentity = { name: string; handle: string; sku: string };

function presenceIdentity(
  field: CatalogConflictField | undefined,
): PresenceIdentity | null {
  const presence = field?.presenceDifference;
  if (!presence) return null;
  return presence.shopifyIdentity ?? presence.localIdentity ?? null;
}

function presenceNameCandidate(field: CatalogConflictField | undefined): string | null {
  const presence = field?.presenceDifference;
  if (!presence) return null;
  return (
    presence.shopifyIdentity?.name
    ?? presence.localIdentity?.name
    ?? presence.name
    ?? null
  );
}

/** Secondary line: `/handle` for collections, `SKU …` for products. */
export function conflictEntityDetailFromIdentity(
  identity: { handle?: string | null; sku?: string | null } | null | undefined,
  entityNoun: string,
): string | null {
  if (!identity) return null;
  if (entityNoun === "product") {
    const sku = identity.sku?.trim();
    return sku ? `SKU ${sku}` : null;
  }
  const handle = identity.handle?.trim();
  if (!handle) return null;
  return handle.startsWith("/") ? handle : `/${handle}`;
}

type ConflictEntitySignalBits = {
  name?: string | null;
  handle?: string | null;
  sku?: string | null;
};

/**
 * Shared entity summary for ConflictResolver list headers (and confirm).
 * Prefer presence identity → listed/signal name → "Untitled {noun}".
 * Synthetic ids (`shopify-collection:…`, `shopify:…`, GID) are never titles.
 */
export function resolveConflictEntitySummary(input: {
  id: string;
  entityNoun: string;
  entity?: ConflictConfirmEntity | null;
  fields?: readonly CatalogConflictField[];
  signal?: ConflictEntitySignalBits | null;
}): ConflictConfirmEntity {
  const presenceField = input.fields?.find((field) => field.origin === "PRESENCE");
  const identity = presenceIdentity(presenceField);
  const name = humanConflictEntityTitle(
    presenceNameCandidate(presenceField)
      ?? input.entity?.name
      ?? input.signal?.name
      ?? null,
    input.entityNoun,
  );
  const detail =
    conflictEntityDetailFromIdentity(identity, input.entityNoun)
    ?? (input.entity?.detail?.trim() || null)
    ?? conflictEntityDetailFromIdentity(
      { handle: input.signal?.handle, sku: input.signal?.sku },
      input.entityNoun,
    );
  return { id: input.id, name, detail };
}

function presenceTitle(
  field: CatalogConflictField,
  entity: ConflictConfirmEntity | undefined,
  entityNoun: string,
): string {
  return humanConflictEntityTitle(
    presenceNameCandidate(field) ?? entity?.name,
    entityNoun,
  );
}

function sideValue(field: CatalogConflictField, side: ConflictConfirmSide): string {
  const raw = side === "shopify" ? field.shopifyValue : field.synaravaValue;
  if (field.origin === "PRESENCE") {
    const missing = !raw || raw === "—" || raw.startsWith("— ");
    if (missing) {
      return side === "shopify" ? "Not in Shopify" : "Not in Synarava";
    }
  }
  return raw?.trim() || "— empty —";
}

function isMissingSide(field: CatalogConflictField, side: ConflictConfirmSide): boolean {
  if (field.origin !== "PRESENCE") return false;
  const raw = side === "shopify" ? field.shopifyValue : field.synaravaValue;
  return !raw || raw === "—" || raw.startsWith("— ");
}

function fieldLabelForCopy(field: CatalogConflictField): string {
  const label = field.label.trim() || "value";
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/**
 * Build the confirm-row view for one preview entry.
 * Uses only fields already present on the preview payload (field + direction + entity summary).
 */
export function describeConflictConfirmChange(
  entry: ConflictConfirmEntry,
  entity: ConflictConfirmEntity | undefined,
  entityNoun: string,
): ConflictConfirmChangeView {
  const { field, direction } = entry;
  const toShopify = direction === TO_SHOPIFY;
  const sourceSide: ConflictConfirmSide = toShopify ? "synarava" : "shopify";
  const targetSide: ConflictConfirmSide = toShopify ? "shopify" : "synarava";
  const sourceValue = sideValue(field, sourceSide);
  const targetCurrent = sideValue(field, targetSide);

  const presenceKind = field.origin === "PRESENCE" ? field.presenceDifference?.kind : null;
  const creating =
    field.origin === "PRESENCE"
    && (
      (presenceKind === "SHOPIFY_ONLY" && direction === TO_SYNARAVA)
      || (presenceKind === "SYNARAVA_ONLY" && direction === TO_SHOPIFY)
    );
  const removing =
    field.origin === "PRESENCE"
    && presenceKind === "SYNARAVA_ONLY"
    && direction === TO_SYNARAVA;

  let consequence: ConflictConfirmConsequence = "update";
  let beforeValue = targetCurrent;
  let afterValue = sourceValue;
  let headline: string;

  const title = presenceTitle(field, entity, entityNoun);

  if (creating) {
    consequence = "create";
    beforeValue = isMissingSide(field, targetSide)
      ? (targetSide === "shopify" ? "Not in Shopify" : "Not in Synarava")
      : targetCurrent;
    afterValue = sourceValue;
    headline = `Create "${title}" in ${targetSide === "shopify" ? "Shopify" : "Synarava"}`;
  } else if (removing) {
    consequence = "remove";
    beforeValue = targetCurrent;
    afterValue = "Removed";
    headline = `Remove "${title}" from Synarava (linked products stay)`;
  } else if (toShopify) {
    consequence = "update";
    headline = `Update ${fieldLabelForCopy(field)} in Shopify`;
  } else {
    consequence = "update";
    headline = `Take Shopify's ${fieldLabelForCopy(field)} into Synarava`;
  }

  if (entry.wholeRecord && consequence === "update") {
    headline = toShopify
      ? "Sync whole item to Shopify"
      : "Take Shopify's whole item into Synarava";
  }

  return {
    headline,
    consequence,
    sourceSide,
    targetSide,
    sourceLabel: SIDE_LABEL[sourceSide],
    targetLabel: SIDE_LABEL[targetSide],
    sourceValue,
    beforeValue,
    afterValue,
  };
}

export function summarizeConfirmDirections(
  entries: Array<{ direction: CatalogConflictDirection }>,
): { toShopify: number; toSynarava: number } {
  let toShopify = 0;
  let toSynarava = 0;
  for (const entry of entries) {
    if (entry.direction === TO_SHOPIFY) toShopify += 1;
    else toSynarava += 1;
  }
  return { toShopify, toSynarava };
}

export function formatConfirmDirectionSummary(counts: {
  toShopify: number;
  toSynarava: number;
}): string {
  const shopify = `${counts.toShopify} ${counts.toShopify === 1 ? "change" : "changes"} to Shopify`;
  const synarava = `${counts.toSynarava} ${counts.toSynarava === 1 ? "change" : "changes"} to Synarava`;
  return `${shopify} · ${synarava}`;
}
