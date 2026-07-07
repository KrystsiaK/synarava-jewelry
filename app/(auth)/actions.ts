"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { checkRateLimit } from "@/lib/auth/guard";
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
};

async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "").trim();

  const ip = await getClientIp();
  const byIp = checkRateLimit("login-ip", ip, { max: 20, windowMs: 15 * 60 * 1000 });
  if (!byIp.ok) return { error: byIp.error };

  const byEmail = checkRateLimit("login-email", email, { max: 5, windowMs: 15 * 60 * 1000 });
  if (!byEmail.ok) return { error: byEmail.error };

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

  const ip = await getClientIp();
  const byIp = checkRateLimit("register-ip", ip, { max: 10, windowMs: 60 * 60 * 1000 });
  if (!byIp.ok) return { error: byIp.error };

  const policy = validatePasswordPolicy(password);
  if (!policy.ok) return { error: policy.error };

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const result = await registerUser({ name, email, password });

  if (!result.ok) {
    // Generic message to avoid confirming whether an email is registered.
    return { error: "Registration failed. Please check your details and try again." };
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

  // Always the same response — never reveal whether an email exists.
  const neutral = { success: "If that email exists in our system, a reset link has been sent." };

  if (!email) {
    return { error: "Enter the account email to continue." };
  }

  const ip = await getClientIp();
  const byIp = checkRateLimit("reset-ip", ip, { max: 5, windowMs: 15 * 60 * 1000 });
  if (!byIp.ok) return { error: byIp.error };

  const byEmail = checkRateLimit("reset-email", email, { max: 3, windowMs: 60 * 60 * 1000 });
  if (!byEmail.ok) return { error: byEmail.error };

  await createPasswordResetToken(email);

  // Token is stored in DB only. Wire an email provider here to deliver it.
  // Never expose the token in the HTTP response.
  return neutral;
}

export async function resetPasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const ip = await getClientIp();
  const byIp = checkRateLimit("reset-confirm-ip", ip, { max: 10, windowMs: 15 * 60 * 1000 });
  if (!byIp.ok) return { error: byIp.error };

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
