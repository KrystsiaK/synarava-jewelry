import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { ShopifyProfileShell } from "@/components/profile/shopify-profile-shell";
import { getShopifyCustomerProfile } from "@/lib/shopify/customer-account/api";

export const metadata: Metadata = {
  title: "My Account | Synarava",
  description: "Manage your Synarava account, orders, and preferences.",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams?: Promise<{ section?: string }>;
};

const accountSections = ["overview", "orders", "addresses", "security"] as const;

export default async function ProfilePage({ searchParams }: Props) {
  const customer = await getShopifyCustomerProfile();
  if (!customer) redirect("/api/auth/shopify?returnTo=/profile");
  const requestedSection = (await searchParams)?.section;
  const activeSection = accountSections.find((section) => section === requestedSection) ?? "overview";

  return <ShopifyProfileShell customer={customer} activeTab={activeSection} />;
}
