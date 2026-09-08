import "server-only";

import { db } from "@/lib/db";
import { shopifyAdminRequest, ShopifyAdminError } from "@/lib/shopify/admin";
import {
  buildCollectionMembershipSourceCreateInput,
  buildCollectionMembershipUpdateInput,
  findManagedCollectionSourceId,
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

async function fetchShopifyCollectionSources(collectionId: string) {
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
  if (!data.collection) {
    throw new ShopifyAdminError(`Shopify collection ${collectionId} was not found.`);
  }
  return data.collection.sources;
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

export async function addProductToShopifyCollection(collection: {
  id: string;
  shopifyCollectionId: string;
  shopifyManualSourceId: string | null;
}, productId: string) {
  let sourceId = findManagedCollectionSourceId(
    await fetchShopifyCollectionSources(collection.shopifyCollectionId),
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
    sourceId = findManagedCollectionSourceId(
      await fetchShopifyCollectionSources(collection.shopifyCollectionId),
    );
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
}

export async function removeProductFromShopifyCollection(collection: {
  shopifyCollectionId: string;
  shopifyManualSourceId: string;
}, productId: string) {
  await runShopifyCollectionUpdate(buildCollectionMembershipUpdateInput({
    collectionId: collection.shopifyCollectionId,
    sourceId: collection.shopifyManualSourceId,
    productId,
    action: "REMOVE",
  }));
}
