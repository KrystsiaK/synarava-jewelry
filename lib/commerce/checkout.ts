import { cookies } from "next/headers";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { getCurrentUser } from "@/lib/auth/session";
import { clearActiveCart, getCartViewModel, getOrCreateCart } from "@/lib/commerce/cart";
import { db } from "@/lib/db";
import { getStripe, isStripePaymentConfigured } from "@/lib/stripe";

const CHECKOUT_ORDER_COOKIE = "synarava-checkout-order";
const CONFIRMED_ORDER_COOKIE = "synarava-confirmed-order";

function hashCheckoutToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function safeDigestEqual(left: string, right: string) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseOrderAccessCookie(raw: string | undefined) {
  const [orderId, token, ...rest] = raw?.split(".") ?? [];
  if (rest.length || !orderId || !token || !/^[0-9a-f]{64}$/i.test(token)) return null;
  return { orderId, token };
}

async function getAuthorizedOrderAccess(cookieName: string) {
  const cookieStore = await cookies();
  const access = parseOrderAccessCookie(cookieStore.get(cookieName)?.value);
  if (!access) return null;

  const order = await db.order.findUnique({
    where: { id: access.orderId },
    select: { id: true, userId: true, checkoutAccessTokenHash: true },
  });
  if (!order?.checkoutAccessTokenHash) return null;
  if (!safeDigestEqual(order.checkoutAccessTokenHash, hashCheckoutToken(access.token))) return null;

  const currentUser = await getCurrentUser();
  if (order.userId && order.userId !== currentUser?.id) return null;
  if (!order.userId && currentUser) return null;
  return access;
}

export type ShippingPayload = {
  email: string;
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode: string;
  countryCode: string;
  notes?: string;
};

function normalizeStripeClientSecret(clientSecret: string) {
  try {
    return decodeURIComponent(clientSecret);
  } catch {
    return clientSecret;
  }
}

export async function createOrGetStripeCheckoutSession(): Promise<string | null> {
  // Resolve through the protected cookie on every call so future callers cannot
  // accidentally turn this helper into another order-ID oracle.
  const order = await getCheckoutOrder();
  if (!order || order.status !== "DRAFT") return null;
  if (!isStripePaymentConfigured()) return null;

  const stripe = getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (order.stripeCheckoutSessionId) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(order.stripeCheckoutSessionId);
      if (existing.status === "open" && existing.client_secret) {
        return normalizeStripeClientSecret(existing.client_secret);
      }
    } catch {
      // expired or invalid — fall through to create a new one
    }
  }

  const session = await stripe.checkout.sessions.create({
    ui_mode: "elements",
    mode: "payment",
    currency: order.currency.toLowerCase(),
    line_items: order.items.map((item) => ({
      price_data: {
        currency: order.currency.toLowerCase(),
        product_data: { name: item.title },
        unit_amount: item.unitCents,
      },
      quantity: item.quantity,
    })),
    customer_email: order.customerEmail,
    return_url: `${appUrl}/checkout/confirmed?session_id={CHECKOUT_SESSION_ID}`,
    metadata: { orderId: order.id },
  });

  if (!session.client_secret) return null;

  await db.order.update({
    where: { id: order.id },
    data: { stripeCheckoutSessionId: session.id },
  });

  return normalizeStripeClientSecret(session.client_secret);
}

export async function getCheckoutOrderIdFromCookie() {
  return (await getAuthorizedOrderAccess(CHECKOUT_ORDER_COOKIE))?.orderId ?? null;
}

async function setCheckoutOrderCookie(orderId: string, token: string) {
  const cookieStore = await cookies();
  cookieStore.set(CHECKOUT_ORDER_COOKIE, `${orderId}.${token}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 6,
  });
}

export async function clearCheckoutOrderCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(CHECKOUT_ORDER_COOKIE);
}

export async function setConfirmedOrderCookie(orderId: string) {
  const access = await getAuthorizedOrderAccess(CHECKOUT_ORDER_COOKIE);
  if (!access || access.orderId !== orderId) return false;
  const cookieStore = await cookies();
  cookieStore.set(CONFIRMED_ORDER_COOKIE, `${access.orderId}.${access.token}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 5,
  });
  return true;
}

export async function getConfirmedOrderIdFromCookie() {
  return (await getAuthorizedOrderAccess(CONFIRMED_ORDER_COOKIE))?.orderId ?? null;
}

export async function clearConfirmedOrderCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(CONFIRMED_ORDER_COOKIE);
}

export async function consumeConfirmedOrderCookie() {
  const cookieStore = await cookies();
  const value = await getConfirmedOrderIdFromCookie();
  cookieStore.delete(CONFIRMED_ORDER_COOKIE);
  return value;
}

export async function createOrUpdateDraftOrderFromCart(shipping: ShippingPayload) {
  const cart = await getOrCreateCart({ createIfMissing: false });
  const cartView = await getCartViewModel();
  const currentUser = await getCurrentUser();

  if (!cart || cartView.items.length === 0) {
    return null;
  }

  const existingAccess = await getAuthorizedOrderAccess(CHECKOUT_ORDER_COOKIE);
  const existingOrder =
    existingAccess
      ? await db.order.findUnique({
          where: { id: existingAccess.orderId },
          include: { items: true },
        })
      : null;

  const shippingAddress = {
    line1: shipping.line1,
    line2: shipping.line2 || null,
    city: shipping.city,
    region: shipping.region || null,
    postalCode: shipping.postalCode,
    countryCode: shipping.countryCode,
  };

  const canReuseOrder = existingOrder?.status === "DRAFT";
  const checkoutToken = canReuseOrder ? existingAccess?.token : randomBytes(32).toString("hex");
  const order =
    canReuseOrder
      ? await db.order.update({
          where: { id: existingOrder.id },
          data: {
            userId: currentUser?.id ?? null,
            customerEmail: shipping.email,
            customerName: shipping.name,
            notes: shipping.notes || null,
            shippingAddress,
            subtotalCents: cartView.subtotalCents,
            totalCents: cartView.subtotalCents,
            currency: cartView.currency,
          },
        })
      : await db.order.create({
          data: {
            userId: currentUser?.id ?? null,
            customerEmail: shipping.email,
            customerName: shipping.name,
            notes: shipping.notes || null,
            shippingAddress,
            subtotalCents: cartView.subtotalCents,
            totalCents: cartView.subtotalCents,
            currency: cartView.currency,
            status: "DRAFT",
            paymentStatus: "PENDING",
            fulfillmentStatus: "UNFULFILLED",
            checkoutAccessTokenHash: hashCheckoutToken(checkoutToken!),
          },
        });

  await db.orderItem.deleteMany({
    where: { orderId: order.id },
  });

  for (const item of cart.items) {
    await db.orderItem.create({
      data: {
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        unitCents: item.unitCents,
        totalCents: item.unitCents * item.quantity,
        title: item.title,
        sku: item.sku,
        snapshot: item.snapshot ?? undefined,
      },
    });
  }

  await setCheckoutOrderCookie(order.id, checkoutToken!);
  return order.id;
}

export async function getCheckoutOrder() {
  const access = await getAuthorizedOrderAccess(CHECKOUT_ORDER_COOKIE);
  if (!access) {
    return null;
  }

  return db.order.findUnique({
    where: { id: access.orderId },
    include: {
      items: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });
}

export async function confirmCheckoutOrder() {
  const order = await getCheckoutOrder();
  const cart = await getOrCreateCart({ createIfMissing: false });

  if (!order || order.status !== "DRAFT") {
    return null;
  }

  // Payment status transitions (DRAFT → PAID) are handled exclusively by the
  // Stripe webhook. This function only clears the cart.
  if (cart) {
    await clearActiveCart(cart.id);
  }

  return order.id;
}
