import "server-only";

import { db } from "@/lib/db";
import {
  applyCatalogPresenceDifference,
  scanAndSaveCatalogPresence,
} from "@/lib/shopify/catalog-presence-server";
import { pullShopifyProduct } from "@/lib/shopify/product-sync";
import { ensureTranslationBinding } from "@/lib/shopify/translation-sync";

export type CatalogPullSummary = {
  imported: number;
  refreshed: number;
  failed: number;
  errors: string[];
};

/**
 * Shopify → Synarava catch-up for the temporary sync-only catalog:
 * 1. Import products that exist only in Shopify
 * 2. Force-pull every linked local product so commerce projection matches Shopify
 *
 * Synarava-only editorial fields stay preserved by `savePulledProduct`.
 */
export async function pullCatalogFromShopify(): Promise<CatalogPullSummary> {
  const summary: CatalogPullSummary = {
    imported: 0,
    refreshed: 0,
    failed: 0,
    errors: [],
  };

  const presence = await scanAndSaveCatalogPresence(null);
  const importedShopifyIds = new Set<string>();
  for (const difference of presence) {
    if (difference.kind !== "SHOPIFY_ONLY") continue;
    try {
      const outcome = await applyCatalogPresenceDifference({
        difference,
        direction: "SHOPIFY_TO_SYNARAVA",
      });
      if (outcome.ok) {
        summary.imported += 1;
        if (difference.shopifyProductId) importedShopifyIds.add(difference.shopifyProductId);
      } else {
        summary.failed += 1;
        summary.errors.push(`${difference.name}: ${outcome.message}`);
      }
    } catch (error) {
      summary.failed += 1;
      summary.errors.push(
        `${difference.name}: ${error instanceof Error ? error.message : "Import failed."}`,
      );
    }
  }

  const linked = await db.product.findMany({
    where: { shopifyProductId: { not: null } },
    select: { id: true, name: true, shopifyProductId: true },
    orderBy: { updatedAt: "asc" },
  });

  for (const product of linked) {
    if (!product.shopifyProductId) continue;
    // Already force-pulled while importing Shopify-only presence rows.
    if (importedShopifyIds.has(product.shopifyProductId)) continue;
    try {
      await pullShopifyProduct(product.shopifyProductId, undefined, true);
      await ensureTranslationBinding({
        resourceType: "PRODUCT",
        entityId: product.id,
        shopifyResourceId: product.shopifyProductId,
      });
      summary.refreshed += 1;
    } catch (error) {
      summary.failed += 1;
      summary.errors.push(
        `${product.name}: ${error instanceof Error ? error.message : "Pull failed."}`,
      );
    }
  }

  return summary;
}
