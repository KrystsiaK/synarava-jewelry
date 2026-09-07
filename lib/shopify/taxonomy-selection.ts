const SHOPIFY_TAXONOMY_CATEGORY_GID = /^gid:\/\/shopify\/TaxonomyCategory\/[A-Za-z0-9-]+$/;

export type ShopifyTaxonomySelection = {
  id: string;
  name: string;
};

export type ShopifyTaxonomyCategory = {
  id: string;
  name: string;
  fullName: string;
};

export function parseShopifyTaxonomySelection(input: {
  id: string | null | undefined;
  name: string | null | undefined;
}): ShopifyTaxonomySelection | null {
  const id = input.id?.trim() ?? "";
  const name = input.name?.trim() ?? "";
  if (!id && !name) return null;

  if (!SHOPIFY_TAXONOMY_CATEGORY_GID.test(id) || !name || name.length > 240) {
    throw new Error("Choose a category from Shopify taxonomy results.");
  }

  return { id, name };
}

export function shopifyProductCategoryInput(id: string | null | undefined) {
  if (!id) return { category: null };
  if (!SHOPIFY_TAXONOMY_CATEGORY_GID.test(id)) {
    throw new Error("The saved Shopify product category is invalid.");
  }
  return { category: id };
}
