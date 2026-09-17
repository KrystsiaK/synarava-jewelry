import "server-only";

import { shopifyAdminRequest, ShopifyAdminError } from "@/lib/shopify/admin";

const WISHLIST_NAMESPACE = "synarava";
const WISHLIST_KEY = "wishlist";
// Shopify: https://shopify.dev/docs/api/admin-graphql/unstable/mutations/metafieldsSet
const MAX_WISHLIST_CONFLICT_RETRIES = 5;

function parseWishlistValue(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

async function readShopifyCustomerWishlist(customerId: string): Promise<{ ids: string[]; digest: string | null }> {
  const data = await shopifyAdminRequest<{
    customer: { metafield: { value: string; compareDigest: string } | null } | null;
  }>(
    `query SynaravaCustomerWishlist($id: ID!, $namespace: String!, $key: String!) {
      customer(id: $id) {
        metafield(namespace: $namespace, key: $key) { value compareDigest }
      }
    }`,
    { id: customerId, namespace: WISHLIST_NAMESPACE, key: WISHLIST_KEY },
  );
  return {
    ids: parseWishlistValue(data.customer?.metafield?.value),
    digest: data.customer?.metafield?.compareDigest ?? null,
  };
}

/** Shopify product GIDs saved on the customer's `synarava.wishlist` metafield. */
export async function getShopifyCustomerWishlistIds(customerId: string): Promise<string[]> {
  return (await readShopifyCustomerWishlist(customerId)).ids;
}

class WishlistConflictError extends Error {}

// compareDigest makes this a compare-and-set: Shopify only applies the write if
// the metafield still matches the digest read just before, and reports a
// STALE_OBJECT userError otherwise instead of silently overwriting a concurrent
// change (REV-15).
async function setShopifyCustomerWishlistIds(customerId: string, productIds: string[], compareDigest: string | null) {
  const result = await shopifyAdminRequest<{
    metafieldsSet: { userErrors: Array<{ message: string; code?: string | null }> };
  }>(
    `mutation SynaravaSetCustomerWishlist($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) { userErrors { message code } }
    }`,
    {
      metafields: [{
        ownerId: customerId,
        namespace: WISHLIST_NAMESPACE,
        key: WISHLIST_KEY,
        type: "list.product_reference",
        value: JSON.stringify(productIds),
        compareDigest,
      }],
    },
  );
  const { userErrors } = result.metafieldsSet;
  if (userErrors.length) {
    if (userErrors.some((error) => error.code === "STALE_OBJECT")) {
      throw new WishlistConflictError(userErrors.map((error) => error.message).join("; "));
    }
    throw new ShopifyAdminError(userErrors.map((error) => error.message).join("; "));
  }
}

/**
 * Adds or removes `productId` from the customer's wishlist and returns the
 * new state. Desired-state (recompute from a fresh read every attempt) plus
 * compareDigest retry rather than a blind read-modify-write, so two
 * concurrent toggles for different products both survive instead of one
 * clobbering the other's write.
 */
export async function toggleShopifyCustomerWishlist(customerId: string, productId: string) {
  for (let attempt = 0; attempt < MAX_WISHLIST_CONFLICT_RETRIES; attempt++) {
    const { ids: current, digest } = await readShopifyCustomerWishlist(customerId);
    const isSaved = current.includes(productId);
    const next = isSaved ? current.filter((id) => id !== productId) : [...current, productId];
    try {
      await setShopifyCustomerWishlistIds(customerId, next, digest);
      return { isSaved: !isSaved, wishlist: next };
    } catch (error) {
      if (!(error instanceof WishlistConflictError)) throw error;
    }
  }
  throw new ShopifyAdminError("Couldn't update the wishlist after several conflicting changes. Please try again.");
}
