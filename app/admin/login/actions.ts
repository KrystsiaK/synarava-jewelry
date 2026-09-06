"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { checkRateLimit, clearRateLimit } from "@/lib/auth/rate-limit";
import {
  clearAdminSession,
  createAdminSession,
  getSafeAdminRedirect,
  isAdminAuthConfigured,
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
  const redirectTo = getSafeAdminRedirect(parsed.data.redirectTo);

  if (!isAdminAuthConfigured()) {
    return {
      error:
        "Admin auth is not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD_HASH in the environment.",
    };
  }

  const ip = await getClientIp();
  const byIp = await checkRateLimit("admin-login-ip", ip, { max: 10, windowMs: 15 * 60 * 1000 });
  if (!byIp.ok) {
    return {
      error: byIp.error,
      retryAfterSeconds: byIp.retryAfterSeconds,
    };
  }

  if (!verifyAdminCredentials(username, password)) {
    return { error: "Incorrect admin credentials." };
  }

  await clearRateLimit("admin-login-ip", ip);
  const h = await headers();
  await createAdminSession({ ipAddress: ip, userAgent: h.get("user-agent") ?? undefined });
  redirect(redirectTo);
}

export async function adminLogoutAction() {
  await clearAdminSession();
  redirect("/admin/login");
}
