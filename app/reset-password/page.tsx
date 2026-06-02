import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import {
  PasswordResetConfirmForm,
  PasswordResetRequestForm,
} from "@/components/auth/reset-password-form";
import { getValidPasswordResetToken } from "@/lib/auth/users";

export const metadata: Metadata = {
  title: "Reset Password | Synarava",
  description: "Restore access to a Synarava account.",
};

type Props = {
  searchParams?: Promise<{
    token?: string;
  }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const token = params.token?.trim();
  const record = token ? await getValidPasswordResetToken(token) : null;

  return (
    <AuthShell
      eyebrow="SYNARAVA | Reset Password (Restore)"
      title={record ? "Set the next password." : "Restore access without friction."}
      description="Password restore is intentionally minimal for now: generate a reset link, open it, and replace the password. In local mode the link is previewed directly on the page."
      asideTitle="Security note"
      asideBody="Reset tokens are single-use and expire after one hour. Once consumed, they cannot be reused."
    >
      {record && token ? <PasswordResetConfirmForm token={token} /> : <PasswordResetRequestForm />}
    </AuthShell>
  );
}
