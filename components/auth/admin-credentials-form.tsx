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
} from "@/components/auth/auth-form-primitives";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

const initialState: AccountActionState = {};

export function AdminCredentialsForm({ currentEmail }: { currentEmail: string }) {
  const [state, formAction] = useActionState(updateAdminCredentialsAction, initialState);

  return (
    <AuthForm action={formAction} className="panel p-6">
      <div className="space-y-2">
        <p className="label-caps text-accent">Credentials</p>
        <h2 className="font-serif text-[2rem] leading-none">Login and password</h2>
      </div>

      <AuthMessage error={state.error} success={state.success} />

      <AuthField label="Email login">
        <AuthInput type="email" name="email" defaultValue={currentEmail} autoComplete="email" required />
      </AuthField>

      <AuthField label="Current password">
        <AuthInput type="password" name="currentPassword" autoComplete="current-password" required />
      </AuthField>

      <div className="grid gap-4 md:grid-cols-2">
        <AuthField label="New password">
          <AuthInput type="password" name="newPassword" autoComplete="new-password" />
        </AuthField>

        <AuthField label="Confirm new password">
          <AuthInput type="password" name="confirmPassword" autoComplete="new-password" />
        </AuthField>
      </div>

      <p className="text-sm leading-6 text-foreground/60">
        Leave the new password fields empty if you only want to change the login email.
      </p>

      <AuthSubmitButton label="Update credentials" pendingLabel="Updating…" className="mt-2" />
    </AuthForm>
  );
}
