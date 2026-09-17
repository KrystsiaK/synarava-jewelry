import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { getTrustedClientIp } from "@/lib/security/request-ip";
import { db } from "@/lib/db";
import { getShopifyCustomerId } from "@/lib/shopify/customer-account/api";
import { getShopifyCustomerWishlistIds, toggleShopifyCustomerWishlist } from "@/lib/shopify/wishlist";
import { revalidateStorefrontPath } from "@/lib/content/revalidate-storefront";

export async function GET(request: Request) {
  const limit = await checkRateLimit("wishlist-check", getTrustedClientIp(request.headers), {
    max: 60,
    windowMs: 60 * 1000,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many wishlist requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  // A single heart-toggle check only needs the customer's id, not the full
  // profile query's orders/addresses/returns (REV-16).
  const customerId = await getShopifyCustomerId().catch(() => null);
  if (!customerId) return NextResponse.json({ ok: true, isSaved: false });

  const productSlug = new URL(request.url).searchParams.get("productSlug")?.trim();
  if (!productSlug) {
    return NextResponse.json({ ok: false, error: "Missing productSlug." }, { status: 400 });
  }

  const product = await db.product.findUnique({
    where: { slug: productSlug },
    select: { shopifyProductId: true },
  });
  if (!product?.shopifyProductId) return NextResponse.json({ ok: true, isSaved: false });

  const wishlist = await getShopifyCustomerWishlistIds(customerId);
  return NextResponse.json({ ok: true, isSaved: wishlist.includes(product.shopifyProductId) });
}

export async function POST(request: Request) {
  try {
    const limit = await checkRateLimit("wishlist-toggle", getTrustedClientIp(request.headers), {
      max: 60,
      windowMs: 60 * 1000,
    });
    if (!limit.ok) {
      return NextResponse.json(
        { ok: false, error: "Too many wishlist requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }

    const customerId = await getShopifyCustomerId().catch(() => null);
    if (!customerId) {
      return NextResponse.json({ ok: false, error: "Sign in to save products.", requiresLogin: true }, { status: 401 });
    }

    const body = (await request.json()) as { productSlug?: string };
    const productSlug = body.productSlug?.trim();
    if (!productSlug || productSlug.length > 200) {
      return NextResponse.json({ ok: false, error: "Invalid wishlist request." }, { status: 400 });
    }

    const product = await db.product.findUnique({
      where: { slug: productSlug },
      select: { shopifyProductId: true },
    });
    if (!product?.shopifyProductId) {
      return NextResponse.json({ ok: false, error: "This product can't be saved yet." }, { status: 400 });
    }

    const result = await toggleShopifyCustomerWishlist(customerId, product.shopifyProductId);
    revalidateStorefrontPath("/profile");
    return NextResponse.json({ ok: true, isSaved: result.isSaved });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not update your wishlist. Please try again." }, { status: 400 });
  }
}
