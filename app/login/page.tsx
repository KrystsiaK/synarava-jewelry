import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Login | Synarava",
  description: "Identify yourself to access Synarava customer or admin areas.",
};

type Props = {
  searchParams?: Promise<{
    redirectTo?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const error = params.error === "admin" ? "This area is restricted." : undefined;

  return (
    <AuthShell
      eyebrow="SYNARAVA | Login (Identify)"
      title="A quiet entrance into the archive."
      description="Sign in to access your storefront account or the internal admin tools. The same credential layer protects both, with permissions deciding where you can go next."
      asideTitle="Internal logic"
      asideBody="Admins, editors, and customers share one auth foundation. Roles and permissions decide what each person can open and edit."
      footer="If this is the first account created on the project, it will automatically receive admin access."
    >
      <LoginForm redirectTo={params.redirectTo} error={error} />
    </AuthShell>
  );
}
