"use client";

import Link from "next/link";
import { useActionState } from "react";

import { loginAction, type AuthActionState } from "@/app/(auth)/actions";
import {
  AuthField,
  AuthForm,
  AuthInput,
  AuthMessage,
  PasswordInput,
} from "@/components/auth/auth-form-primitives";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { useTranslations } from "@/lib/i18n/context";

const initialState: AuthActionState = {};

export function LoginForm({
  redirectTo,
  error,
}: {
  redirectTo?: string;
  error?: string;
}) {
  const [state, formAction] = useActionState(loginAction, initialState);
  const { t } = useTranslations();

  return (
    <AuthForm action={formAction}>
      <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />
      <div className="space-y-2">
        <p className="label-caps text-accent">{t("auth.login.eyebrow")}</p>
        <h2 className="font-serif text-[2.4rem] leading-none">{t("auth.login.title")}</h2>
      </div>

      <AuthMessage error={state.error ?? error} />

      <AuthField label={t("auth.email")}>
        <AuthInput type="email" name="email" autoComplete="email" required />
      </AuthField>

      <AuthField label={t("auth.password")}>
        <PasswordInput name="password" autoComplete="current-password" required />
      </AuthField>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <AuthSubmitButton label={t("auth.login.submit")} pendingLabel={t("auth.login.submitting")} />
        <Link href="/reset-password" className="label-caps text-muted transition-colors hover:text-accent">
          {t("auth.login.forgotPassword")}
        </Link>
      </div>

      <p className="text-sm text-foreground/60">
        {t("auth.login.noAccount")}{" "}
        <Link href="/register" className="transition-colors hover:text-accent">
          {t("auth.login.createOne")}
        </Link>
      </p>
    </AuthForm>
  );
}
