"use server";

import { requireAdminSession } from "@/lib/auth/admin-session";
import type { AiLocale, GenerateResult } from "@/lib/ai/product-content/contract";
import { generateProductContent } from "@/lib/ai/product-content/generate";

function isNextRedirectError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

/**
 * Admin-only AI product content draft generation.
 * Read-only Product/Translation load; sole DB write is AuditLog usage row.
 * Never writes Product / ProductTranslation. Never imports Shopify.
 */
export async function generateProductContentAction(
  productId: string,
  locales: AiLocale[],
): Promise<GenerateResult> {
  let session: { username: string; sessionId: string };
  try {
    session = await requireAdminSession();
  } catch (error) {
    if (isNextRedirectError(error) || error instanceof Error) {
      return {
        ok: false,
        code: "unauthorized",
        message: "Admin session required",
      };
    }
    return {
      ok: false,
      code: "unauthorized",
      message: "Admin session required",
    };
  }

  if (!productId || typeof productId !== "string") {
    return { ok: false, code: "not_found", message: "Product not found" };
  }

  try {
    return await generateProductContent({
      productId,
      locales: Array.isArray(locales) ? locales : [],
      actor: {
        username: session.username,
        sessionId: session.sessionId,
      },
    });
  } catch {
    // Never throw invalid_output / provider failures to the client as exceptions.
    return {
      ok: false,
      code: "provider_error",
      message: "Unexpected failure during AI content generation",
    };
  }
}
