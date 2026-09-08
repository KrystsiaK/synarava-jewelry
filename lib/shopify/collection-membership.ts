export const SHOPIFY_MANUAL_SOURCE_TITLE = "Synarava manual membership";

export type ShopifyCollectionSource = {
  id: string;
  __typename: string;
  title: string;
  targetType?: "PRODUCTS" | "VARIANTS";
};

export type ShopifyJob = { id: string; done: boolean };

export async function waitForShopifyJobCompletion(
  job: ShopifyJob | null,
  fetchJob: (id: string) => Promise<ShopifyJob | null>,
  waitIntervals = [250, 500, 1_000, 1_500, 2_000, 3_000],
  sleep: (waitMs: number) => Promise<void> = (waitMs) =>
    new Promise((resolve) => setTimeout(resolve, waitMs)),
) {
  if (!job || job.done) return;

  for (const waitMs of waitIntervals) {
    await sleep(waitMs);
    const current = await fetchJob(job.id);
    if (!current) throw new Error(`Shopify job ${job.id} was not found.`);
    if (current.done) return;
  }

  throw new Error(`Shopify job ${job.id} did not finish before the sync timeout.`);
}

export function findManagedCollectionSourceId(
  sources: ShopifyCollectionSource[],
  storedSourceId?: string | null,
) {
  const storedSource = storedSourceId
    ? sources.find((source) =>
        source.id === storedSourceId &&
        source.__typename === "CollectionConditionsSource" &&
        source.targetType === "PRODUCTS",
      )
    : null;
  if (storedSource) return storedSource.id;

  return sources.find((source) =>
    source.__typename === "CollectionConditionsSource" &&
    source.title === SHOPIFY_MANUAL_SOURCE_TITLE &&
    source.targetType === "PRODUCTS",
  )?.id ?? null;
}

type CollectionMembershipInput = {
  collectionId: string;
  productId: string;
};

export function buildCollectionMembershipSourceCreateInput({
  collectionId,
  productId,
}: CollectionMembershipInput) {
  return {
    id: collectionId,
    sourcesToCreate: [{
      source: {
        title: SHOPIFY_MANUAL_SOURCE_TITLE,
        targetType: "PRODUCTS" as const,
        inclusion: {
          matchType: "ANY" as const,
          selections: [{ productId }],
        },
      },
    }],
  };
}

export function buildCollectionMembershipUpdateInput({
  collectionId,
  sourceId,
  productId,
  action,
}: CollectionMembershipInput & {
  sourceId: string;
  action: "ADD" | "REMOVE";
}) {
  return {
    id: collectionId,
    sourcesToUpdate: [{
      condition: {
        id: sourceId,
        inclusion: action === "ADD"
          ? { selectionsToAdd: [{ productId }] }
          : { selectionsToRemove: [{ productId }] },
      },
    }],
  };
}

export function hasCollectionIdentityConflict(
  existingShopifyCollectionId: string | null,
  remoteShopifyCollectionId: string,
) {
  return Boolean(
    existingShopifyCollectionId &&
    existingShopifyCollectionId !== remoteShopifyCollectionId,
  );
}
