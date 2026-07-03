import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Login | Synarava",
  description: "Identify yourself to access your Synarava account.",
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
      description="Sign in to access your storefront account, saved details, and checkout history."
      asideTitle="Private archive"
      asideBody="Your account keeps order details and saved contact information in one calm, protected place."
    >
      <LoginForm redirectTo={params.redirectTo} error={error} />
    </AuthShell>
  );
}
