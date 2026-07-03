import { requireAuthenticatedUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";

function fmt(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

// All data fetchers resolve the user from the session.
// None of them accept a userId parameter — the session is the only authority.

export async function getProfileSummary() {
  const user = await requireAuthenticatedUser();

  const [orderCount, spentAgg, cartItemCount] = await Promise.all([
    db.order.count({ where: { userId: user.id, paymentStatus: "PAID" } }),
    db.order.aggregate({
      where: { userId: user.id, paymentStatus: "PAID" },
      _sum: { totalCents: true },
    }),
    db.cartItem.count({
      where: { cart: { userId: user.id, status: "ACTIVE" } },
    }),
  ]);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      createdAt: user.createdAt,
    },
    orderCount,
    totalSpent: fmt(spentAgg._sum.totalCents ?? 0),
    cartItemCount,
  };
}

export async function getProfileOrders() {
  const user = await requireAuthenticatedUser();

  const orders = await db.order.findMany({
    where: { userId: user.id },
    include: {
      items: {
        include: {
          product: { select: { slug: true, imageUrl: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return orders.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    paymentStatus: o.paymentStatus,
    fulfillmentStatus: o.fulfillmentStatus,
    total: fmt(o.totalCents, o.currency),
    totalCents: o.totalCents,
    createdAt: o.createdAt,
    itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
    items: o.items.map((i) => ({
      id: i.id,
      title: i.title,
      quantity: i.quantity,
      total: fmt(i.totalCents, o.currency),
      imageUrl: i.product?.imageUrl ?? null,
      slug: i.product?.slug ?? null,
    })),
  }));
}

export async function getProfileCart() {
  const user = await requireAuthenticatedUser();

  const cart = await db.cart.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    include: {
      items: {
        include: {
          product: { select: { slug: true, imageUrl: true, materialLine: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!cart) return null;

  const subtotalCents = cart.items.reduce(
    (sum, item) => sum + item.unitCents * item.quantity,
    0,
  );

  return {
    id: cart.id,
    currency: cart.currency,
    subtotal: fmt(subtotalCents, cart.currency),
    itemCount: cart.items.reduce((s, i) => s + i.quantity, 0),
    items: cart.items.map((i) => ({
      id: i.id,
      title: i.title,
      sku: i.sku,
      quantity: i.quantity,
      price: fmt(i.unitCents, cart.currency),
      total: fmt(i.unitCents * i.quantity, cart.currency),
      imageUrl: i.product?.imageUrl ?? null,
      slug: i.product?.slug ?? null,
      materialLine: i.product?.materialLine ?? "",
    })),
  };
}

export async function getProfileAddresses() {
  const user = await requireAuthenticatedUser();

  return db.customerProfile.findUnique({
    where: { userId: user.id },
    include: {
      addresses: { orderBy: { createdAt: "asc" } },
      defaultAddress: true,
    },
  });
}

export async function getActiveSessionCount() {
  const user = await requireAuthenticatedUser();

  return db.userSession.count({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
  });
}
