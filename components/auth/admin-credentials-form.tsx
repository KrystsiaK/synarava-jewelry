"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  updateAdminCredentialsAction,
  type AccountActionState,
} from "@/app/admin/account/actions";
import { AdminHelp } from "@/components/admin/admin-help";
import { PasswordInput } from "@/components/auth/auth-form-primitives";
import { useTranslations } from "@/lib/i18n/context";

const initialState: AccountActionState = {};

function AdminAccountMessage({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  if (!error && !success) return null;

  return (
    <div
      className="rounded-lg border px-4 py-3 text-sm leading-6"
      style={{
        borderColor: error ? "rgba(185,74,72,0.42)" : "rgba(184,201,138,0.34)",
        color: error ? "#ffd8d5" : "var(--adm-muted)",
        background: error ? "var(--adm-danger-soft)" : "rgba(184,201,138,0.08)",
      }}
    >
      {error ?? success}
    </div>
  );
}

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

  return (
    <form action={formAction} className="adm-panel grid gap-5 p-5 md:p-6">
      <div className="space-y-2">
        <p className="adm-section-tag">{t("auth.adminCredentials.eyebrow")}</p>
        <h2 className="adm-title-sm">{t("auth.adminCredentials.title")}</h2>
      </div>

      <AdminAccountMessage error={state.error} success={state.success} />

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
