import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

const CART_COOKIE = "synarava-cart";

function formatMoney(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function buildCartSessionKey() {
  return `cart_${randomUUID()}`;
}

type CartWithRelations = Awaited<ReturnType<typeof loadCartBySessionKey>>;

async function loadCartBySessionKey(sessionKey: string) {
  return db.cart.findUnique({
    where: { sessionKey },
    include: {
      items: {
        include: {
          product: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });
}

async function mergeCartItems(targetCartId: string, sourceCart: NonNullable<CartWithRelations>) {
  for (const item of sourceCart.items) {
    if (!item.productId) {
      continue;
    }

    const existing = await db.cartItem.findFirst({
      where: {
        cartId: targetCartId,
        productId: item.productId,
      },
    });

    if (existing) {
      await db.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + item.quantity,
        },
      });
    } else {
      await db.cartItem.create({
        data: {
          cartId: targetCartId,
          productId: item.productId,
          quantity: item.quantity,
          unitCents: item.unitCents,
          title: item.title,
          sku: item.sku,
          snapshot: item.snapshot ?? undefined,
        },
      });
    }
  }

  await db.cart.update({
    where: { id: sourceCart.id },
    data: { status: "CONVERTED" },
  });
}

export async function getOrCreateCart(options?: { createIfMissing?: boolean }) {
  const createIfMissing = options?.createIfMissing ?? true;
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser();
  const sessionKey = cookieStore.get(CART_COOKIE)?.value;

  let cart = sessionKey ? await loadCartBySessionKey(sessionKey) : null;
  if (cart && cart.status !== "ACTIVE") {
    cart = null;
  }

  if (currentUser) {
    const userCart = await db.cart.findFirst({
      where: {
        userId: currentUser.id,
        status: "ACTIVE",
      },
      include: {
        items: {
          include: {
            product: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    if (cart && cart.userId && cart.userId !== currentUser.id && userCart) {
      cart = userCart;
    } else if (cart && !cart.userId) {
      if (userCart && userCart.id !== cart.id) {
        await mergeCartItems(userCart.id, cart);
        cart = await loadCartBySessionKey(userCart.sessionKey);
      } else {
        await db.cart.update({
          where: { id: cart.id },
          data: { userId: currentUser.id },
        });
        cart = await loadCartBySessionKey(cart.sessionKey);
      }
    } else if (!cart && userCart) {
      cart = userCart;
    }
  }

  if (!cart && createIfMissing) {
    const nextSessionKey = buildCartSessionKey();
    cart = await db.cart.create({
      data: {
        sessionKey: nextSessionKey,
        userId: currentUser?.id,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
    cookieStore.set(CART_COOKIE, nextSessionKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  } else if (cart && cart.sessionKey !== sessionKey) {
    cookieStore.set(CART_COOKIE, cart.sessionKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return cart;
}

export async function attachCurrentCartToUser(userId: string) {
  const cookieStore = await cookies();
  const sessionKey = cookieStore.get(CART_COOKIE)?.value;

  if (!sessionKey) {
    return;
  }

  const cart = await loadCartBySessionKey(sessionKey);

  if (!cart || cart.status !== "ACTIVE") {
    return;
  }

  const userCart = await db.cart.findFirst({
    where: {
      userId,
      status: "ACTIVE",
    },
    include: {
      items: true,
    },
  });

  if (userCart && userCart.id !== cart.id) {
    await mergeCartItems(userCart.id, cart);
    cookieStore.set(CART_COOKIE, userCart.sessionKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return;
  }

  if (!cart.userId) {
    await db.cart.update({
      where: { id: cart.id },
      data: { userId },
    });
  }
}

export async function getCartViewModel() {
  const cart = await getOrCreateCart({ createIfMissing: false });

  if (!cart) {
    return {
      id: null,
      items: [],
      itemCount: 0,
      subtotalCents: 0,
      subtotal: formatMoney(0),
      currency: "EUR",
    };
  }

  const items = cart.items.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    slug: item.product?.slug ?? "",
    title: item.title,
    imageUrl: item.product?.imageUrl ?? "",
    materialLine: item.product?.materialLine ?? "",
    unitCents: item.unitCents,
    totalCents: item.unitCents * item.quantity,
    price: formatMoney(item.unitCents, cart.currency),
    total: formatMoney(item.unitCents * item.quantity, cart.currency),
  }));

  const subtotalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    id: cart.id,
    items,
    itemCount,
    subtotalCents,
    subtotal: formatMoney(subtotalCents, cart.currency),
    currency: cart.currency,
  };
}

export async function getCartCount() {
  const cart = await getCartViewModel();
  return cart.itemCount;
}

export async function addProductToCart(productSlug: string, quantity = 1) {
  const cart = await getOrCreateCart();
  if (!cart) {
    throw new Error("Unable to create cart.");
  }

  const product = await db.product.findUnique({
    where: { slug: productSlug },
  });

  if (!product || product.status !== "ACTIVE" || product.visibility !== "PUBLIC") {
    throw new Error("Product not available.");
  }

  const existing = await db.cartItem.findFirst({
    where: {
      cartId: cart.id,
      productId: product.id,
    },
  });

  if (existing) {
    await db.cartItem.update({
      where: { id: existing.id },
      data: {
        quantity: existing.quantity + quantity,
        unitCents: product.priceCents,
        title: product.name,
        sku: product.sku,
        snapshot: {
          slug: product.slug,
          imageUrl: product.imageUrl,
          materialLine: product.materialLine,
        },
      },
    });
  } else {
    await db.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        quantity,
        unitCents: product.priceCents,
        title: product.name,
        sku: product.sku,
        snapshot: {
          slug: product.slug,
          imageUrl: product.imageUrl,
          materialLine: product.materialLine,
        },
      },
    });
  }
}

export async function updateCartItemQuantity(itemId: string, quantity: number) {
  if (quantity <= 0) {
    await db.cartItem.delete({
      where: { id: itemId },
    });
    return;
  }

  await db.cartItem.update({
    where: { id: itemId },
    data: { quantity },
  });
}

export async function removeCartItem(itemId: string) {
  await db.cartItem.delete({
    where: { id: itemId },
  });
}

export async function clearActiveCart(cartId: string) {
  await db.cartItem.deleteMany({
    where: { cartId },
  });

  await db.cart.update({
    where: { id: cartId },
    data: {
      status: "CONVERTED",
    },
  });
}
