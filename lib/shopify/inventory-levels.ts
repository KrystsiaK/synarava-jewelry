import "server-only";

import { ShopifyAdminError, shopifyAdminRequest } from "@/lib/shopify/admin";

type ShopifyPageInfo = { hasNextPage: boolean; endCursor: string | null };

export type ShopifyInventoryLevel = {
  location: { id: string };
  quantities: Array<{ name: string; quantity: number }>;
};

export async function fetchInventoryLevels(inventoryItemId: string): Promise<ShopifyInventoryLevel[]> {
  const levels: ShopifyInventoryLevel[] = [];
  let after: string | null = null;
  do {
    const data: {
      inventoryItem: {
        inventoryLevels: { pageInfo: ShopifyPageInfo; nodes: ShopifyInventoryLevel[] };
      } | null;
    } = await shopifyAdminRequest(
      `query SynaravaInventoryLevels($id: ID!, $after: String) {
        inventoryItem(id: $id) {
          inventoryLevels(first: 100, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes {
              location { id }
              quantities(names: ["available", "committed", "on_hand", "reserved", "damaged", "quality_control", "safety_stock"]) { name quantity }
            }
          }
        }
      }`,
      { id: inventoryItemId, after },
    );
    if (!data.inventoryItem) break;
    levels.push(...data.inventoryItem.inventoryLevels.nodes);
    const pageInfo = data.inventoryItem.inventoryLevels.pageInfo;
    if (pageInfo.hasNextPage && !pageInfo.endCursor) {
      throw new ShopifyAdminError(`Shopify omitted the inventory levels cursor for ${inventoryItemId}.`);
    }
    after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (after);
  return levels;
}
