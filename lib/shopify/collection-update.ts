import "server-only";

import { shopifyAdminRequest, ShopifyAdminError } from "@/lib/shopify/admin";
import {
  waitForShopifyJobCompletion,
  type ShopifyJob,
} from "@/lib/shopify/collection-membership";

type UserError = { field?: string[]; message: string };

export type ShopifyCollectionUpdateResult = {
  id: string;
  handle?: string;
  updatedAt?: string;
};

/** Sole inline collectionUpdate mutation — Admin API 2026-07 `collection:` argument. */
const COLLECTION_UPDATE_MUTATION = `mutation SynaravaCollectionUpdate($collection: CollectionUpdateInput!) {
  collectionUpdate(collection: $collection) {
    collection { id handle updatedAt }
    job { id done }
    userErrors { field message }
  }
}`;

/**
 * Single Admin API 2026-07 entry for collectionUpdate.
 * Uses `collection: CollectionUpdateInput!` (not deprecated `input: CollectionInput!`).
 * Surfaces userErrors as ShopifyAdminError; waits when Shopify returns a job.
 * @see https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/collectionUpdate
 * @see https://shopify.dev/docs/api/admin-graphql/2026-07/input-objects/CollectionUpdateInput
 */
export async function runShopifyCollectionUpdate(
  collection: Record<string, unknown>,
  options?: { requireCollection?: boolean },
): Promise<ShopifyCollectionUpdateResult | null> {
  const data = await shopifyAdminRequest<{
    collectionUpdate: {
      collection: ShopifyCollectionUpdateResult | null;
      job: ShopifyJob | null;
      userErrors: UserError[];
    };
  }>(COLLECTION_UPDATE_MUTATION, { collection });

  const errors = data.collectionUpdate.userErrors;
  if (errors.length > 0) {
    throw new ShopifyAdminError(errors.map((error) => error.message).join("; "));
  }

  // Source deltas / sortOrder can queue a job — do not treat the mutation as done early.
  // https://shopify.dev/docs/api/admin-graphql/2026-07/queries/job
  await waitForShopifyJobCompletion(data.collectionUpdate.job, async (jobId) => {
    const jobData = await shopifyAdminRequest<{ job: ShopifyJob | null }>(
      `query SynaravaCollectionUpdateJob($id: ID!) { job(id: $id) { id done } }`,
      { id: jobId },
    );
    return jobData.job;
  });

  const updated = data.collectionUpdate.collection;
  if (options?.requireCollection && !updated) {
    throw new ShopifyAdminError("Shopify did not return the updated collection.");
  }
  return updated;
}
