/** Shared rules for product ↔ collection assignment in admin. */

export type CollectionSelectSource = {
  id: string;
  slug: string;
  name: string;
  isStorefrontDefault: boolean;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED" | string;
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC" | string;
};

export function isPublishedCollection(
  collection: Pick<CollectionSelectSource, "status" | "visibility">,
) {
  return collection.status === "ACTIVE" && collection.visibility === "PUBLIC";
}

export function collectionWorkflowLabel(
  collection: Pick<CollectionSelectSource, "status" | "visibility">,
): "PUBLISHED" | "DRAFT" | "ARCHIVED" {
  if (collection.status === "ARCHIVED") return "ARCHIVED";
  if (isPublishedCollection(collection)) return "PUBLISHED";
  return "DRAFT";
}

/** Option label for the product Collection select. */
export function collectionSelectOptionLabel(
  collection: Pick<CollectionSelectSource, "name" | "status" | "visibility">,
) {
  const state = collectionWorkflowLabel(collection);
  if (state === "PUBLISHED") return collection.name;
  if (state === "ARCHIVED") return `${collection.name} (Archived)`;
  return `${collection.name} (Draft)`;
}

/**
 * Collections offered on product create/edit:
 * - never storefront-default (Featured) — that membership is automatic
 * - published collections always
 * - draft collections always (prep before collection publish), labeled
 * - archived only when it is the product's current assignment (so edit
 *   does not silently clear a stale value)
 */
export function filterCollectionsForProductSelect<T extends CollectionSelectSource>(
  collections: T[],
  currentSlug = "",
): T[] {
  const current = currentSlug.trim();
  return collections.filter((collection) => {
    if (collection.isStorefrontDefault) return false;
    if (isPublishedCollection(collection)) return true;
    if (collection.status === "ARCHIVED") {
      return Boolean(current) && collection.slug === current;
    }
    return true;
  });
}

/** Block Published/Unlisted product when marketing collection is not live. */
export function liveProductRequiresPublishedCollectionMessage(
  collection: Pick<CollectionSelectSource, "name" | "status" | "visibility"> | null | undefined,
  isLive: boolean,
) {
  if (!isLive || !collection) return null;
  if (isPublishedCollection(collection)) return null;
  const state = collectionWorkflowLabel(collection).toLowerCase();
  return `“${collection.name}” is ${state}. Publish the collection before making this product live, or keep the product in Draft.`;
}

/**
 * True when a storefront-visible product has marketing membership, but none
 * of those collections are published. Used by QA scan after Shopify pull
 * (pull never fails — it links membership even when the local collection
 * is still Draft).
 */
export function productLiveInUnpublishedCollection(product: {
  status: string;
  collections: Array<{
    collection: {
      isStorefrontDefault: boolean;
      status: string;
      visibility: string;
    };
  }>;
}) {
  if (product.status !== "ACTIVE" && product.status !== "UNLISTED") return false;
  const marketing = product.collections.filter((item) => !item.collection.isStorefrontDefault);
  if (marketing.length === 0) return false;
  return marketing.every((item) => !isPublishedCollection(item.collection));
}
