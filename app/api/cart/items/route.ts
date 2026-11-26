import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { getTrustedClientIp } from "@/lib/security/request-ip";

import {
  addStorefrontProductToCart,
  getStorefrontCartViewModel,
  type StorefrontCartLineInput,
} from "@/lib/commerce/storefront-cart";
import { revalidateStorefrontPath } from "@/lib/content/revalidate-storefront";

function normalizeCartAddBody(body: {
  productSlug?: string;
  quantity?: number;
  merchandiseId?: string;
  lines?: StorefrontCartLineInput[];
}): StorefrontCartLineInput[] | null {
  if (Array.isArray(body.lines) && body.lines.length > 0) {
    if (body.lines.length > 2) return null;
    return body.lines;
  }

  const productSlug = body.productSlug?.trim();
  const quantity = Number(body.quantity ?? 1);
  if (
    !productSlug
    || productSlug.length > 160
    || !Number.isInteger(quantity)
    || quantity < 1
    || quantity > 10
  ) {
    return null;
  }

  return [{
    productSlug,
    quantity,
    merchandiseId: body.merchandiseId?.trim() || undefined,
  }];
}

export async function POST(request: Request) {
  try {
    const limit = await checkRateLimit("cart-add", getTrustedClientIp(request.headers), {
      max: 30,
      windowMs: 60 * 1000,
    });
    if (!limit.ok) {
      return NextResponse.json(
        { ok: false, error: "Too many cart requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }

    const body = (await request.json()) as {
      productSlug?: string;
      quantity?: number;
      merchandiseId?: string;
      lines?: StorefrontCartLineInput[];
    };

    const lines = normalizeCartAddBody(body);
    if (!lines) {
      return NextResponse.json({ ok: false, error: "Invalid cart request." }, { status: 400 });
    }

    const { warnings } = await addStorefrontProductToCart(lines);
    const cart = await getStorefrontCartViewModel();
    revalidateStorefrontPath("/cart");
    revalidateStorefrontPath("/shop");
    revalidateStorefrontPath("/", "layout");

    return NextResponse.json({
      ok: true,
      count: cart.itemCount,
      warnings,
      ecommerce: {
        currency: cart.currency,
        value: cart.subtotalCents / 100,
        items: cart.items.map((item) => ({
          item_id: item.sku || item.merchandiseId || item.slug || item.id,
          item_name: item.title,
          item_variant: item.materialLine || undefined,
          price: item.unitCents / 100,
          quantity: item.quantity,
        })),
      },
    });
  } catch (error) {
    // Server-only reason for ops — never echo technical details to the buyer.
    const reason =
      error instanceof Error
        ? error.message.slice(0, 240)
        : "unknown";
    console.error("[cart-add] refused", { reason });
    return NextResponse.json(
      { ok: false, error: "Couldn’t add this piece. Please refresh and try again." },
      { status: 400 },
    );
  }
}
