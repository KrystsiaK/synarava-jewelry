import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { ShopifyProfileShell } from "@/components/profile/shopify-profile-shell";
import { getShopifyCustomerProfile } from "@/lib/shopify/customer-account/api";
import { getShopifyCustomerSession } from "@/lib/shopify/customer-account/session";
import { getShopifyCustomerWishlistIds } from "@/lib/shopify/wishlist";
import { listShopProducts } from "@/lib/content/catalog";
import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";

export const metadata: Metadata = {
  title: "My Account | Synarava",
  description: "Manage your Synarava account, orders, and preferences.",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams?: Promise<{ section?: string }>;
};

const accountSections = ["overview", "wishlist", "orders", "addresses", "security"] as const;

export default async function ProfilePage({ searchParams }: Props) {
  const [locale, session, params] = await Promise.all([
    getRequestLocale(),
    getShopifyCustomerSession(),
    searchParams,
  ]);
  const requestedSection = params?.section;
  const activeSection = accountSections.find((section) => section === requestedSection) ?? "overview";
  const profileReturnTo = localePath(
    locale,
    activeSection === "overview" ? "/profile" : `/profile?section=${activeSection}`,
  );

  if (!session) {
    redirect(`/api/auth/shopify?returnTo=${encodeURIComponent(profileReturnTo)}`);
  }
  const customer = await getShopifyCustomerProfile(session);
  if (!customer) {
    redirect(`/api/auth/shopify?returnTo=${encodeURIComponent(profileReturnTo)}`);
  }

  const wishlistIds = await getShopifyCustomerWishlistIds(customer.id).catch((error): string[] => {
    console.error(
      "[shopify-customer-wishlist] Wishlist unavailable:",
      error instanceof Error ? error.message : "Unknown Shopify error",
    );
    return [];
  });
  const wishlistProducts = wishlistIds.length
    ? (await listShopProducts({}, { shopifyProductIds: wishlistIds, limit: wishlistIds.length, locale })).reverse()
    : [];

  return (
    <ShopifyProfileShell
      customer={customer}
      activeTab={activeSection}
      wishlistProducts={wishlistProducts}
      sessionExpiresAt={session.sessionExpiresAt.toISOString()}
    />
  );
}
