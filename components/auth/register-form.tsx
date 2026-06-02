"use client";

import Link from "next/link";
import { useActionState } from "react";

import { registerAction, type AuthActionState } from "@/app/(auth)/actions";
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

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialState);
  const { t } = useTranslations();

  return (
    <AuthForm action={formAction}>
      <div className="space-y-2">
        <p className="label-caps text-accent">{t("auth.register.eyebrow")}</p>
        <h2 className="font-serif text-[2.4rem] leading-none">{t("auth.register.title")}</h2>
      </div>

      <AuthMessage error={state.error} />

      <AuthField label={t("auth.register.name")}>
        <AuthInput type="text" name="name" autoComplete="name" />
      </AuthField>

      <AuthField label={t("auth.email")}>
        <AuthInput type="email" name="email" autoComplete="email" required />
      </AuthField>

      <AuthField label={t("auth.password")}>
        <PasswordInput name="password" autoComplete="new-password" required showStrength />
      </AuthField>

      <AuthField label={t("auth.register.confirmPassword")}>
        <PasswordInput name="confirmPassword" autoComplete="new-password" required />
      </AuthField>

      <AuthSubmitButton label={t("auth.register.submit")} pendingLabel={t("auth.register.submitting")} className="mt-2" />

      <p className="text-sm text-foreground/60">
        {t("auth.register.alreadyRegistered")}{" "}
        <Link href="/login" className="transition-colors hover:text-accent">
          {t("auth.register.signIn")}
        </Link>
      </p>
    </AuthForm>
  );
}
