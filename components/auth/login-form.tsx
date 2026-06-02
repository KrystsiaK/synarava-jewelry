"use client";

import Link from "next/link";
import { useActionState } from "react";

import { loginAction, type AuthActionState } from "@/app/(auth)/actions";
import {
  AuthField,
  AuthForm,
  AuthInput,
  AuthMessage,
} from "@/components/auth/auth-form-primitives";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

const initialState: AuthActionState = {};

export function LoginForm({
  redirectTo,
  error,
}: {
  redirectTo?: string;
  error?: string;
}) {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <AuthForm action={formAction}>
      <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />
      <div className="space-y-2">
        <p className="label-caps text-accent">Identify</p>
        <h2 className="font-serif text-[2.4rem] leading-none">Login</h2>
      </div>

      <AuthMessage error={state.error ?? error} />

      <AuthField label="Email">
        <AuthInput type="email" name="email" autoComplete="email" required />
      </AuthField>

      <AuthField label="Password">
        <AuthInput type="password" name="password" autoComplete="current-password" required />
      </AuthField>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <AuthSubmitButton label="Sign in" pendingLabel="Signing in…" />
        <Link href="/reset-password" className="label-caps text-muted transition-colors hover:text-accent">
          Forgot password
        </Link>
      </div>

      <p className="text-sm text-foreground/60">
        No account yet?{" "}
        <Link href="/register" className="transition-colors hover:text-accent">
          Create one
        </Link>
      </p>
    </AuthForm>
  );
}
