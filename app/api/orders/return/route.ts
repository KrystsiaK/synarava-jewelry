import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { getTrustedClientIp } from "@/lib/security/request-ip";
import { requestShopifyOrderReturn } from "@/lib/shopify/customer-account/api";

export async function POST(request: Request) {
  try {
    const limit = await checkRateLimit("order-return", getTrustedClientIp(request.headers), {
      max: 10,
      windowMs: 60 * 1000,
    });
    if (!limit.ok) {
      return NextResponse.json(
        { ok: false, error: "Too many return requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }

    const body = (await request.json()) as {
      orderId?: string;
      lineItems?: Array<{ lineItemId?: string; quantity?: number }>;
    };
    const orderId = body.orderId?.trim();
    const lineItems = (body.lineItems ?? []).flatMap((item) => (
      item.lineItemId && Number.isInteger(item.quantity) && (item.quantity as number) > 0
        ? [{ lineItemId: item.lineItemId, quantity: item.quantity as number }]
        : []
    ));
    if (!orderId || lineItems.length === 0) {
      return NextResponse.json({ ok: false, error: "Select at least one item to return." }, { status: 400 });
    }

    const result = await requestShopifyOrderReturn(orderId, lineItems);
    return NextResponse.json({ ok: true, returnId: result.id, status: result.status });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not submit the return request." },
      { status: 400 },
    );
  }
}
