"use client";

import Link from "next/link";
import { useActionState } from "react";

import { registerAction, type AuthActionState } from "@/app/(auth)/actions";
import {
  AuthField,
  AuthForm,
  AuthInput,
  AuthMessage,
} from "@/components/auth/auth-form-primitives";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

const initialState: AuthActionState = {};

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialState);

  return (
    <AuthForm action={formAction}>
      <div className="space-y-2">
        <p className="label-caps text-accent">Join</p>
        <h2 className="font-serif text-[2.4rem] leading-none">Register</h2>
      </div>

      <AuthMessage error={state.error} />

      <AuthField label="Name">
        <AuthInput type="text" name="name" autoComplete="name" />
      </AuthField>

      <AuthField label="Email">
        <AuthInput type="email" name="email" autoComplete="email" required />
      </AuthField>

      <AuthField label="Password">
        <AuthInput type="password" name="password" autoComplete="new-password" required />
      </AuthField>

      <AuthField label="Confirm password">
        <AuthInput type="password" name="confirmPassword" autoComplete="new-password" required />
      </AuthField>

      <AuthSubmitButton label="Create account" pendingLabel="Creating account…" className="mt-2" />

      <p className="text-sm text-foreground/60">
        Already registered?{" "}
        <Link href="/login" className="transition-colors hover:text-accent">
          Sign in
        </Link>
      </p>
    </AuthForm>
  );
}
