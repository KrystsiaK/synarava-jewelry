"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { checkRateLimit, clearRateLimit } from "@/lib/auth/guard";
import {
  clearAdminSession,
  createAdminSession,
  isAdminAuthConfigured,
  verifyAdminCredentials,
} from "@/lib/auth/admin-session";
import { getTrustedClientIp } from "@/lib/security/request-ip";

export type AdminLoginActionState = {
  error?: string;
  retryAfterSeconds?: number;
};

async function getClientIp(): Promise<string> {
  const h = await headers();
  return getTrustedClientIp(h);
}

function getSafeAdminRedirect(value: string) {
  if (!value.startsWith("/admin") || value.startsWith("/admin/login")) {
    return "/admin";
  }

  return value;
}

export async function adminLoginAction(
  _prevState: AdminLoginActionState,
  formData: FormData,
): Promise<AdminLoginActionState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = getSafeAdminRedirect(String(formData.get("redirectTo") ?? "").trim());

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
