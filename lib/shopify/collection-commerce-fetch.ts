import "server-only";

import { shopifyAdminRequest } from "@/lib/shopify/admin";
import { collectionWindowFromShopifyRemote } from "@/lib/shopify/collection-commerce-projection";

type ShopifyCollectionNode = {
  id: string;
  title: string;
  handle: string;
  descriptionHtml?: string | null;
  seo?: { title: string | null; description: string | null } | null;
};

/**
 * Paginated Shopify collections → commerce windows (V1 source fields).
 */
export async function listShopifyCollectionWindowsForCommerceStore(
  onProgress?: (info: { page: number; fetched: number }) => void,
): Promise<Array<{ id: string; window: unknown }>> {
  const out: Array<{ id: string; window: unknown }> = [];
  let cursor: string | null = null;
  let page = 0;
  do {
    page += 1;
    const data: {
      collections: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: ShopifyCollectionNode[];
      };
    } = await shopifyAdminRequest(
      `query SynaravaCollectionCommerceWindows($after: String) {
        collections(first: 100, after: $after, sortKey: ID) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id title handle descriptionHtml
            seo { title description }
          }
        }
      }`,
      { after: cursor },
    );
    for (const node of data.collections.nodes) {
      out.push({ id: node.id, window: collectionWindowFromShopifyRemote(node) });
    }
    onProgress?.({ page, fetched: out.length });
    cursor = data.collections.pageInfo.hasNextPage ? data.collections.pageInfo.endCursor : null;
  } while (cursor);
  return out;
}
