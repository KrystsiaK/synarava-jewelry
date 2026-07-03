"use server";

import { redirect } from "next/navigation";

import { clearUserSession, createUserSession } from "@/lib/auth/session";
import { attachCurrentCartToUser } from "@/lib/commerce/cart";
import {
  authenticateUser,
  createPasswordResetToken,
  registerUser,
  resetPasswordFromToken,
} from "@/lib/auth/users";
import { validatePasswordPolicy } from "@/lib/auth/password-policy";

export type AuthActionState = {
  error?: string;
  success?: string;
  previewUrl?: string;
};

function buildResetUrl(token: string) {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}/reset-password?token=${token}`;
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "").trim();

  const user = await authenticateUser(email, password);

  if (!user) {
    return { error: "Incorrect email or password." };
  }

  await createUserSession(user.id);
  await attachCurrentCartToUser(user.id);

  if (redirectTo) {
    redirect(redirectTo);
  }

  redirect("/shop");
}

export async function registerAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const policy = validatePasswordPolicy(password);
  if (!policy.ok) return { error: policy.error };

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const result = await registerUser({ name, email, password });

  if (!result.ok) {
    return { error: result.error };
  }

  await createUserSession(result.userId);
  await attachCurrentCartToUser(result.userId);

  redirect("/shop");
}

export async function requestPasswordResetAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Enter the account email to continue." };
  }

  const result = await createPasswordResetToken(email);

  if (!result) {
    return {
      success:
        "If that email exists in the system, a reset link has been prepared. In local mode, only real accounts show the preview link.",
    };
  }

  return {
    success: "Reset link generated.",
    previewUrl: buildResetUrl(result.token),
  };
}

export async function resetPasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const policy = validatePasswordPolicy(password);
  if (!policy.ok) return { error: policy.error };

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const result = await resetPasswordFromToken(token, password);

  if (!result.ok) {
    return { error: result.error };
  }

  return {
    success: "Password updated. You can now sign in with the new credentials.",
  };
}

export async function logoutAction() {
  await clearUserSession();
  redirect("/login");
}
