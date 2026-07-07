import { cookies } from "next/headers";

import { getCurrentUser } from "@/lib/auth/session";
import { clearActiveCart, getCartViewModel, getOrCreateCart } from "@/lib/commerce/cart";
import { db } from "@/lib/db";
import { getStripe, isStripePaymentConfigured } from "@/lib/stripe";

const CHECKOUT_ORDER_COOKIE = "synarava-checkout-order";
const CONFIRMED_ORDER_COOKIE = "synarava-confirmed-order";

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

export async function createOrGetStripeCheckoutSession(orderId: string): Promise<string | null> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

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
  const cookieStore = await cookies();
  return cookieStore.get(CHECKOUT_ORDER_COOKIE)?.value ?? null;
}

export async function setCheckoutOrderCookie(orderId: string) {
  const cookieStore = await cookies();
  cookieStore.set(CHECKOUT_ORDER_COOKIE, orderId, {
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
  const cookieStore = await cookies();
  cookieStore.set(CONFIRMED_ORDER_COOKIE, orderId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 5,
  });
}

export async function getConfirmedOrderIdFromCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(CONFIRMED_ORDER_COOKIE)?.value ?? null;
}

export async function clearConfirmedOrderCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(CONFIRMED_ORDER_COOKIE);
}

export async function consumeConfirmedOrderCookie() {
  const cookieStore = await cookies();
  const value = cookieStore.get(CONFIRMED_ORDER_COOKIE)?.value ?? null;
  if (value) cookieStore.delete(CONFIRMED_ORDER_COOKIE);
  return value;
}

export async function createOrUpdateDraftOrderFromCart(shipping: ShippingPayload) {
  const cart = await getOrCreateCart({ createIfMissing: false });
  const cartView = await getCartViewModel();
  const currentUser = await getCurrentUser();

  if (!cart || cartView.items.length === 0) {
    return null;
  }

  const orderId = await getCheckoutOrderIdFromCookie();
  const existingOrder =
    orderId
      ? await db.order.findUnique({
          where: { id: orderId },
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

  const order =
    existingOrder && existingOrder.status === "DRAFT"
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

  await setCheckoutOrderCookie(order.id);
  return order.id;
}

export async function getCheckoutOrder() {
  const orderId = await getCheckoutOrderIdFromCookie();
  if (!orderId) {
    return null;
  }

  return db.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        orderBy: {
          createdAt: "asc",
        },
      },
      user: true,
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
