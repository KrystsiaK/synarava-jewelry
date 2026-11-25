import type { Metadata } from "next";

import { CartBuyAgainNotice } from "@/components/commerce/cart-buy-again-notice";
import { CartShell } from "@/components/commerce/cart-shell";
import { readBuyAgainNotice } from "@/lib/commerce/buy-again-notice";
import { listWornTogetherMerchandiseIdsByMerchandiseIds } from "@/lib/commerce/product-pairings";
import { getStorefrontCartViewModel } from "@/lib/commerce/storefront-cart";
import { hasShopifyCustomerSession } from "@/lib/shopify/customer-account/session";
import { getServerTranslations } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";
import { buildOpenGraphLocales } from "@/lib/seo/open-graph-locale";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getServerTranslations();
  const title = t("cart.metaTitle");
  const description = t("cart.metaDescription");
  const openGraphLocales = await buildOpenGraphLocales(locale);

  return {
    title,
    description,
    alternates: await buildAlternates(locale, "/cart"),
    openGraph: {
      ...openGraphLocales,
      url: localePath(locale, "/cart"),
      title,
      description,
    },
  };
}

function orderItemsWithPairingsAdjacent<
  T extends { id: string; merchandiseId: string | null },
>(items: T[], wornTogether: Map<string, string[]>): T[] {
  if (items.length < 2) return items;
  const remaining = [...items];
  const ordered: T[] = [];

  while (remaining.length > 0) {
    const next = remaining.shift()!;
    ordered.push(next);
    if (!next.merchandiseId) continue;
    const partnerMerch = new Set(wornTogether.get(next.merchandiseId) ?? []);
    if (partnerMerch.size === 0) continue;

    for (let i = 0; i < remaining.length; ) {
      const candidate = remaining[i];
      const candidateIsPartner = Boolean(
        candidate.merchandiseId && partnerMerch.has(candidate.merchandiseId),
      );
      const nextIsPartnerOfCandidate = Boolean(
        candidate.merchandiseId
        && (wornTogether.get(candidate.merchandiseId) ?? []).includes(next.merchandiseId!),
      );
      if (candidateIsPartner || nextIsPartnerOfCandidate) {
        ordered.push(candidate);
        remaining.splice(i, 1);
        continue;
      }
      i += 1;
    }
  }

  return ordered;
}

export default async function CartPage() {
  const [cart, isSignedIn, buyAgainNotice] = await Promise.all([
    getStorefrontCartViewModel(),
    hasShopifyCustomerSession(),
    readBuyAgainNotice(),
  ]);

  const merchandiseIds = cart.items
    .map((item) => item.merchandiseId)
    .filter((id): id is string => Boolean(id));
  const wornTogetherMerch = await listWornTogetherMerchandiseIdsByMerchandiseIds(merchandiseIds);
  const titleByMerch = new Map(
    cart.items
      .filter((item) => item.merchandiseId)
      .map((item) => [item.merchandiseId!, item.title] as const),
  );
  const items = orderItemsWithPairingsAdjacent(cart.items, wornTogetherMerch).map((item) => ({
    ...item,
    wornTogetherWith: item.merchandiseId
      ? (wornTogetherMerch.get(item.merchandiseId) ?? [])
          .map((merchId) => titleByMerch.get(merchId))
          .filter((title): title is string => Boolean(title))
      : [],
  }));

  return (
    <CartShell
      items={items}
      itemCount={cart.itemCount}
      subtotalCents={cart.subtotalCents}
      subtotal={cart.subtotal}
      currency={cart.currency}
      isSignedIn={isSignedIn}
      notice={<CartBuyAgainNotice notice={buyAgainNotice} />}
    />
  );
}
