import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Register | Synarava",
  description: "Join the Synarava storefront and create a new account.",
};

export default function RegisterPage() {
  return (
    <AuthShell
      eyebrow="Private access"
      title="Begin your personal archive."
      description="Create one account for a smoother checkout, saved delivery details, and a lasting record of your pieces."
      asideTitle="A quieter way to return."
      asideBody="Your selection remains yours while you register, so you can continue without starting over."
    >
      <RegisterForm />
    </AuthShell>
  );
}
