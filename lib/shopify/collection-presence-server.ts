import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { ShopifyAdminError, shopifyAdminRequest } from "@/lib/shopify/admin";
import {
  classifyCollectionPresence,
  type CollectionPresenceDifference,
  type LocalCollectionIdentity,
  type RemoteCollectionIdentity,
} from "@/lib/shopify/collection-presence";
import { findManagedCollectionSourceId, type ShopifyCollectionSource } from "@/lib/shopify/collection-membership";
import { ensureTranslationBinding } from "@/lib/shopify/translation-sync";

const SNAPSHOT_ID = "collections";

type ShopifyPresenceCollection = {
  id: string;
  title: string;
  handle: string;
  updatedAt: string;
  descriptionHtml?: string | null;
  seo?: { title: string | null; description: string | null } | null;
  sources?: ShopifyCollectionSource[];
};

function isPresenceDifference(value: unknown): value is CollectionPresenceDifference {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<CollectionPresenceDifference>;
  return typeof item.id === "string"
    && (item.kind === "SHOPIFY_ONLY" || item.kind === "SYNARAVA_ONLY")
    && (item.localProductId === null || typeof item.localProductId === "string")
    && (item.shopifyProductId === null || typeof item.shopifyProductId === "string")
    && typeof item.name === "string"
    && typeof item.handle === "string"
    && typeof item.localFingerprint === "string"
    && typeof item.shopifyFingerprint === "string"
    && typeof item.remoteMissing === "boolean";
}

function parsePresenceSnapshot(value: unknown): CollectionPresenceDifference[] {
  return Array.isArray(value) ? value.filter(isPresenceDifference) : [];
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

async function listRemoteCollectionIdentities(): Promise<RemoteCollectionIdentity[]> {
  const collections: RemoteCollectionIdentity[] = [];
  let cursor: string | null = null;
  do {
    const data: {
      collections: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: ShopifyPresenceCollection[];
      };
    } = await shopifyAdminRequest(
      `query SynaravaCollectionPresence($after: String) {
        collections(first: 100, after: $after, sortKey: ID) {
          pageInfo { hasNextPage endCursor }
          nodes { id title handle updatedAt }
        }
      }`,
      { after: cursor },
    );
    collections.push(...data.collections.nodes.map((collection) => ({
      id: collection.id,
      title: collection.title,
      handle: collection.handle,
      updatedAt: collection.updatedAt,
    })));
    cursor = data.collections.pageInfo.hasNextPage ? data.collections.pageInfo.endCursor : null;
  } while (cursor);
  return collections;
}

async function fetchShopifyCollection(collectionId: string): Promise<ShopifyPresenceCollection> {
  const data = await shopifyAdminRequest<{ collection: ShopifyPresenceCollection | null }>(
    `query SynaravaCollectionPresenceOne($id: ID!) {
      collection(id: $id) {
        id title handle updatedAt descriptionHtml
        seo { title description }
        sources { __typename id title ... on CollectionConditionsSource { targetType } }
      }
    }`,
    { id: collectionId },
  );
  if (!data.collection) {
    throw new ShopifyAdminError(`Shopify collection ${collectionId} was not found.`);
  }
  return data.collection;
}

/**
 * Pulls or links a Shopify collection into Synarava.
 * Identity-first (`shopifyCollectionId`), then unique handle/slug — same rule as product membership upsert.
 */
export async function pullShopifyCollection(shopifyCollectionId: string, localCollectionId?: string | null) {
  const remote = await fetchShopifyCollection(shopifyCollectionId);
  const shopifyManualSourceId = findManagedCollectionSourceId(remote.sources ?? []);
  const description = stripHtml(remote.descriptionHtml ?? "") || null;

  if (localCollectionId) {
    const updated = await db.collection.update({
      where: { id: localCollectionId },
      data: {
        shopifyCollectionId: remote.id,
        shopifyHandle: remote.handle,
        shopifyManualSourceId,
        lastSyncedAt: new Date(),
        name: remote.title,
        description,
        seoTitle: remote.seo?.title ?? undefined,
        seoDescription: remote.seo?.description ?? undefined,
      },
    });
    await ensureTranslationBinding({
      resourceType: "COLLECTION",
      entityId: updated.id,
      shopifyResourceId: remote.id,
    });
    return { collectionId: updated.id, shopifyCollectionId: remote.id };
  }

  const existingById = await db.collection.findUnique({ where: { shopifyCollectionId: remote.id } });
  if (existingById) {
    const updated = await db.collection.update({
      where: { id: existingById.id },
      data: {
        shopifyHandle: remote.handle,
        shopifyManualSourceId,
        lastSyncedAt: new Date(),
        name: remote.title,
        description,
        seoTitle: remote.seo?.title ?? undefined,
        seoDescription: remote.seo?.description ?? undefined,
      },
    });
    await ensureTranslationBinding({
      resourceType: "COLLECTION",
      entityId: updated.id,
      shopifyResourceId: remote.id,
    });
    return { collectionId: updated.id, shopifyCollectionId: remote.id };
  }

  const existingBySlug = await db.collection.findUnique({ where: { slug: remote.handle } });
  if (existingBySlug) {
    if (existingBySlug.shopifyCollectionId && existingBySlug.shopifyCollectionId !== remote.id) {
      throw new ShopifyAdminError(
        `Collection handle "${remote.handle}" is already linked to ${existingBySlug.shopifyCollectionId}; refusing to replace it with ${remote.id}.`,
      );
    }
    const updated = await db.collection.update({
      where: { id: existingBySlug.id },
      data: {
        shopifyCollectionId: remote.id,
        shopifyHandle: remote.handle,
        shopifyManualSourceId,
        lastSyncedAt: new Date(),
        name: remote.title,
        description,
        seoTitle: remote.seo?.title ?? undefined,
        seoDescription: remote.seo?.description ?? undefined,
      },
    });
    await ensureTranslationBinding({
      resourceType: "COLLECTION",
      entityId: updated.id,
      shopifyResourceId: remote.id,
    });
    return { collectionId: updated.id, shopifyCollectionId: remote.id };
  }

  const created = await db.collection.create({
    data: {
      slug: remote.handle,
      name: remote.title,
      description,
      seoTitle: remote.seo?.title ?? null,
      seoDescription: remote.seo?.description ?? null,
      shopifyCollectionId: remote.id,
      shopifyHandle: remote.handle,
      shopifyManualSourceId,
      lastSyncedAt: new Date(),
      status: "DRAFT",
      visibility: "PRIVATE",
    },
  });
  await ensureTranslationBinding({
    resourceType: "COLLECTION",
    entityId: created.id,
    shopifyResourceId: remote.id,
  });
  return { collectionId: created.id, shopifyCollectionId: remote.id };
}

/** Creates a Shopify collection from a local Synarava collection and stores the new identity. */
export async function pushCollectionToShopify(collectionId: string) {
  const collection = await db.collection.findUnique({ where: { id: collectionId } });
  if (!collection) throw new ShopifyAdminError("Collection was not found.");

  if (collection.shopifyCollectionId) {
    // Re-link / recreate when the remote was deleted.
    try {
      await fetchShopifyCollection(collection.shopifyCollectionId);
      await ensureTranslationBinding({
        resourceType: "COLLECTION",
        entityId: collection.id,
        shopifyResourceId: collection.shopifyCollectionId,
      });
      return { ok: true as const, shopifyCollectionId: collection.shopifyCollectionId };
    } catch {
      await db.$transaction([
        db.shopifyTranslationBinding.deleteMany({
          where: { resourceType: "COLLECTION", entityId: collection.id },
        }),
        db.collection.update({
          where: { id: collection.id },
          data: {
            shopifyCollectionId: null,
            shopifyHandle: null,
            shopifyManualSourceId: null,
            lastSyncedAt: null,
          },
        }),
      ]);
    }
  }

  const descriptionHtml = collection.description
    ? `<p>${collection.description.replace(/[<>&]/g, "")}</p>`
    : "";
  const result = await shopifyAdminRequest<{
    collectionCreate: {
      collection: { id: string; handle: string; sources: ShopifyCollectionSource[] } | null;
      userErrors: Array<{ field?: string[]; message: string }>;
    };
  }>(
    `mutation SynaravaCollectionCreate($collection: CollectionCreateInput!) {
      collectionCreate(collection: $collection) {
        collection {
          id handle
          sources { __typename id title ... on CollectionConditionsSource { targetType } }
        }
        userErrors { field message }
      }
    }`,
    {
      collection: {
        title: collection.name,
        handle: collection.slug,
        descriptionHtml,
        seo: {
          title: collection.seoTitle ?? undefined,
          description: collection.seoDescription ?? undefined,
        },
      },
    },
  );

  if (result.collectionCreate.userErrors.length > 0) {
    throw new ShopifyAdminError(result.collectionCreate.userErrors.map((error) => error.message).join("; "));
  }
  const created = result.collectionCreate.collection;
  if (!created) throw new ShopifyAdminError("Shopify did not return the created collection.");

  await db.collection.update({
    where: { id: collection.id },
    data: {
      shopifyCollectionId: created.id,
      shopifyHandle: created.handle,
      shopifyManualSourceId: findManagedCollectionSourceId(created.sources),
      lastSyncedAt: new Date(),
    },
  });
  await ensureTranslationBinding({
    resourceType: "COLLECTION",
    entityId: collection.id,
    shopifyResourceId: created.id,
  });
  return { ok: true as const, shopifyCollectionId: created.id };
}

export async function scanAndSaveCollectionPresence(runId: string | null): Promise<CollectionPresenceDifference[]> {
  const [localRows, remoteCollections] = await Promise.all([
    db.collection.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        shopifyCollectionId: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    listRemoteCollectionIdentities(),
  ]);
  const localCollections: LocalCollectionIdentity[] = localRows.map((collection) => ({
    ...collection,
    updatedAt: collection.updatedAt.toISOString(),
  }));
  const differences = classifyCollectionPresence(localCollections, remoteCollections);
  const checkedAt = new Date();
  const serialized = differences as unknown as Prisma.InputJsonValue;
  await db.shopifyCatalogPresenceSnapshot.upsert({
    where: { id: SNAPSHOT_ID },
    create: { id: SNAPSHOT_ID, runId, differences: serialized, checkedAt },
    update: { runId, differences: serialized, checkedAt },
  });
  return differences;
}

export async function getLatestCollectionPresenceDifferences(): Promise<CollectionPresenceDifference[]> {
  const snapshot = await db.shopifyCatalogPresenceSnapshot.findUnique({ where: { id: SNAPSHOT_ID } });
  return parsePresenceSnapshot(snapshot?.differences);
}

export async function getLatestCollectionPresenceCheckedAt(): Promise<string | null> {
  const snapshot = await db.shopifyCatalogPresenceSnapshot.findUnique({
    where: { id: SNAPSHOT_ID },
    select: { checkedAt: true },
  });
  return snapshot?.checkedAt.toISOString() ?? null;
}

export async function removeCollectionPresenceDifference(conflictId: string): Promise<void> {
  const snapshot = await db.shopifyCatalogPresenceSnapshot.findUnique({ where: { id: SNAPSHOT_ID } });
  if (!snapshot) return;
  const next = parsePresenceSnapshot(snapshot.differences).filter((item) => item.id !== conflictId);
  await db.shopifyCatalogPresenceSnapshot.update({
    where: { id: SNAPSHOT_ID },
    data: { differences: next as unknown as Prisma.InputJsonValue },
  });
}

export type CollectionPresenceApplyResult =
  | { ok: true; localCollectionId: string; message: string }
  | { ok: false; reason: "STALE" | "UNSUPPORTED" | "WRITE_FAILED"; message: string };

export async function applyCollectionPresenceDifference({
  difference,
  direction,
}: {
  difference: CollectionPresenceDifference;
  direction: "SHOPIFY_TO_SYNARAVA" | "SYNARAVA_TO_SHOPIFY";
}): Promise<CollectionPresenceApplyResult> {
  const expectedDirection = difference.kind === "SHOPIFY_ONLY" ? "SHOPIFY_TO_SYNARAVA" : "SYNARAVA_TO_SHOPIFY";
  if (direction !== expectedDirection) {
    return {
      ok: false,
      reason: "UNSUPPORTED",
      message: difference.kind === "SHOPIFY_ONLY"
        ? "This collection only exists in Shopify, so it must be pulled first."
        : "This collection only exists in Synarava, so it must be pushed first.",
    };
  }

  try {
    if (difference.kind === "SHOPIFY_ONLY") {
      if (!difference.shopifyProductId) {
        return { ok: false, reason: "STALE", message: "The Shopify collection is no longer available." };
      }
      const pulled = await pullShopifyCollection(difference.shopifyProductId, difference.localProductId);
      await removeCollectionPresenceDifference(difference.id);
      return { ok: true, localCollectionId: pulled.collectionId, message: "Collection pulled from Shopify." };
    }

    if (!difference.localProductId) {
      return { ok: false, reason: "STALE", message: "The Synarava collection is no longer available." };
    }

    const pushed = await pushCollectionToShopify(difference.localProductId);
    await removeCollectionPresenceDifference(difference.id);
    return { ok: true, localCollectionId: difference.localProductId, message: "Collection pushed to Shopify." };
  } catch (error) {
    return {
      ok: false,
      reason: "WRITE_FAILED",
      message: error instanceof Error ? error.message : "The collection could not be synchronized.",
    };
  }
}
