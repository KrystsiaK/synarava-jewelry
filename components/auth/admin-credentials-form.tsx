"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";

import {
  updateAdminCredentialsAction,
  type AccountActionState,
} from "@/app/admin/account/actions";
import { AdminHelp } from "@/components/admin/admin-help";
import { useAdminToast } from "@/components/admin/admin-toast";
import { AuthMessage, PasswordInput } from "@/components/auth/auth-form-primitives";
import { useTranslations } from "@/lib/i18n/context";

const initialState: AccountActionState = {};

function AdminCredentialsSubmit({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className="adm-btn-primary mt-2 w-fit">
      {pending ? pendingLabel : label}
    </button>
  );
}

export function AdminCredentialsForm({ currentEmail }: { currentEmail: string }) {
  const [state, formAction] = useActionState(updateAdminCredentialsAction, initialState);
  const { t } = useTranslations();
  const { pushToast } = useAdminToast();

  useEffect(() => {
    if (state.error) pushToast({ message: state.error, tone: "error" });
    if (state.success) pushToast({ message: state.success, tone: "success" });
  }, [pushToast, state]);

  return (
    <form action={formAction} className="adm-panel grid gap-5 p-5 md:p-6">
      <div className="space-y-2">
        <p className="adm-section-tag">{t("auth.adminCredentials.eyebrow")}</p>
        <h2 className="adm-title-sm">{t("auth.adminCredentials.title")}</h2>
      </div>

      <AuthMessage error={state.error} />

      <label className="grid gap-2">
        <span className="adm-label">{t("auth.adminCredentials.emailLogin")}</span>
        <input
          type="email"
          name="email"
          defaultValue={currentEmail}
          autoComplete="email"
          required
          className="adm-field"
        />
      </label>

      <label className="grid gap-2">
        <span className="adm-label">{t("auth.adminCredentials.currentPassword")}</span>
        <PasswordInput name="currentPassword" autoComplete="current-password" required className="adm-field" />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="adm-label">{t("auth.adminCredentials.newPassword")}</span>
          <PasswordInput name="newPassword" autoComplete="new-password" showStrength className="adm-field" />
        </label>

        <label className="grid gap-2">
          <span className="adm-label">{t("auth.adminCredentials.confirmNewPassword")}</span>
          <PasswordInput name="confirmPassword" autoComplete="new-password" className="adm-field" />
        </label>
      </div>

      <div>
        <AdminHelp label="Password guidance">
          {t("auth.adminCredentials.passwordNote")}
        </AdminHelp>
      </div>

      <AdminCredentialsSubmit
        label={t("auth.adminCredentials.submit")}
        pendingLabel={t("auth.adminCredentials.submitting")}
      />
    </form>
  );
}
