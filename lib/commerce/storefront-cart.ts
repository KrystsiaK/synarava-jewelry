import "server-only";

// Thin re-export over lib/shopify/cart, named for what pages/actions do
// ("the storefront cart") rather than how it's implemented. Shopify is the
// only commerce backend — this isn't a seam for a hypothetical alternate
// one, just a naming boundary between storefront code and Shopify-specific
// code.
import {
  isVariantStockAvailable,
  withShopifyInventoryAvailability,
} from "@/lib/commerce/variant-availability";
import { db } from "@/lib/db";
import {
  addShopifyMerchandiseLinesToCart,
  addShopifyProductToCart,
  getShopifyCartCount,
  getShopifyCartLineQuantity,
  getShopifyCartViewModel,
  getShopifyCheckoutUrl,
  removeShopifyCartItem,
  updateShopifyCartItemQuantity,
} from "@/lib/shopify/cart";
import {
  variantGidFromNumericId,
  type CartPermalinkLine,
} from "@/lib/shopify/cart-permalink";

export type MerchandiseImportResult = {
  added: number;
  skipped: number;
  adjusted: boolean;
  warnings: string[];
};

export async function getStorefrontCartViewModel() {
  return getShopifyCartViewModel();
}

export async function getStorefrontCartCount() {
  return getShopifyCartCount();
}

export async function getStorefrontCartLineQuantity(itemId: string) {
  return getShopifyCartLineQuantity(itemId);
}

export async function addStorefrontProductToCart(
  productSlug: string,
  quantity = 1,
  merchandiseId?: string,
) {
  // One visibility policy for every entry point (REV-08): the merchandiseId
  // branch used to check local status/visibility while the handle-only branch
  // didn't check anything, so a locally hidden/archived — or entirely local-only
  // — slug could still add a still-published Shopify product via that branch.
  const product = await db.product.findFirst({
    where: {
      slug: productSlug,
      OR: [
        { status: "ACTIVE", visibility: "PUBLIC" },
        { status: "UNLISTED", visibility: "UNLISTED" },
      ],
      ...(merchandiseId
        ? { variants: { some: { shopifyVariantId: merchandiseId, status: { in: ["ACTIVE", "UNLISTED"] } } } }
        : {}),
    },
    select: {
      shopifyHandle: true,
      shopifySnapshot: true,
      variants: {
        where: {
          shopifyVariantId: { not: null },
          status: { in: ["ACTIVE", "UNLISTED"] },
          ...(merchandiseId ? { shopifyVariantId: merchandiseId } : {}),
        },
        orderBy: [{ stockOnHand: "desc" }, { createdAt: "asc" }],
        select: {
          shopifyVariantId: true,
          status: true,
          stockOnHand: true,
          inventoryPolicy: true,
          tracked: true,
        },
      },
    },
  });
  if (!product) throw new Error("Product not available.");

  const stockOk = (variant: (typeof product.variants)[number]) =>
    isVariantStockAvailable(
      withShopifyInventoryAvailability(variant, product.shopifySnapshot),
    );

  // Visibility already limited to ACTIVE/UNLISTED; pick first with dual stock.
  const target = merchandiseId
    ? product.variants.find((variant) => variant.shopifyVariantId === merchandiseId)
    : product.variants.find(stockOk) ?? product.variants[0];
  if (!target?.shopifyVariantId) throw new Error("Product not available.");

  if (!stockOk(target)) {
    throw new Error("Product is out of stock.");
  }

  return addShopifyProductToCart(
    product.shopifyHandle || productSlug,
    quantity,
    merchandiseId ?? target.shopifyVariantId,
  );
}

export async function updateStorefrontCartItemQuantity(itemId: string, quantity: number) {
  return updateShopifyCartItemQuantity(itemId, quantity);
}

export async function removeStorefrontCartItem(itemId: string) {
  return removeShopifyCartItem(itemId);
}

export async function getStorefrontCheckoutUrl() {
  return getShopifyCheckoutUrl();
}

/**
 * Import Shopify cart-permalink lines after local visibility filtering.
 * Hidden/archived merchandise is skipped (not authorized by a numeric URL alone).
 */
export async function addStorefrontMerchandiseLinesToCart(
  lines: CartPermalinkLine[],
): Promise<MerchandiseImportResult> {
  if (lines.length === 0) {
    return { added: 0, skipped: 0, adjusted: false, warnings: [] };
  }

  const requestedGids = lines.map((line) => variantGidFromNumericId(line.variantId));
  const visible = await db.productVariant.findMany({
    where: {
      shopifyVariantId: { in: requestedGids },
      status: { in: ["ACTIVE", "UNLISTED"] },
      product: {
        OR: [
          { status: "ACTIVE", visibility: "PUBLIC" },
          { status: "UNLISTED", visibility: "UNLISTED" },
        ],
      },
    },
    select: { shopifyVariantId: true },
  });

  const visibleSet = new Set(
    visible
      .map((row) => row.shopifyVariantId)
      .filter((id): id is string => typeof id === "string"),
  );

  const eligible = lines.filter((line) =>
    visibleSet.has(variantGidFromNumericId(line.variantId)),
  );
  const skipped = lines.length - eligible.length;

  if (eligible.length === 0) {
    return { added: 0, skipped, adjusted: false, warnings: [] };
  }

  const mutation = await addShopifyMerchandiseLinesToCart(
    eligible.map((line) => ({
      merchandiseId: variantGidFromNumericId(line.variantId),
      quantity: line.quantity,
    })),
  );

  const cartLines = mutation.cart.lines.nodes;
  let adjusted = mutation.warnings.length > 0;
  for (const line of eligible) {
    const gid = variantGidFromNumericId(line.variantId);
    if (!cartLines.some((node) => node.merchandise.id === gid)) {
      adjusted = true;
    }
  }

  return {
    added: eligible.reduce((sum, line) => sum + line.quantity, 0),
    skipped,
    adjusted,
    warnings: mutation.warnings,
  };
}
