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
} from "@/components/auth/auth-form-primitives";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

const initialState: AuthActionState = {};

export function PasswordResetRequestForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, initialState);

  return (
    <AuthForm action={formAction}>
      <div className="space-y-2">
        <p className="label-caps text-accent">Restore</p>
        <h2 className="font-serif text-[2.4rem] leading-none">Reset password</h2>
      </div>

      <AuthMessage error={state.error} success={state.success} />

      <AuthField label="Account email">
        <AuthInput type="email" name="email" autoComplete="email" required />
      </AuthField>

      <AuthSubmitButton label="Generate reset link" pendingLabel="Preparing link…" className="mt-2" />

      {state.previewUrl ? (
        <p className="text-sm leading-6 text-foreground/68">
          Local preview link:{" "}
          <a href={state.previewUrl} className="break-all text-accent underline underline-offset-4">
            {state.previewUrl}
          </a>
        </p>
      ) : null}

      <p className="text-sm text-foreground/60">
        Return to{" "}
        <Link href="/login" className="transition-colors hover:text-accent">
          login
        </Link>
      </p>
    </AuthForm>
  );
}

export function PasswordResetConfirmForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPasswordAction, initialState);

  return (
    <AuthForm action={formAction}>
      <input type="hidden" name="token" value={token} />
      <div className="space-y-2">
        <p className="label-caps text-accent">Restore</p>
        <h2 className="font-serif text-[2.4rem] leading-none">Set a new password</h2>
      </div>

      <AuthMessage error={state.error} success={state.success} />

      <AuthField label="New password">
        <AuthInput type="password" name="password" autoComplete="new-password" required />
      </AuthField>

      <AuthField label="Confirm new password">
        <AuthInput type="password" name="confirmPassword" autoComplete="new-password" required />
      </AuthField>

      <AuthSubmitButton label="Update password" pendingLabel="Updating…" className="mt-2" />

      <p className="text-sm text-foreground/60">
        Back to{" "}
        <Link href="/login" className="transition-colors hover:text-accent">
          login
        </Link>
      </p>
    </AuthForm>
  );
}
