import "server-only";

import { ShopifyAdminError, shopifyAdminRequest } from "@/lib/shopify/admin";

type ShopifyPageInfo = { hasNextPage: boolean; endCursor: string | null };

export type ShopifyInventoryLevel = {
  location: { id: string };
  quantities: Array<{ name: string; quantity: number } | null>;
};

/**
 * The one Shopify-compatible stock contract: available quantity at the
 * configured location, or the first reported location when none is
 * configured. Used identically by the full product pull and the
 * inventory_levels/update webhook so a multi-location product doesn't
 * report a different stock depending on which sync path touched it last.
 */
export function selectStockOnHand(
  levels: Array<ShopifyInventoryLevel | null | undefined>,
  configuredLocationId?: string | null,
): number {
  const present = levels.filter((level): level is ShopifyInventoryLevel => Boolean(level?.location?.id));
  const selectedLevel = configuredLocationId
    ? present.find((level) => level.location.id === configuredLocationId)
    : present[0];
  // quantities entries can be null in live Admin responses
  return selectedLevel?.quantities.find((item) => item?.name === "available")?.quantity ?? 0;
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
    for (const node of data.inventoryItem.inventoryLevels.nodes) {
      if (!node?.location?.id) continue;
      levels.push(node);
    }
    const pageInfo = data.inventoryItem.inventoryLevels.pageInfo;
    if (pageInfo.hasNextPage && !pageInfo.endCursor) {
      throw new ShopifyAdminError(`Shopify omitted the inventory levels cursor for ${inventoryItemId}.`);
    }
    after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (after);
  return levels;
}
