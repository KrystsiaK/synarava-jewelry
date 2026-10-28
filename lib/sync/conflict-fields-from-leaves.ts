/**
 * Map SyncResult leaves → CatalogConflictField[] for ConflictResolver.
 * Pure over already-compared leaves; no Shopify fetch.
 */

import { createHash } from "node:crypto";

import type {
  CatalogConflictField,
  CatalogConflictFieldScope,
} from "@/lib/shopify/catalog-conflict";
import type { CatalogPresenceDifference } from "@/lib/shopify/catalog-presence";

import type { SyncLeaf, SyncResourceType, SyncResult } from "./types";

export type ConflictFieldLocaleMeta = {
  code: string;
  name: string;
  nativeName: string;
};

function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function originFromKind(kind: SyncLeaf["kind"]): CatalogConflictField["origin"] {
  if (kind === "commerce") return "COMMERCE";
  if (kind === "translation") return "TRANSLATION";
  return "PRESENCE";
}

function scopeForLeaf(
  leaf: SyncLeaf,
  locales: readonly ConflictFieldLocaleMeta[],
): CatalogConflictFieldScope {
  if (leaf.locale == null) return { kind: "SHARED" };
  const meta = locales.find((locale) => locale.code === leaf.locale);
  return {
    kind: "LOCALE",
    code: leaf.locale,
    name: meta?.name ?? leaf.locale,
    nativeName: meta?.nativeName ?? leaf.locale,
  };
}

function summarizeProductPresence(difference: CatalogPresenceDifference): {
  synaravaValue: string;
  shopifyValue: string;
} {
  const summarize = (identity: { name: string; sku: string } | null) => identity
    ? [identity.name, identity.sku ? `SKU ${identity.sku}` : ""].filter(Boolean).join(" · ")
    : "— Product is missing —";
  return {
    synaravaValue: summarize(difference.localIdentity),
    shopifyValue: summarize(difference.shopifyIdentity),
  };
}

function summarizeCollectionPresence(difference: CatalogPresenceDifference): {
  synaravaValue: string;
  shopifyValue: string;
} {
  const summarize = (identity: { name: string; handle: string } | null) => identity
    ? [identity.name, identity.handle ? `/${identity.handle}` : ""].filter(Boolean).join(" · ")
    : "— Collection is missing —";
  return {
    synaravaValue: summarize(difference.localIdentity),
    shopifyValue: summarize(difference.shopifyIdentity),
  };
}

/**
 * Map SyncLeaves for one entity into ConflictResolver field rows.
 */
export function catalogConflictFieldsFromLeaves(
  leaves: readonly SyncLeaf[],
  locales: readonly ConflictFieldLocaleMeta[],
  presenceDifference?: CatalogPresenceDifference | null,
): CatalogConflictField[] {
  return leaves.map((leaf) => {
    const isPresence = leaf.kind === "presence";
    const presenceValues = isPresence && presenceDifference
      ? leaf.resourceType === "COLLECTION"
        ? summarizeCollectionPresence(presenceDifference)
        : summarizeProductPresence(presenceDifference)
      : null;

    return {
      fieldKey: leaf.fieldKey,
      label: leaf.label,
      scope: scopeForLeaf(leaf, locales),
      origin: originFromKind(leaf.kind),
      targetKind: leaf.targetKind ?? "NATIVE",
      synaravaValue: presenceValues?.synaravaValue ?? leaf.synaravaValue,
      shopifyValue: presenceValues?.shopifyValue ?? leaf.shopifyValue,
      localFingerprint: leaf.localFingerprint
        ?? (isPresence && presenceDifference
          ? presenceDifference.localFingerprint
          : fingerprint(leaf.synaravaValue)),
      shopifyFingerprint: leaf.shopifyFingerprint
        ?? (isPresence && presenceDifference
          ? presenceDifference.shopifyFingerprint
          : fingerprint(leaf.shopifyValue)),
      allowedDirections: [...leaf.allowedDirections],
      blockedReason: leaf.blockedReason,
      sourceId: leaf.sourceId,
      path: leaf.path,
      contractKey: leaf.contractKey ?? null,
      section: leaf.section ?? null,
      parts: leaf.parts ?? null,
      previewUrl: leaf.previewUrl ?? null,
      ...(isPresence && presenceDifference ? { presenceDifference } : {}),
    };
  });
}

/**
 * Leaves for one resource from a SyncResult → CatalogConflictField[].
 */
export function catalogConflictFieldsForEntity(
  result: SyncResult,
  options: {
    resourceType: SyncResourceType;
    resourceId: string;
    locales: readonly ConflictFieldLocaleMeta[];
    presenceDifference?: CatalogPresenceDifference | null;
  },
): CatalogConflictField[] {
  const leaves = result.leaves.filter(
    (leaf) => leaf.resourceType === options.resourceType && leaf.resourceId === options.resourceId,
  );
  return catalogConflictFieldsFromLeaves(
    leaves,
    options.locales,
    options.presenceDifference,
  );
}
