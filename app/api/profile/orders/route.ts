import { NextResponse } from "next/server";

import { getShopifyCustomerSession } from "@/lib/shopify/customer-account/session";
import { getShopifyCustomerOrdersPage } from "@/lib/shopify/customer-account/api";

// Loads a further page of the signed-in customer's orders past the profile's
// initial 50 (REV-13) — a lightweight session check rather than the full
// getShopifyCustomerProfile() query, which this route has no other use for.
// A stable errorCode (rather than only the English `error` text, kept for logs
// and as a fallback) lets the UI show a translated message (REV-23) instead
// of this route's own English copy leaking into a PT page.
export async function GET(request: Request) {
  const session = await getShopifyCustomerSession();
  if (!session) {
    return NextResponse.json({ ok: false, errorCode: "requires_login", error: "Sign in to view more orders." }, { status: 401 });
  }

  const after = new URL(request.url).searchParams.get("after")?.trim();
  if (!after) {
    return NextResponse.json({ ok: false, errorCode: "invalid_cursor", error: "Missing after cursor." }, { status: 400 });
  }

  try {
    const orders = await getShopifyCustomerOrdersPage(after);
    return NextResponse.json({ ok: true, ...orders });
  } catch {
    return NextResponse.json({ ok: false, errorCode: "upstream_failed", error: "Couldn't load more orders. Please try again." }, { status: 502 });
  }
}
