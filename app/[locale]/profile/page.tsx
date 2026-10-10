import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { ShopifyProfileShell } from "@/components/profile/shopify-profile-shell";
import { getAccountOrdersSettings } from "@/lib/content/account-orders-settings";
import { getShopifyCustomerProfile } from "@/lib/shopify/customer-account/api";
import { getShopifyCustomerSession } from "@/lib/shopify/customer-account/session";
import { getShopifyCustomerWishlistIds } from "@/lib/shopify/wishlist";
import { listShopProducts } from "@/lib/content/catalog";
import { getCustomerProductReviews, listReviewProductLinks } from "@/lib/content/product-reviews";
import { getRequestLocale, getServerTranslations } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { storefrontReviewsVisible } from "@/lib/features/storefront-reviews";
import { toAccountReviewRows } from "@/lib/profile/account-reviews";

/** Orders/fulfillment/refunds must reflect Shopify after returning from account. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("profile.metaTitle"),
    description: t("profile.metaDescription"),
    robots: { index: false, follow: false },
  };
}

type Props = {
  searchParams?: Promise<{ section?: string }>;
};

const accountSections = ["overview", "wishlist", "orders", "reviews", "addresses", "security"] as const;

export default async function ProfilePage({ searchParams }: Props) {
  const [locale, session, params] = await Promise.all([
    getRequestLocale(),
    getShopifyCustomerSession(),
    searchParams,
  ]);
  const requestedSection = params?.section;
  const reviewsVisible = storefrontReviewsVisible();
  const allowedSections = reviewsVisible
    ? accountSections
    : accountSections.filter((section) => section !== "reviews");
  const activeSection = allowedSections.find((section) => section === requestedSection) ?? "overview";
  if (!reviewsVisible && requestedSection === "reviews") {
    redirect(localePath(locale, "/profile"));
  }
  const profileReturnTo = localePath(
    locale,
    activeSection === "overview" ? "/profile" : `/profile?section=${activeSection}`,
  );

  const loginHref = localePath(
    locale,
    `/login?redirectTo=${encodeURIComponent(profileReturnTo)}`,
  );
  if (!session) redirect(loginHref);
  const customer = await getShopifyCustomerProfile(session);
  if (!customer) redirect(loginHref);

  const [wishlistIds, customerReviews, ordersSettings] = await Promise.all([
    getShopifyCustomerWishlistIds(customer.id).catch((error): string[] => {
      console.error(
        "[shopify-customer-wishlist] Wishlist unavailable:",
        error instanceof Error ? error.message : "Unknown Shopify error",
      );
      return [];
    }),
    reviewsVisible ? getCustomerProductReviews(customer.id) : Promise.resolve([]),
    getAccountOrdersSettings(),
  ]);
  const productIds = [...new Set(customerReviews.map((review) => review.productId))];
  const [wishlistProducts, reviewProducts] = await Promise.all([
    wishlistIds.length
      ? listShopProducts({}, { shopifyProductIds: wishlistIds, limit: wishlistIds.length, locale }).then((products) => products.reverse())
      : Promise.resolve([]),
    reviewsVisible
      ? listReviewProductLinks(productIds, locale).catch((error) => {
          console.error(
            "[shopify-product-reviews] Product names unavailable:",
            error instanceof Error ? error.message : "Unknown error",
          );
          return [];
        })
      : Promise.resolve([]),
  ]);

  return (
    <ShopifyProfileShell
      customer={customer}
      activeTab={activeSection}
      wishlistProducts={wishlistProducts}
      reviews={toAccountReviewRows(customerReviews, reviewProducts, (slug) => localePath(locale, `/products/${slug}`))}
      sessionExpiresAt={session.sessionExpiresAt.toISOString()}
      ordersSettings={ordersSettings}
    />
  );
}
