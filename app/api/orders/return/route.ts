import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { getTrustedClientIp } from "@/lib/security/request-ip";
import { requestShopifyOrderReturn } from "@/lib/shopify/customer-account/api";
import { getShopifyCustomerSession } from "@/lib/shopify/customer-account/session";
import { getServerTranslations } from "@/lib/i18n/server";

export async function POST(request: Request) {
  const { t } = await getServerTranslations();

  const session = await getShopifyCustomerSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: t("profile.orders.requiresLogin") },
      { status: 401 },
    );
  }

  try {
    const limit = await checkRateLimit("order-return", getTrustedClientIp(request.headers), {
      max: 10,
      windowMs: 60 * 1000,
    });
    if (!limit.ok) {
      return NextResponse.json(
        { ok: false, error: t("profile.returns.rateLimited") },
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
      return NextResponse.json({ ok: false, error: t("profile.returns.selectAtLeastOne") }, { status: 400 });
    }

    const result = await requestShopifyOrderReturn(orderId, lineItems);
    return NextResponse.json({ ok: true, returnId: result.id, status: result.status });
  } catch (error) {
    // Shopify eligibility / userErrors are safe to surface; never leak internal
    // session or infrastructure text.
    const message = error instanceof Error ? error.message : "";
    const looksInternal =
      !message ||
      /session is unavailable|Customer Account API failed|Unexpected|ECONN|ETIMEDOUT|prisma|sql/i.test(
        message,
      );
    return NextResponse.json(
      {
        ok: false,
        error: looksInternal ? t("profile.returns.genericFailed") : message,
      },
      { status: 400 },
    );
  }
}
