import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";

export const metadata: Metadata = {
  title: "Reset Password | Synarava",
  description: "Restore access to a Synarava account.",
};

export default async function ResetPasswordPage() {
  redirect(localePath(await getRequestLocale(), "/login"));
}
