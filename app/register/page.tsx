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
      eyebrow="SYNARAVA | Register (Join)"
      title="Join the store without losing the editorial calm."
      description="Registration is intentionally simple: create one storefront account for saved details, smoother checkout, and order history."
      asideTitle="Customer first"
      asideBody="Most new accounts become customer accounts with a quiet profile area for personal details and purchase flow."
    >
      <RegisterForm />
    </AuthShell>
  );
}
