/** Pure taxonomy gaps used by the QA scan (and unit tests). */
export function productTaxonomyGaps(product: {
  shopifyCategoryId: string | null;
  tags: unknown[];
  collections: { collection: { isStorefrontDefault: boolean } }[];
}) {
  return {
    missingCategory: !product.shopifyCategoryId?.trim(),
    missingTags: product.tags.length === 0,
    // Featured / storefront-default membership is automatic and does not
    // satisfy the marketing collection the product editor assigns.
    missingCollection: !product.collections.some((item) => !item.collection.isStorefrontDefault),
  };
}
