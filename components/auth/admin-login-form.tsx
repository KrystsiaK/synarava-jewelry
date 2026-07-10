"use client";

import { useActionState, useEffect, useState } from "react";

import {
  adminLoginAction,
  type AdminLoginActionState,
} from "@/app/admin/login/actions";
import {
  AuthField,
  AuthForm,
  AuthInput,
  AuthMessage,
  PasswordInput,
} from "@/components/auth/auth-form-primitives";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

const initialState: AdminLoginActionState = {};

function getRetryMessage(seconds: number) {
  return `Too many attempts. Try again in ${seconds}s.`;
}

export function useRetryAfterCountdown(retryAfterSeconds?: number) {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(() =>
    retryAfterSeconds && retryAfterSeconds > 0 ? retryAfterSeconds : null,
  );

  useEffect(() => {
    if (!remainingSeconds || remainingSeconds <= 0) {
      return;
    }

    const id = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (!current || current <= 1) return 0;
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [remainingSeconds]);

  return remainingSeconds;
}

export function AdminLoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction] = useActionState(adminLoginAction, initialState);

  return (
    <AdminLoginFormFields
      key={state.retryAfterSeconds ?? "ready"}
      state={state}
      formAction={formAction}
      redirectTo={redirectTo}
    />
  );
}

function AdminLoginFormFields({
  state,
  formAction,
  redirectTo,
}: {
  state: AdminLoginActionState;
  formAction: (payload: FormData) => void | Promise<void>;
  redirectTo?: string;
}) {
  const retryAfterSeconds = useRetryAfterCountdown(state.retryAfterSeconds);

  const isLocked = retryAfterSeconds !== null && retryAfterSeconds > 0;
  const displayError = isLocked ? getRetryMessage(retryAfterSeconds) : retryAfterSeconds === 0 ? undefined : state.error;

  return (
    <AuthForm action={formAction}>
      <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />

      <div className="space-y-2">
        <p className="label-caps text-accent">Admin access</p>
        <h2 className="font-serif text-[2.4rem] leading-none">Studio credentials</h2>
      </div>

      <AuthMessage error={displayError} />

      <AuthField label="Username or email">
        <AuthInput type="text" name="username" autoComplete="username" required />
      </AuthField>

      <AuthField label="Password">
        <PasswordInput name="password" autoComplete="current-password" required />
      </AuthField>

      <AuthSubmitButton
        label={isLocked ? `Try again in ${retryAfterSeconds}s` : "Enter admin"}
        pendingLabel="Checking..."
        disabled={isLocked}
      />
    </AuthForm>
  );
}
