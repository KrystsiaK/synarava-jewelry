import "server-only";

import { cookies } from "next/headers";

import { getShopifyBuyerIp } from "@/lib/shopify/request-context";
import { shopifyStorefrontRequest } from "@/lib/shopify/storefront";
import { formatCurrency, shopifyLanguage } from "@/lib/i18n/format";
import { getRequestLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/locales";

export const SHOPIFY_CART_COOKIE = "synarava-shopify-cart";
const CART_MAX_AGE = 60 * 60 * 24 * 30;

type Money = {
  amount: string;
  currencyCode: string;
};

type ShopifyImage = {
  url: string;
  altText: string | null;
};

type ShopifyCartLine = {
  id: string;
  quantity: number;
  cost: { totalAmount: Money };
  merchandise: {
    id: string;
    sku: string | null;
    title: string;
    price: Money;
    image: ShopifyImage | null;
    quantityAvailable: number | null;
    currentlyNotInStock: boolean;
    product: {
      handle: string;
      title: string;
      featuredImage: ShopifyImage | null;
    };
  };
};

type ShopifyCart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { subtotalAmount: Money };
  lines: { nodes: ShopifyCartLine[] };
};

type CartUserError = {
  field?: string[] | null;
  message: string;
  code?: string | null;
};

type CartMutationPayload = {
  cart: ShopifyCart | null;
  userErrors: CartUserError[];
  warnings?: Array<{ message: string }>;
};

const CART_FRAGMENT = `#graphql
  fragment SynaravaCart on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      subtotalAmount { amount currencyCode }
    }
    lines(first: 100) {
      nodes {
        id
        quantity
        cost { totalAmount { amount currencyCode } }
        merchandise {
          ... on ProductVariant {
            id
            sku
            title
            price { amount currencyCode }
            image { url altText }
            quantityAvailable
            currentlyNotInStock
            product {
              handle
              title
              featuredImage { url altText }
            }
          }
        }
      }
    }
  }
`;

function moneyToCents(money: Money) {
  const amount = Number.parseFloat(money.amount);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function formatMoney(money: Money, locale: Locale) {
  return formatCurrency(Number.parseFloat(money.amount), money.currencyCode, locale);
}

function emptyCartViewModel(locale: Locale) {
  return {
    id: null,
    items: [],
    itemCount: 0,
    subtotalCents: 0,
    subtotal: formatCurrency(0, "EUR", locale),
    currency: "EUR",
    checkoutUrl: null,
  };
}

function assertCartMutation(payload: CartMutationPayload) {
  if (payload.userErrors.length) {
    throw new Error(payload.userErrors.map((error) => error.message).join("; "));
  }
  if (!payload.cart) {
    throw new Error("Shopify did not return a cart.");
  }
  return payload.cart;
}

async function getCartId() {
  return (await cookies()).get(SHOPIFY_CART_COOKIE)?.value ?? null;
}

async function rememberCart(cartId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SHOPIFY_CART_COOKIE, cartId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_MAX_AGE,
  });
}

async function loadShopifyCart(cartId: string, buyerIp: string | null) {
  const data = await shopifyStorefrontRequest<{ cart: ShopifyCart | null }>(
    `#graphql
      ${CART_FRAGMENT}
      query SynaravaCartQuery($cartId: ID!) {
        cart(id: $cartId) { ...SynaravaCart }
      }
    `,
    { cartId },
    { buyerIp },
  );
  return data.cart;
}

async function resolveMerchandiseId(productHandle: string, buyerIp: string | null) {
  const data = await shopifyStorefrontRequest<{
    product: {
      variants: { nodes: Array<{ id: string; availableForSale: boolean }> };
    } | null;
  }>(
    `#graphql
      query SynaravaProductMerchandise($handle: String!) {
        product(handle: $handle) {
          variants(first: 20) {
            nodes { id availableForSale }
          }
        }
      }
    `,
    { handle: productHandle },
    { buyerIp },
  );

  const variant = data.product?.variants.nodes.find((node) => node.availableForSale);
  if (!variant) {
    throw new Error("This piece is not currently available in Shopify.");
  }
  return variant.id;
}

async function createShopifyCart(
  merchandiseId: string,
  quantity: number,
  buyerIp: string | null,
) {
  const data = await shopifyStorefrontRequest<{ cartCreate: CartMutationPayload }>(
    `#graphql
      ${CART_FRAGMENT}
      mutation SynaravaCartCreate($input: CartInput!) {
        cartCreate(input: $input) {
          cart { ...SynaravaCart }
          userErrors { field message code }
          warnings { message }
        }
      }
    `,
    { input: { lines: [{ merchandiseId, quantity }] } },
    { buyerIp },
  );
  const cart = assertCartMutation(data.cartCreate);
  await rememberCart(cart.id);
  return cart;
}

export async function getShopifyCartViewModel() {
  const locale = await getRequestLocale();
  const cartId = await getCartId();
  if (!cartId) return emptyCartViewModel(locale);

  const buyerIp = await getShopifyBuyerIp();
  const cart = await loadShopifyCart(cartId, buyerIp);
  if (!cart) return emptyCartViewModel(locale);

  const items = cart.lines.nodes.map((line) => {
    const variantTitle =
      line.merchandise.title && line.merchandise.title !== "Default Title"
        ? line.merchandise.title
        : "";
    const image = line.merchandise.image ?? line.merchandise.product.featuredImage;

    return {
      id: line.id,
      merchandiseId: line.merchandise.id,
      sku: line.merchandise.sku,
      quantity: line.quantity,
      slug: line.merchandise.product.handle,
      title: line.merchandise.product.title,
      imageUrl: image?.url ?? "",
      materialLine: variantTitle,
      maxQuantity: line.merchandise.currentlyNotInStock
        ? null
        : line.merchandise.quantityAvailable,
      unitCents: moneyToCents(line.merchandise.price),
      totalCents: moneyToCents(line.cost.totalAmount),
      price: formatMoney(line.merchandise.price, locale),
      total: formatMoney(line.cost.totalAmount, locale),
    };
  });

  return {
    id: cart.id,
    items,
    itemCount: cart.totalQuantity,
    subtotalCents: moneyToCents(cart.cost.subtotalAmount),
    subtotal: formatMoney(cart.cost.subtotalAmount, locale),
    currency: cart.cost.subtotalAmount.currencyCode,
    checkoutUrl: cart.checkoutUrl,
  };
}

export async function getShopifyCartCount() {
  const cartId = await getCartId();
  if (!cartId) return 0;

  const data = await shopifyStorefrontRequest<{
    cart: { totalQuantity: number } | null;
  }>(
    `#graphql
      query SynaravaCartCount($cartId: ID!) {
        cart(id: $cartId) { totalQuantity }
      }
    `,
    { cartId },
    { buyerIp: await getShopifyBuyerIp() },
  );
  return data.cart?.totalQuantity ?? 0;
}

export async function addShopifyProductToCart(
  productHandle: string,
  quantity = 1,
  merchandiseId?: string,
) {
  const buyerIp = await getShopifyBuyerIp();
  const resolvedMerchandiseId =
    merchandiseId || (await resolveMerchandiseId(productHandle, buyerIp));
  const cartId = await getCartId();

  if (!cartId || !(await loadShopifyCart(cartId, buyerIp))) {
    return createShopifyCart(resolvedMerchandiseId, quantity, buyerIp);
  }

  const data = await shopifyStorefrontRequest<{ cartLinesAdd: CartMutationPayload }>(
    `#graphql
      ${CART_FRAGMENT}
      mutation SynaravaCartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) {
          cart { ...SynaravaCart }
          userErrors { field message code }
          warnings { message }
        }
      }
    `,
    { cartId, lines: [{ merchandiseId: resolvedMerchandiseId, quantity }] },
    { buyerIp },
  );
  return assertCartMutation(data.cartLinesAdd);
}

export async function updateShopifyCartItemQuantity(lineId: string, quantity: number) {
  const cartId = await getCartId();
  if (!cartId) return;
  if (quantity <= 0) return removeShopifyCartItem(lineId);

  const buyerIp = await getShopifyBuyerIp();
  const data = await shopifyStorefrontRequest<{ cartLinesUpdate: CartMutationPayload }>(
    `#graphql
      ${CART_FRAGMENT}
      mutation SynaravaCartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
        cartLinesUpdate(cartId: $cartId, lines: $lines) {
          cart { ...SynaravaCart }
          userErrors { field message code }
          warnings { message }
        }
      }
    `,
    { cartId, lines: [{ id: lineId, quantity }] },
    { buyerIp },
  );
  assertCartMutation(data.cartLinesUpdate);
}

export async function removeShopifyCartItem(lineId: string) {
  const cartId = await getCartId();
  if (!cartId) return;

  const buyerIp = await getShopifyBuyerIp();
  const data = await shopifyStorefrontRequest<{ cartLinesRemove: CartMutationPayload }>(
    `#graphql
      ${CART_FRAGMENT}
      mutation SynaravaCartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
        cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
          cart { ...SynaravaCart }
          userErrors { field message code }
          warnings { message }
        }
      }
    `,
    { cartId, lineIds: [lineId] },
    { buyerIp },
  );
  assertCartMutation(data.cartLinesRemove);
}

export async function getShopifyCheckoutUrl() {
  const cartId = await getCartId();
  if (!cartId) return null;
  const locale = await getRequestLocale();
  const language = shopifyLanguage(locale);

  const data = await shopifyStorefrontRequest<{
    cart: { checkoutUrl: string } | null;
  }>(
    `#graphql
      query SynaravaCartCheckout($cartId: ID!, $language: LanguageCode!) @inContext(language: $language) {
        cart(id: $cartId) { checkoutUrl }
      }
    `,
    { cartId, language },
    { buyerIp: await getShopifyBuyerIp() },
  );
  return data.cart?.checkoutUrl ?? null;
}
