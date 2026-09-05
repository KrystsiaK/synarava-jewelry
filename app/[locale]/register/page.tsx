import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";

export const metadata: Metadata = {
  title: "Register | Synarava",
  description: "Join the Synarava storefront and create a new account.",
};

export default async function RegisterPage() {
  redirect(localePath(await getRequestLocale(), "/login"));
}
