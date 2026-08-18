import { NextResponse } from "next/server";

import {
  addStorefrontProductToCart,
  getStorefrontCartCount,
} from "@/lib/commerce/storefront-cart";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      productSlug?: string;
      quantity?: number;
      merchandiseId?: string;
    };
    const productSlug = body.productSlug?.trim();
    const quantity = Number(body.quantity ?? 1);

    if (!productSlug) {
      return NextResponse.json({ ok: false, error: "Missing product slug." }, { status: 400 });
    }

    await addStorefrontProductToCart(
      productSlug,
      Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      body.merchandiseId?.trim() || undefined,
    );
    const count = await getStorefrontCartCount();

    return NextResponse.json({ ok: true, count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add product to cart.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
