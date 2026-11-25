import type { Metadata } from "next";

import { CartBuyAgainNotice } from "@/components/commerce/cart-buy-again-notice";
import { CartShell } from "@/components/commerce/cart-shell";
import { readBuyAgainNotice } from "@/lib/commerce/buy-again-notice";
import { listWornTogetherTitlesByMerchandiseIds } from "@/lib/commerce/product-pairings";
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
  T extends { id: string; merchandiseId: string | null; title: string },
>(items: T[], wornTogether: Map<string, string[]>): T[] {
  if (items.length < 2) return items;
  const remaining = [...items];
  const ordered: T[] = [];

  while (remaining.length > 0) {
    const next = remaining.shift()!;
    ordered.push(next);
    if (!next.merchandiseId) continue;
    const partnerTitles = new Set(wornTogether.get(next.merchandiseId) ?? []);
    if (partnerTitles.size === 0) continue;

    for (let i = 0; i < remaining.length; ) {
      const candidate = remaining[i];
      const candidateIsPartner = partnerTitles.has(candidate.title);
      const nextIsPartnerOfCandidate = Boolean(
        candidate.merchandiseId
        && (wornTogether.get(candidate.merchandiseId) ?? []).includes(next.title),
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
  const wornTogether = await listWornTogetherTitlesByMerchandiseIds(merchandiseIds);
  const items = orderItemsWithPairingsAdjacent(cart.items, wornTogether).map((item) => ({
    ...item,
    wornTogetherWith: item.merchandiseId
      ? wornTogether.get(item.merchandiseId) ?? []
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
