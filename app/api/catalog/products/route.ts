import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { getTrustedClientIp } from "@/lib/security/request-ip";
import { listShopCatalogPage } from "@/lib/content/shop-listing";
import { clampPageSize } from "@/lib/catalog/shop-query";
import { normalizeLocale } from "@/lib/i18n/locales";
import { parseShopFilters } from "@/components/shop/types";

export const dynamic = "force-dynamic";

// Same-origin next-page fetch for the shop's infinite scroll. Not behind
// `proxy.ts` (its matcher excludes `/api`), so locale comes from an explicit
// query param rather than the `x-locale` header — the client already knows
// its own locale. Filtering/sorting rules always come from
// `listShopCatalogPage`, the same loader `/[locale]/shop` uses for its SSR
// first page, so the two can never disagree on what counts as a match.
export async function GET(request: Request) {
  const limit = await checkRateLimit("catalog-products", getTrustedClientIp(request.headers), {
    max: 120,
    windowMs: 60 * 1000,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const url = new URL(request.url);
  const locale = normalizeLocale(url.searchParams.get("locale"));
  const filters = parseShopFilters(url.searchParams);
  const pageSize = clampPageSize(url.searchParams.get("limit"));
  // A missing/stale/foreign cursor isn't an error — listShopCatalogPage
  // treats it as "start from the top" (see decodeCatalogCursor), which is
  // the safer default for a page the user is passively scrolling.
  const cursor = url.searchParams.get("cursor");

  try {
    const page = await listShopCatalogPage({ filters, locale, cursor, limit: pageSize });
    return NextResponse.json(page, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load products." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
