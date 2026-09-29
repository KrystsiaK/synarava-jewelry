import { redirect } from "next/navigation";

import { DisplayHeading, PrimaryCtaButton } from "@/components/ui";
import { getStorefrontCheckoutUrl } from "@/lib/commerce/storefront-cart";
import { getRequestLocale, getServerTranslations } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";

function CheckoutUnavailable({
  title,
  body,
  backLabel,
  cartHref,
}: {
  title: string;
  body: string;
  backLabel: string;
  cartHref: string;
}) {
  return (
    <main className="artifact-shell min-h-screen bg-background text-foreground">
      <div className="site-shell pt-28 pb-16">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-couture-red">
          Synarava
        </p>
        <DisplayHeading
          as="h1"
          className="max-w-[18ch] text-balance leading-[0.98]"
          style={{ fontSize: "clamp(2.2rem,4.5vw,3.6rem)" }}
        >
          {title}
        </DisplayHeading>
        <p
          role="alert"
          className="mt-6 max-w-xl border border-couture-red/40 p-4 text-sm leading-6 text-couture-red"
        >
          {body}
        </p>
        <div className="mt-8">
          <PrimaryCtaButton href={cartHref}>{backLabel}</PrimaryCtaButton>
        </div>
      </div>
    </main>
  );
}

export default async function CheckoutPage() {
  const [checkoutUrl, locale, { t }] = await Promise.all([
    getStorefrontCheckoutUrl(),
    getRequestLocale(),
    getServerTranslations(),
  ]);

  if (!checkoutUrl) {
    // Never silently bounce to cart — show a clear, actionable error here.
    return (
      <CheckoutUnavailable
        title={t("checkout.unavailableTitle")}
        body={t("checkout.unavailableBody")}
        backLabel={t("checkout.unavailableBackToCart")}
        cartHref={localePath(locale, "/cart")}
      />
    );
  }

  redirect(checkoutUrl);
}
