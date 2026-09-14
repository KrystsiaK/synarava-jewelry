import "server-only";

import { shopifyAdminRequest, ShopifyAdminError } from "@/lib/shopify/admin";

const WISHLIST_NAMESPACE = "synarava";
const WISHLIST_KEY = "wishlist";

function parseWishlistValue(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Shopify product GIDs saved on the customer's `synarava.wishlist` metafield. */
export async function getShopifyCustomerWishlistIds(customerId: string): Promise<string[]> {
  const data = await shopifyAdminRequest<{
    customer: { metafield: { value: string } | null } | null;
  }>(
    `query SynaravaCustomerWishlist($id: ID!, $namespace: String!, $key: String!) {
      customer(id: $id) {
        metafield(namespace: $namespace, key: $key) { value }
      }
    }`,
    { id: customerId, namespace: WISHLIST_NAMESPACE, key: WISHLIST_KEY },
  );
  return parseWishlistValue(data.customer?.metafield?.value);
}

async function setShopifyCustomerWishlistIds(customerId: string, productIds: string[]) {
  const result = await shopifyAdminRequest<{
    metafieldsSet: { userErrors: Array<{ message: string }> };
  }>(
    `mutation SynaravaSetCustomerWishlist($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) { userErrors { message } }
    }`,
    {
      metafields: [{
        ownerId: customerId,
        namespace: WISHLIST_NAMESPACE,
        key: WISHLIST_KEY,
        type: "list.product_reference",
        value: JSON.stringify(productIds),
      }],
    },
  );
  if (result.metafieldsSet.userErrors.length) {
    throw new ShopifyAdminError(result.metafieldsSet.userErrors.map((error) => error.message).join("; "));
  }
}

/** Adds or removes `productId` from the customer's wishlist and returns the new state. */
export async function toggleShopifyCustomerWishlist(customerId: string, productId: string) {
  const current = await getShopifyCustomerWishlistIds(customerId);
  const isSaved = current.includes(productId);
  const next = isSaved ? current.filter((id) => id !== productId) : [...current, productId];
  await setShopifyCustomerWishlistIds(customerId, next);
  return { isSaved: !isSaved, wishlist: next };
}
