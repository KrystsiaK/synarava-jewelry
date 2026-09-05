import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/auth/guard";
import { getTrustedClientIp } from "@/lib/security/request-ip";

import {
  addStorefrontProductToCart,
  getStorefrontCartViewModel,
} from "@/lib/commerce/storefront-cart";

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
    };
    const productSlug = body.productSlug?.trim();
    const quantity = Number(body.quantity ?? 1);

    if (!productSlug || productSlug.length > 160 || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return NextResponse.json({ ok: false, error: "Invalid cart request." }, { status: 400 });
    }

    await addStorefrontProductToCart(
      productSlug,
      quantity,
      body.merchandiseId?.trim() || undefined,
    );
    const cart = await getStorefrontCartViewModel();

    return NextResponse.json({
      ok: true,
      count: cart.itemCount,
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
  } catch {
    return NextResponse.json(
      { ok: false, error: "Couldn’t add this piece. Please refresh and try again." },
      { status: 400 },
    );
  }
}
