"use server";

import { revalidatePath } from "next/cache";

import { scanAdminIssues } from "@/lib/admin/issues";
import { requirePermission } from "@/lib/auth/session";

export type AdminIssueScanState = {
  error?: string;
  success?: string;
};

export async function scanAdminIssuesAction(): Promise<AdminIssueScanState> {
  await requirePermission("products.manage", "/admin/issues");

  try {
    const result = await scanAdminIssues();
    revalidatePath("/admin/issues");
    revalidatePath("/admin/products");
    revalidatePath("/admin/products/[productId]", "page");
    return {
      success: `Scan complete. ${result.found} open problem(s), ${result.opened} new.`,
    };
  } catch (error) {
    console.error("[admin-issues] Scan failed.", error);
    return { error: "Issue scan failed. Check server logs and try again." };
  }
}
