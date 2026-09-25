import { createHash } from "node:crypto";

export type LocalCatalogIdentity = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  shopifyProductId: string | null;
  updatedAt: string;
};

export type RemoteCatalogIdentity = {
  id: string;
  title: string;
  handle: string;
  sku: string;
  updatedAt: string;
};

export type CatalogPresenceDifference = {
  id: string;
  kind: "SHOPIFY_ONLY" | "SYNARAVA_ONLY";
  localProductId: string | null;
  shopifyProductId: string | null;
  name: string;
  handle: string;
  sku: string;
  localFingerprint: string;
  shopifyFingerprint: string;
  remoteMissing: boolean;
  matchReason: "SKU" | "HANDLE" | null;
  localIdentity: { name: string; handle: string; sku: string } | null;
  shopifyIdentity: { name: string; handle: string; sku: string } | null;
};

const MISSING_FINGERPRINT = createHash("sha256").update("missing-product").digest("hex");

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * Presence conflicts are about catalog membership (create/link/push), not field
 * copy. Fingerprints must stay stable across title/`updatedAt` churn from a
 * live re-scan before apply — otherwise every Pull of an unchanged Shopify-only
 * product goes STALE. Include only identity that changes the apply target:
 * local row id, link state, and SKU/handle used for unique match.
 */
export function localCatalogFingerprint(product: LocalCatalogIdentity): string {
  return fingerprint({
    id: product.id,
    sku: product.sku,
    slug: product.slug,
    shopifyProductId: product.shopifyProductId,
  });
}

/** Remote membership identity is the Shopify product GID alone. */
export function remoteCatalogFingerprint(product: RemoteCatalogIdentity): string {
  return fingerprint({ id: product.id });
}

function uniqueMap<T>(items: T[], keyFor: (item: T) => string): Map<string, T> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFor(item).trim().toLowerCase();
    if (!key) continue;
    const group = grouped.get(key) ?? [];
    group.push(item);
    grouped.set(key, group);
  }
  return new Map(
    [...grouped.entries()].flatMap(([key, group]) => group.length === 1 ? [[key, group[0]] as const] : []),
  );
}

function remoteConflictId(shopifyProductId: string): string {
  return `shopify:${shopifyProductId.split("/").pop() ?? shopifyProductId}`;
}

/**
 * Compares catalog identity, not product fields. A unique unlinked SKU/handle
 * match is deliberately treated as Shopify-only so Pull can establish the
 * existing local row's Shopify identity without creating a duplicate.
 */
export function classifyCatalogPresence(
  localProducts: LocalCatalogIdentity[],
  remoteProducts: RemoteCatalogIdentity[],
): CatalogPresenceDifference[] {
  const localByShopifyId = new Map(
    localProducts.flatMap((product) => product.shopifyProductId ? [[product.shopifyProductId, product] as const] : []),
  );
  const unlinked = localProducts.filter((product) => !product.shopifyProductId);
  const unlinkedBySku = uniqueMap(unlinked, (product) => product.sku);
  const unlinkedByHandle = uniqueMap(unlinked, (product) => product.slug);
  const matchedLocalIds = new Set<string>();
  const differences: CatalogPresenceDifference[] = [];

  for (const remote of remoteProducts) {
    const linked = localByShopifyId.get(remote.id);
    if (linked) {
      matchedLocalIds.add(linked.id);
      continue;
    }

    const skuMatch = unlinkedBySku.get(remote.sku.trim().toLowerCase());
    const handleMatch = unlinkedByHandle.get(remote.handle.trim().toLowerCase());
    const candidate = skuMatch && !matchedLocalIds.has(skuMatch.id)
      ? { product: skuMatch, reason: "SKU" as const }
      : handleMatch && !matchedLocalIds.has(handleMatch.id)
        ? { product: handleMatch, reason: "HANDLE" as const }
        : null;
    if (candidate) matchedLocalIds.add(candidate.product.id);

    differences.push({
      id: candidate?.product.id ?? remoteConflictId(remote.id),
      kind: "SHOPIFY_ONLY",
      localProductId: candidate?.product.id ?? null,
      shopifyProductId: remote.id,
      name: remote.title,
      handle: remote.handle,
      sku: remote.sku,
      localFingerprint: candidate ? localCatalogFingerprint(candidate.product) : MISSING_FINGERPRINT,
      shopifyFingerprint: remoteCatalogFingerprint(remote),
      remoteMissing: false,
      matchReason: candidate?.reason ?? null,
      localIdentity: candidate ? { name: candidate.product.name, handle: candidate.product.slug, sku: candidate.product.sku } : null,
      shopifyIdentity: { name: remote.title, handle: remote.handle, sku: remote.sku },
    });
  }

  for (const local of localProducts) {
    if (matchedLocalIds.has(local.id)) continue;
    differences.push({
      id: local.id,
      kind: "SYNARAVA_ONLY",
      localProductId: local.id,
      shopifyProductId: local.shopifyProductId,
      name: local.name,
      handle: local.slug,
      sku: local.sku,
      localFingerprint: localCatalogFingerprint(local),
      shopifyFingerprint: MISSING_FINGERPRINT,
      remoteMissing: Boolean(local.shopifyProductId),
      matchReason: null,
      localIdentity: { name: local.name, handle: local.slug, sku: local.sku },
      shopifyIdentity: null,
    });
  }

  return differences.sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}
