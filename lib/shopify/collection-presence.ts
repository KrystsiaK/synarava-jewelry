import { createHash } from "node:crypto";

export type LocalCollectionIdentity = {
  id: string;
  name: string;
  slug: string;
  shopifyCollectionId: string | null;
  updatedAt: string;
};

export type RemoteCollectionIdentity = {
  id: string;
  title: string;
  handle: string;
  updatedAt: string;
};

/** Same shape as product catalog presence so the shared conflict UI/signals can reuse it. */
export type CollectionPresenceDifference = {
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
  matchReason: "HANDLE" | null;
  localIdentity: { name: string; handle: string; sku: string } | null;
  shopifyIdentity: { name: string; handle: string; sku: string } | null;
};

const MISSING_FINGERPRINT = createHash("sha256").update("missing-collection").digest("hex");

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/** Membership identity only — see product `localCatalogFingerprint`. */
export function localCollectionFingerprint(collection: LocalCollectionIdentity): string {
  return fingerprint({
    id: collection.id,
    slug: collection.slug,
    shopifyCollectionId: collection.shopifyCollectionId,
  });
}

export function remoteCollectionFingerprint(collection: RemoteCollectionIdentity): string {
  return fingerprint({ id: collection.id });
}

function uniqueByHandle<T extends { slug?: string; handle?: string }>(
  items: T[],
  keyFor: (item: T) => string,
): Map<string, T> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFor(item).trim().toLowerCase();
    if (!key) continue;
    const group = grouped.get(key) ?? [];
    group.push(item);
    grouped.set(key, group);
  }
  return new Map(
    [...grouped.entries()].flatMap(([key, group]) => (group.length === 1 ? [[key, group[0]] as const] : [])),
  );
}

function remoteConflictId(shopifyCollectionId: string): string {
  return `shopify-collection:${shopifyCollectionId.split("/").pop() ?? shopifyCollectionId}`;
}

/**
 * Compares collection identity (Shopify id, then unique handle/slug).
 * Unlike products there is no SKU — handle is the only safe unlinked match.
 * @see https://shopify.dev/docs/api/admin-graphql/2026-07/queries/collections
 */
export function classifyCollectionPresence(
  localCollections: LocalCollectionIdentity[],
  remoteCollections: RemoteCollectionIdentity[],
): CollectionPresenceDifference[] {
  const localByShopifyId = new Map(
    localCollections.flatMap((collection) =>
      collection.shopifyCollectionId ? [[collection.shopifyCollectionId, collection] as const] : [],
    ),
  );
  const unlinked = localCollections.filter((collection) => !collection.shopifyCollectionId);
  const unlinkedByHandle = uniqueByHandle(unlinked, (collection) => collection.slug);
  const matchedLocalIds = new Set<string>();
  const differences: CollectionPresenceDifference[] = [];

  for (const remote of remoteCollections) {
    const linked = localByShopifyId.get(remote.id);
    if (linked) {
      matchedLocalIds.add(linked.id);
      continue;
    }

    const handleMatch = unlinkedByHandle.get(remote.handle.trim().toLowerCase());
    const candidate = handleMatch && !matchedLocalIds.has(handleMatch.id)
      ? { collection: handleMatch, reason: "HANDLE" as const }
      : null;
    if (candidate) matchedLocalIds.add(candidate.collection.id);

    differences.push({
      id: candidate?.collection.id ?? remoteConflictId(remote.id),
      kind: "SHOPIFY_ONLY",
      localProductId: candidate?.collection.id ?? null,
      shopifyProductId: remote.id,
      name: remote.title,
      handle: remote.handle,
      sku: "",
      localFingerprint: candidate ? localCollectionFingerprint(candidate.collection) : MISSING_FINGERPRINT,
      shopifyFingerprint: remoteCollectionFingerprint(remote),
      remoteMissing: false,
      matchReason: candidate?.reason ?? null,
      localIdentity: candidate
        ? { name: candidate.collection.name, handle: candidate.collection.slug, sku: "" }
        : null,
      shopifyIdentity: { name: remote.title, handle: remote.handle, sku: "" },
    });
  }

  for (const local of localCollections) {
    if (matchedLocalIds.has(local.id)) continue;
    differences.push({
      id: local.id,
      kind: "SYNARAVA_ONLY",
      localProductId: local.id,
      shopifyProductId: local.shopifyCollectionId,
      name: local.name,
      handle: local.slug,
      sku: "",
      localFingerprint: localCollectionFingerprint(local),
      shopifyFingerprint: MISSING_FINGERPRINT,
      remoteMissing: Boolean(local.shopifyCollectionId),
      matchReason: null,
      localIdentity: { name: local.name, handle: local.slug, sku: "" },
      shopifyIdentity: null,
    });
  }

  return differences.sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}
