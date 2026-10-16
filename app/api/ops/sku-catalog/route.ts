import { NextResponse } from "next/server";

import { fetchShopifySkuCatalog } from "@/lib/shopify/sku-catalog";
import { authorizeSkuOpsRequest } from "@/lib/sku/ops-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = authorizeSkuOpsRequest(request);
  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.status === 401 ? "Unauthorized" : "SKU service is not configured" },
      { status: authorization.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const snapshot = await fetchShopifySkuCatalog();
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not load the complete Shopify SKU catalog" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
