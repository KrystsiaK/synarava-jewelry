import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { AdminLoginForm } from "@/components/auth/admin-login-form";
import {
  getCurrentAdminSession,
  getSafeAdminRedirect,
  readAdminReturnPath,
} from "@/lib/auth/admin-session";

export const metadata: Metadata = {
  title: "Admin Login | Synarava",
  description: "Restricted CMS access for Synarava staff.",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams?: Promise<{
    redirectTo?: string;
  }>;
};

export default async function AdminLoginPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  // Query wins when present; the short-lived return-to cookie covers the case
  // where a layout/auth bounce wiped or never set `redirectTo` in the URL.
  const fromQuery = params.redirectTo ? getSafeAdminRedirect(params.redirectTo) : null;
  const fromCookie = await readAdminReturnPath();
  const redirectTo = fromQuery ?? fromCookie ?? "/admin";
  const session = await getCurrentAdminSession();

  if (session) {
    redirect(redirectTo);
  }

  return (
    <AuthShell
      eyebrow="SYNARAVA | Admin"
      title="Admin entrance."
      description="Restricted CMS access is separate from site customer accounts."
      asideTitle="Private access"
      asideBody="Catalog, collection, and editorial controls live behind an isolated admin session."
    >
      <AdminLoginForm redirectTo={redirectTo} />
    </AuthShell>
  );
}
