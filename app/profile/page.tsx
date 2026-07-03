import type { Metadata } from "next";

import { ProfileShell } from "@/components/profile/profile-shell";
import {
  getActiveSessionCount,
  getProfileAddresses,
  getProfileCart,
  getProfileOrders,
  getProfileSummary,
} from "@/lib/commerce/profile";

export const metadata: Metadata = {
  title: "My Account | Synarava",
  description: "Manage your Synarava account, orders, and preferences.",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const [summary, orders, cart, addressProfile, sessionCount] = await Promise.all([
    getProfileSummary(),
    getProfileOrders(),
    getProfileCart(),
    getProfileAddresses(),
    getActiveSessionCount(),
  ]);

  return (
    <ProfileShell
      summary={summary}
      orders={orders}
      cart={cart}
      addressProfile={addressProfile}
      sessionCount={sessionCount}
    />
  );
}
