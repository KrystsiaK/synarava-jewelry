import { NextResponse } from "next/server";

import { getShopifyCustomerSession } from "@/lib/shopify/customer-account/session";
import { getShopifyCustomerOrdersPage } from "@/lib/shopify/customer-account/api";

// Loads a further page of the signed-in customer's orders past the profile's
// initial 50 (REV-13) — a lightweight session check rather than the full
// getShopifyCustomerProfile() query, which this route has no other use for.
export async function GET(request: Request) {
  const session = await getShopifyCustomerSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in to view more orders." }, { status: 401 });
  }

  const after = new URL(request.url).searchParams.get("after")?.trim();
  if (!after) {
    return NextResponse.json({ ok: false, error: "Missing after cursor." }, { status: 400 });
  }

  try {
    const orders = await getShopifyCustomerOrdersPage(after);
    return NextResponse.json({ ok: true, ...orders });
  } catch {
    return NextResponse.json({ ok: false, error: "Couldn't load more orders. Please try again." }, { status: 502 });
  }
}
