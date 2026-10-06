import "server-only";

import { db } from "@/lib/db";
import { shopifyAdminRequest, ShopifyAdminError } from "@/lib/shopify/admin";
import {
  buildCollectionMembershipSourceCreateInput,
  buildCollectionMembershipUpdateInput,
  findManagedCollectionSourceId,
  formatCollectionMembershipError,
  isEmptyConditionSourceError,
  isMissingShopifyCollectionError,
  waitForShopifyJobCompletion,
  type ShopifyCollectionSource,
  type ShopifyJob,
} from "@/lib/shopify/collection-membership";

type UserError = { field?: string[]; message: string };

function assertNoUserErrors(errors: UserError[]) {
  if (errors.length) {
    throw new ShopifyAdminError(errors.map((error) => error.message).join("; "));
  }
}

function membershipFailure(
  action: "ADD" | "REMOVE",
  collectionId: string,
  cause: unknown,
): ShopifyAdminError {
  const message = cause instanceof Error ? cause.message : String(cause);
  return new ShopifyAdminError(formatCollectionMembershipError({
    action,
    collectionId,
    cause: message,
  }));
}

type LoadedCollectionSources =
  | { status: "missing" }
  | { status: "ok"; sources: ShopifyCollectionSource[] };

/**
 * Loads live sources for a collection GID. Deleted collections resolve to
 * `{ status: "missing" }` whether Shopify returns a null node or an error —
 * callers must not treat that as a hard Push failure.
 */
async function loadShopifyCollectionSources(collectionId: string): Promise<LoadedCollectionSources> {
  try {
    const data = await shopifyAdminRequest<{
      collection: { sources: ShopifyCollectionSource[] } | null;
    }>(
      `query SynaravaCollectionSources($id: ID!) {
      collection(id: $id) {
        sources {
          __typename id title
          ... on CollectionConditionsSource { targetType }
        }
      }
    }`,
      { id: collectionId },
    );
    if (!data.collection) return { status: "missing" };
    return { status: "ok", sources: data.collection.sources };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isMissingShopifyCollectionError(message)) return { status: "missing" };
    throw error;
  }
}

/**
 * Drop stale Shopify identity + optional product membership when a remote
 * collection GID no longer exists. Keeps the local Collection row for editorial
 * use; only the commerce link is cleared.
 */
export async function forgetMissingShopifyCollection(
  shopifyCollectionId: string,
  productId?: string,
) {
  const row = await db.collection.findUnique({
    where: { shopifyCollectionId },
    select: { id: true },
  });
  if (!row) return;

  if (productId) {
    await db.productCollection.deleteMany({
      where: { productId, collectionId: row.id },
    });
  }

  await db.collection.update({
    where: { id: row.id },
    data: {
      shopifyCollectionId: null,
      shopifyManualSourceId: null,
      syncStatus: "UNLINKED",
      syncError: null,
    },
  });
}

// Shopify 2026-07 replaces collectionAddProducts/collectionRemoveProducts
// with source deltas on collectionUpdate.
// Source: https://shopify.dev/docs/apps/build/product-merchandising/products-and-collections/migrate-to-flexible-collections#step-5-replace-collectionaddproducts-and-collectionremoveproducts
async function runShopifyCollectionUpdate(input: Record<string, unknown>) {
  const data = await shopifyAdminRequest<{
    collectionUpdate: { job: ShopifyJob | null; userErrors: UserError[] };
  }>(
    `mutation SynaravaCollectionMembership($collection: CollectionUpdateInput!) {
      collectionUpdate(collection: $collection) {
        job { id done }
        userErrors { field message }
      }
    }`,
    { collection: input },
  );
  assertNoUserErrors(data.collectionUpdate.userErrors);

  // A collectionUpdate can be queued; do not mark the product synchronized
  // until Shopify reports the returned job as done.
  // Source: https://shopify.dev/docs/api/admin-graphql/2026-07/queries/job
  await waitForShopifyJobCompletion(data.collectionUpdate.job, async (jobId) => {
    const jobData = await shopifyAdminRequest<{ job: ShopifyJob | null }>(
      `query SynaravaJob($id: ID!) { job(id: $id) { id done } }`,
      { id: jobId },
    );
    return jobData.job;
  });
}

/**
 * Legacy stopgap when `selectionsToRemove` cannot empty a condition source.
 * Leaves an empty source behind (Shopify-supported for collection-scoped sources).
 * @see https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/collectionRemoveProducts
 */
async function runCollectionRemoveProducts(collectionId: string, productId: string) {
  const data = await shopifyAdminRequest<{
    collectionRemoveProducts: { job: ShopifyJob | null; userErrors: UserError[] };
  }>(
    `mutation SynaravaCollectionRemoveProducts($id: ID!, $productIds: [ID!]!) {
      collectionRemoveProducts(id: $id, productIds: $productIds) {
        job { id done }
        userErrors { field message }
      }
    }`,
    { id: collectionId, productIds: [productId] },
  );
  assertNoUserErrors(data.collectionRemoveProducts.userErrors);
  await waitForShopifyJobCompletion(data.collectionRemoveProducts.job, async (jobId) => {
    const jobData = await shopifyAdminRequest<{ job: ShopifyJob | null }>(
      `query SynaravaJob($id: ID!) { job(id: $id) { id done } }`,
      { id: jobId },
    );
    return jobData.job;
  });
}

export async function addProductToShopifyCollection(collection: {
  id: string;
  shopifyCollectionId: string;
  shopifyManualSourceId: string | null;
}, productId: string) {
  try {
    const loaded = await loadShopifyCollectionSources(collection.shopifyCollectionId);
    if (loaded.status === "missing") {
      // Desired membership points at a deleted Shopify collection — drop the
      // stale link instead of failing the whole product Push.
      await forgetMissingShopifyCollection(collection.shopifyCollectionId, productId);
      return;
    }

    let sourceId = findManagedCollectionSourceId(
      loaded.sources,
      collection.shopifyManualSourceId,
    );

    if (sourceId) {
      await runShopifyCollectionUpdate(buildCollectionMembershipUpdateInput({
        collectionId: collection.shopifyCollectionId,
        sourceId,
        productId,
        action: "ADD",
      }));
    } else {
      await runShopifyCollectionUpdate(buildCollectionMembershipSourceCreateInput({
        collectionId: collection.shopifyCollectionId,
        productId,
      }));
      const refreshed = await loadShopifyCollectionSources(collection.shopifyCollectionId);
      if (refreshed.status === "missing") {
        await forgetMissingShopifyCollection(collection.shopifyCollectionId, productId);
        return;
      }
      sourceId = findManagedCollectionSourceId(refreshed.sources);
      if (!sourceId) {
        throw new ShopifyAdminError(
          `Shopify did not return the Synarava membership source for collection ${collection.shopifyCollectionId}.`,
        );
      }
    }

    if (sourceId !== collection.shopifyManualSourceId) {
      await db.collection.update({
        where: { id: collection.id },
        data: { shopifyManualSourceId: sourceId },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isMissingShopifyCollectionError(message)) {
      await forgetMissingShopifyCollection(collection.shopifyCollectionId, productId);
      return;
    }
    throw membershipFailure("ADD", collection.shopifyCollectionId, error);
  }
}

export async function removeProductFromShopifyCollection(collection: {
  shopifyCollectionId: string;
  shopifyManualSourceId: string;
}, productId: string) {
  try {
    const loaded = await loadShopifyCollectionSources(collection.shopifyCollectionId);
    if (loaded.status === "missing") {
      await forgetMissingShopifyCollection(collection.shopifyCollectionId, productId);
      return;
    }

    const sourceId = findManagedCollectionSourceId(loaded.sources, collection.shopifyManualSourceId);
    // Missing managed source already satisfies removal. Never use another
    // merchant source merely because the remembered id became stale.
    if (!sourceId) return;

    try {
      await runShopifyCollectionUpdate(buildCollectionMembershipUpdateInput({
        collectionId: collection.shopifyCollectionId,
        sourceId,
        productId,
        action: "REMOVE",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isMissingShopifyCollectionError(message)) {
        await forgetMissingShopifyCollection(collection.shopifyCollectionId, productId);
        return;
      }
      if (!isEmptyConditionSourceError(message)) throw error;
      if (loaded.sources.length > 1) {
        // The rejected delta would leave this source empty. Remove only that
        // source; other collection sources remain. Legacy collectionRemoveProducts
        // cannot see modern multi-source collections.
        // https://shopify.dev/docs/api/admin-graphql/2026-07/input-objects/CollectionUpdateInput
        await runShopifyCollectionUpdate({
          id: collection.shopifyCollectionId,
          sourcesToDelete: [sourceId],
        });
      } else {
        // Shopify still rejects deleting the final source. Its supported
        // collection-scoped stopgap preserves one empty source.
        await runCollectionRemoveProducts(collection.shopifyCollectionId, productId);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isMissingShopifyCollectionError(message)) {
      await forgetMissingShopifyCollection(collection.shopifyCollectionId, productId);
      return;
    }
    throw membershipFailure("REMOVE", collection.shopifyCollectionId, error);
  }
}
