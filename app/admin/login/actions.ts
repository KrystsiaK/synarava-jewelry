"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { checkRateLimit, clearRateLimit } from "@/lib/auth/rate-limit";
import {
  clearAdminReturnPath,
  clearAdminSession,
  createAdminSession,
  getSafeAdminRedirect,
  isAdminAuthConfigured,
  readAdminReturnPath,
  verifyAdminCredentials,
} from "@/lib/auth/admin-session";
import { parseFormData } from "@/lib/forms/parse-form-data";
import { getTrustedClientIp } from "@/lib/security/request-ip";

export type AdminLoginActionState = {
  error?: string;
  retryAfterSeconds?: number;
};

const loginSchema = z.object({
  username: z.string().trim().min(1),
  // Not trimmed: a leading/trailing space could be a real (if unusual)
  // character in the admin password, and silently altering it would just
  // turn a correct password into a confusing "incorrect credentials" error.
  password: z.string().min(1),
  redirectTo: z.string().trim().default(""),
});

async function getClientIp(): Promise<string> {
  const h = await headers();
  return getTrustedClientIp(h);
}

export async function adminLoginAction(
  _prevState: AdminLoginActionState,
  formData: FormData,
): Promise<AdminLoginActionState> {
  const parsed = parseFormData(formData, loginSchema);
  if (!parsed.success) {
    return { error: "Enter both an admin username and password." };
  }
  const { username, password } = parsed.data;
  const remembered = await readAdminReturnPath();
  const redirectTo = getSafeAdminRedirect(parsed.data.redirectTo || remembered || undefined);

  if (!isAdminAuthConfigured()) {
    return {
      error:
        "Admin auth is not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD_HASH in the environment.",
    };
  }

  const ip = await getClientIp();
  const usernameKey = username.trim().toLowerCase();
  const window = { max: 10, windowMs: 15 * 60 * 1000 } as const;
  const byIp = await checkRateLimit("admin-login-ip", ip, window);
  if (!byIp.ok) {
    return {
      error: byIp.error,
      retryAfterSeconds: byIp.retryAfterSeconds,
    };
  }
  // Second bucket: distributed guessing of one known login is not limited by IP alone.
  const byUser = await checkRateLimit("admin-login-user", usernameKey, window);
  if (!byUser.ok) {
    return {
      error: byUser.error,
      retryAfterSeconds: byUser.retryAfterSeconds,
    };
  }

  if (!verifyAdminCredentials(username, password)) {
    return { error: "Incorrect admin credentials." };
  }

  await Promise.all([
    clearRateLimit("admin-login-ip", ip),
    clearRateLimit("admin-login-user", usernameKey),
  ]);
  const h = await headers();
  await createAdminSession({ ipAddress: ip, userAgent: h.get("user-agent") ?? undefined });
  await clearAdminReturnPath();
  redirect(redirectTo);
}

export async function adminLogoutAction() {
  await clearAdminSession();
  redirect("/admin/login");
}
