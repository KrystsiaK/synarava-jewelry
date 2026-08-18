import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { ShopifyProfileShell } from "@/components/profile/shopify-profile-shell";
import { getShopifyCustomerProfile } from "@/lib/shopify/customer-account/api";

export const metadata: Metadata = {
  title: "My Account | Synarava",
  description: "Manage your Synarava account, orders, and preferences.",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const customer = await getShopifyCustomerProfile();
  if (!customer) redirect("/api/auth/shopify?returnTo=/profile");

  return <ShopifyProfileShell customer={customer} />;
}
