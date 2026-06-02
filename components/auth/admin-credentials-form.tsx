"use client";

import { useActionState } from "react";

import {
  updateAdminCredentialsAction,
  type AccountActionState,
} from "@/app/admin/account/actions";
import {
  AuthField,
  AuthForm,
  AuthInput,
  AuthMessage,
  PasswordInput,
} from "@/components/auth/auth-form-primitives";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { useTranslations } from "@/lib/i18n/context";

const initialState: AccountActionState = {};

export function AdminCredentialsForm({ currentEmail }: { currentEmail: string }) {
  const [state, formAction] = useActionState(updateAdminCredentialsAction, initialState);
  const { t } = useTranslations();

  return (
    <AuthForm action={formAction} className="panel p-6">
      <div className="space-y-2">
        <p className="label-caps text-accent">{t("auth.adminCredentials.eyebrow")}</p>
        <h2 className="font-serif text-[2rem] leading-none">{t("auth.adminCredentials.title")}</h2>
      </div>

      <AuthMessage error={state.error} success={state.success} />

      <AuthField label={t("auth.adminCredentials.emailLogin")}>
        <AuthInput type="email" name="email" defaultValue={currentEmail} autoComplete="email" required />
      </AuthField>

      <AuthField label={t("auth.adminCredentials.currentPassword")}>
        <PasswordInput name="currentPassword" autoComplete="current-password" required />
      </AuthField>

      <div className="grid gap-4 md:grid-cols-2">
        <AuthField label={t("auth.adminCredentials.newPassword")}>
          <PasswordInput name="newPassword" autoComplete="new-password" showStrength />
        </AuthField>

        <AuthField label={t("auth.adminCredentials.confirmNewPassword")}>
          <PasswordInput name="confirmPassword" autoComplete="new-password" />
        </AuthField>
      </div>

      <p className="text-sm leading-6 text-foreground/60">
        {t("auth.adminCredentials.passwordNote")}
      </p>

      <AuthSubmitButton label={t("auth.adminCredentials.submit")} pendingLabel={t("auth.adminCredentials.submitting")} className="mt-2" />
    </AuthForm>
  );
}
