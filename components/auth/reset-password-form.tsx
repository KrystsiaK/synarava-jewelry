"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  requestPasswordResetAction,
  resetPasswordAction,
  type AuthActionState,
} from "@/app/(auth)/actions";
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

export function PasswordResetRequestForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, initialState);
  const { t } = useTranslations();

  return (
    <AuthForm action={formAction}>
      <div className="space-y-2">
        <p className="label-caps text-accent">{t("auth.resetRequest.eyebrow")}</p>
        <h2 className="font-serif text-[2.4rem] leading-none">{t("auth.resetRequest.title")}</h2>
      </div>

      <AuthMessage error={state.error} success={state.success} />

      <AuthField label={t("auth.resetRequest.accountEmail")}>
        <AuthInput type="email" name="email" autoComplete="email" required />
      </AuthField>

      <AuthSubmitButton label={t("auth.resetRequest.submit")} pendingLabel={t("auth.resetRequest.submitting")} className="mt-2" />

      <p className="text-sm text-foreground/60">
        {t("auth.resetRequest.returnTo")}{" "}
        <Link href="/login" className="transition-colors hover:text-accent">
          {t("auth.resetRequest.loginLink")}
        </Link>
      </p>
    </AuthForm>
  );
}

export function PasswordResetConfirmForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPasswordAction, initialState);
  const { t } = useTranslations();

  return (
    <AuthForm action={formAction}>
      <input type="hidden" name="token" value={token} />
      <div className="space-y-2">
        <p className="label-caps text-accent">{t("auth.resetConfirm.eyebrow")}</p>
        <h2 className="font-serif text-[2.4rem] leading-none">{t("auth.resetConfirm.title")}</h2>
      </div>

      <AuthMessage error={state.error} success={state.success} />

      <AuthField label={t("auth.resetConfirm.newPassword")}>
        <PasswordInput name="password" autoComplete="new-password" required showStrength />
      </AuthField>

      <AuthField label={t("auth.resetConfirm.confirmNewPassword")}>
        <PasswordInput name="confirmPassword" autoComplete="new-password" required />
      </AuthField>

      <AuthSubmitButton label={t("auth.resetConfirm.submit")} pendingLabel={t("auth.resetConfirm.submitting")} className="mt-2" />

      <p className="text-sm text-foreground/60">
        {t("auth.resetConfirm.backTo")}{" "}
        <Link href="/login" className="transition-colors hover:text-accent">
          {t("auth.resetConfirm.loginLink")}
        </Link>
      </p>
    </AuthForm>
  );
}
