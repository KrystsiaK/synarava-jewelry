import type { Metadata } from "next";

import { CartBuyAgainNotice } from "@/components/commerce/cart-buy-again-notice";
import { CartShell } from "@/components/commerce/cart-shell";
import { consumeBuyAgainNotice } from "@/lib/commerce/buy-again-notice";
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

export default async function CartPage() {
  const [cart, isSignedIn, buyAgainNotice] = await Promise.all([
    getStorefrontCartViewModel(),
    hasShopifyCustomerSession(),
    consumeBuyAgainNotice(),
  ]);

  return (
    <CartShell
      items={cart.items}
      itemCount={cart.itemCount}
      subtotalCents={cart.subtotalCents}
      subtotal={cart.subtotal}
      currency={cart.currency}
      isSignedIn={isSignedIn}
      notice={<CartBuyAgainNotice notice={buyAgainNotice} />}
    />
  );
}
