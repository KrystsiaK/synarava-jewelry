import "server-only";

import { shopifyAdminRequest, ShopifyAdminError } from "@/lib/shopify/admin";
import { waitForShopifyJobCompletion, type ShopifyJob } from "@/lib/shopify/collection-membership";

type UserError = { field?: string[]; message: string };

function assertNoUserErrors(errors: UserError[]) {
  if (errors.length) {
    throw new ShopifyAdminError(errors.map((error) => error.message).join("; "));
  }
}

async function waitForJob(job: ShopifyJob | null) {
  await waitForShopifyJobCompletion(job, async (jobId) => {
    const data = await shopifyAdminRequest<{ job: ShopifyJob | null }>(
      `query SynaravaCollectionOrderJob($id: ID!) { job(id: $id) { id done } }`,
      { id: jobId },
    );
    return data.job;
  });
}

async function ensureManualCollectionOrder(collectionId: string) {
  const current = await shopifyAdminRequest<{
    collection: { id: string; sortOrder: string } | null;
  }>(
    `query SynaravaCollectionOrderMode($id: ID!) {
      collection(id: $id) { id sortOrder }
    }`,
    { id: collectionId },
  );
  if (!current.collection) throw new ShopifyAdminError("Shopify collection was not found.");
  if (current.collection.sortOrder === "MANUAL") return;

  const result = await shopifyAdminRequest<{
    collectionUpdate: { job: ShopifyJob | null; userErrors: UserError[] };
  }>(
    `mutation SynaravaEnableManualCollectionOrder($collection: CollectionUpdateInput!) {
      collectionUpdate(collection: $collection) {
        job { id done }
        userErrors { field message }
      }
    }`,
    { collection: { id: collectionId, sortOrder: "MANUAL" } },
  );
  assertNoUserErrors(result.collectionUpdate.userErrors);
  await waitForJob(result.collectionUpdate.job);
}

async function fetchShopifyCollectionOrder(collectionId: string) {
  type CollectionOrderPage = {
    collection: {
      products: {
        nodes: Array<{ id: string }>;
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } | null;
  };
  const ids: string[] = [];
  let after: string | null = null;

  do {
    const data: CollectionOrderPage = await shopifyAdminRequest<CollectionOrderPage>(
      `query SynaravaCollectionProductOrder($id: ID!, $after: String) {
        collection(id: $id) {
          products(first: 250, after: $after) {
            nodes { id }
            pageInfo { hasNextPage endCursor }
          }
        }
      }`,
      { id: collectionId, after },
    );
    if (!data.collection) throw new ShopifyAdminError("Shopify collection was not found.");
    ids.push(...data.collection.products.nodes.map((product) => product.id));
    after = data.collection.products.pageInfo.hasNextPage
      ? data.collection.products.pageInfo.endCursor
      : null;
  } while (after);

  return ids;
}

export async function reorderShopifyCollectionProduct(input: {
  collectionId: string;
  productId: string;
  newPosition: number;
}) {
  await ensureManualCollectionOrder(input.collectionId);
  const result = await shopifyAdminRequest<{
    collectionReorderProducts: { job: ShopifyJob | null; userErrors: UserError[] };
  }>(
    `mutation SynaravaReorderCollectionProduct($id: ID!, $moves: [MoveInput!]!) {
      collectionReorderProducts(id: $id, moves: $moves) {
        job { id done }
        userErrors { field message }
      }
    }`,
    {
      id: input.collectionId,
      moves: [{ id: input.productId, newPosition: String(Math.max(0, Math.trunc(input.newPosition))) }],
    },
  );
  assertNoUserErrors(result.collectionReorderProducts.userErrors);
  await waitForJob(result.collectionReorderProducts.job);
  return fetchShopifyCollectionOrder(input.collectionId);
}
