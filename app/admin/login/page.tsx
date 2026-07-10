import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { AdminLoginForm } from "@/components/auth/admin-login-form";
import { getCurrentAdminSession } from "@/lib/auth/admin-session";

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

function getSafeRedirect(value?: string) {
  if (!value || !value.startsWith("/admin") || value.startsWith("/admin/login")) {
    return "/admin";
  }

  return value;
}

export default async function AdminLoginPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const redirectTo = getSafeRedirect(params.redirectTo);
  const session = await getCurrentAdminSession();

  if (session) {
    redirect(redirectTo);
  }

  return (
    <AuthShell
      eyebrow="SYNARAVA | Admin"
      title="Studio entrance."
      description="Restricted CMS access is separate from storefront customer accounts."
      asideTitle="Private studio"
      asideBody="Catalog, collection, and editorial controls live behind an isolated admin session."
    >
      <AdminLoginForm redirectTo={redirectTo} />
    </AuthShell>
  );
}

