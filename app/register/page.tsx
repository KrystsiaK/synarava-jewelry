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
      description="Registration is intentionally simple: one account model for store and team access, with roles layered underneath instead of separate systems."
      asideTitle="Customer first"
      asideBody="Most new accounts become customer accounts. The first account on a fresh project is promoted to admin automatically so the internal tools remain reachable."
    >
      <RegisterForm />
    </AuthShell>
  );
}
