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

export type AdminLoginActionState = {
  error?: string;
  retryAfterSeconds?: number;
};

async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
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
  const byIp = checkRateLimit("admin-login-ip", ip, { max: 10, windowMs: 15 * 60 * 1000 });
  if (!byIp.ok) {
    return {
      error: byIp.error,
      retryAfterSeconds: byIp.retryAfterSeconds,
    };
  }

  const byUsername = checkRateLimit("admin-login-username", username || "missing", {
    max: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!byUsername.ok) {
    return {
      error: byUsername.error,
      retryAfterSeconds: byUsername.retryAfterSeconds,
    };
  }

  if (!verifyAdminCredentials(username, password)) {
    return { error: "Incorrect admin credentials." };
  }

  clearRateLimit("admin-login-ip", ip);
  clearRateLimit("admin-login-username", username || "missing");
  await createAdminSession();
  redirect(redirectTo);
}

export async function adminLogoutAction() {
  await clearAdminSession();
  redirect("/admin/login");
}
