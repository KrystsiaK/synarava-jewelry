import "server-only";

import { ShopifyAdminError, shopifyAdminRequest } from "@/lib/shopify/admin";

type ShopifyPageInfo = { hasNextPage: boolean; endCursor: string | null };

export type ShopifyInventoryLevel = {
  location: { id: string };
  quantities: Array<{ name: string; quantity: number }>;
};

/**
 * The one Shopify-compatible stock contract: available quantity at the
 * configured location, or the first reported location when none is
 * configured. Used identically by the full product pull and the
 * inventory_levels/update webhook so a multi-location product doesn't
 * report a different stock depending on which sync path touched it last.
 */
export function selectStockOnHand(levels: ShopifyInventoryLevel[], configuredLocationId?: string | null): number {
  const selectedLevel = configuredLocationId
    ? levels.find((level) => level.location.id === configuredLocationId)
    : levels[0];
  return selectedLevel?.quantities.find((item) => item.name === "available")?.quantity ?? 0;
}

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
