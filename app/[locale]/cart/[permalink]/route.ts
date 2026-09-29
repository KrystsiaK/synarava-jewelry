import { NextResponse } from "next/server";

import {
  hashBuyAgainReplay,
  readBuyAgainReplayHash,
  setBuyAgainNotice,
  writeBuyAgainReplayHash,
  type BuyAgainOutcomeCode,
} from "@/lib/commerce/buy-again-notice";
import { addStorefrontMerchandiseLinesToCart } from "@/lib/commerce/storefront-cart";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import {
  getPublishedStorefrontLocales,
  getStorefrontLocales,
} from "@/lib/i18n/storefront-locale-cache";
import { localePath } from "@/lib/i18n/routing";
import { getTrustedClientIp } from "@/lib/security/request-ip";
import { parseCartPermalink } from "@/lib/shopify/cart-permalink";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ locale: string; permalink: string }>;
};

function cartRedirect(locale: string, requestUrl: string) {
  const target = new URL(localePath(locale, "/cart"), requestUrl);
  return NextResponse.redirect(target, {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function logBuyAgain(event: string, fields: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      event,
      ...fields,
    }),
  );
}

/**
 * Shopify Buy again lands on Online Store `/cart/<variant>:<qty>,…`.
 * After the storefront redirect theme is published, that path arrives here.
 * Mutating GET is required by Shopify's link contract — replay + rate limit apply.
 *
 * @see SHOPIFY_POST_PURCHASE_FLOWS.md
 * @see https://shopify.dev/docs/apps/build/checkout/create-cart-permalinks
 */
export async function GET(request: Request, context: RouteContext) {
  const started = Date.now();
  const { locale: localeParam, permalink: rawPermalink } = await context.params;
  const permalink = decodeURIComponent(rawPermalink);

  const [published, allLocales] = await Promise.all([
    getPublishedStorefrontLocales(),
    getStorefrontLocales(),
  ]);
  const locale =
    published.find((entry) => entry.routeSegment === localeParam)?.routeSegment ??
    published.find((entry) => entry.isDefault)?.routeSegment ??
    allLocales.find((entry) => entry.isDefault)?.routeSegment ??
    "en";

  const ip = getTrustedClientIp(request.headers);
  const limit = await checkRateLimit("buy-again", ip, { max: 20, windowMs: 60_000 });
  if (!limit.ok) {
    await setBuyAgainNotice({ outcome: "failed", added: 0, skipped: 0 });
    logBuyAgain("shopify.buy_again.failed", {
      locale,
      reason: "rate_limited",
      latencyMs: Date.now() - started,
    });
    return cartRedirect(locale, request.url);
  }

  const parsed = parseCartPermalink(permalink);
  if (!parsed.ok) {
    await setBuyAgainNotice({
      outcome: "rejected",
      added: 0,
      skipped: 0,
      rejectCode: parsed.code,
    });
    logBuyAgain("shopify.buy_again.rejected", {
      locale,
      reason: parsed.code,
      latencyMs: Date.now() - started,
    });
    return cartRedirect(locale, request.url);
  }

  const replayHash = hashBuyAgainReplay(locale, parsed.canonical);
  const prior = await readBuyAgainReplayHash();
  if (prior === replayHash) {
    await setBuyAgainNotice({ outcome: "replayed", added: 0, skipped: 0 });
    logBuyAgain("shopify.buy_again.replayed", {
      locale,
      lineCount: parsed.lines.length,
      latencyMs: Date.now() - started,
    });
    return cartRedirect(locale, request.url);
  }

  try {
    const result = await addStorefrontMerchandiseLinesToCart(parsed.lines);
    await writeBuyAgainReplayHash(replayHash);

    let outcome: BuyAgainOutcomeCode = "completed";
    if (result.added === 0 && result.skipped > 0) outcome = "rejected";
    else if (result.skipped > 0) outcome = "partial";
    else if (result.adjusted) outcome = "adjusted";

    await setBuyAgainNotice({
      outcome,
      added: result.added,
      skipped: result.skipped,
      ...(outcome === "rejected" ? { rejectCode: "unavailable" } : {}),
    });

    logBuyAgain(`shopify.buy_again.${outcome}`, {
      locale,
      lineCount: parsed.lines.length,
      added: result.added,
      skipped: result.skipped,
      warningCount: result.warnings.length,
      latencyMs: Date.now() - started,
    });
  } catch {
    await setBuyAgainNotice({ outcome: "failed", added: 0, skipped: 0 });
    logBuyAgain("shopify.buy_again.failed", {
      locale,
      reason: "shopify_unavailable",
      latencyMs: Date.now() - started,
    });
  }

  return cartRedirect(locale, request.url);
}
