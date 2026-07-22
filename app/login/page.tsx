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
      eyebrow="Private access"
      title="Return to your collection."
      description="Sign in to continue your selection, revisit orders, and keep delivery details close at hand."
      asideTitle="Your pieces, remembered."
      asideBody="Account details are used only to support your orders and make future acquisitions easier."
    >
      <LoginForm redirectTo={params.redirectTo} error={error} />
    </AuthShell>
  );
}
