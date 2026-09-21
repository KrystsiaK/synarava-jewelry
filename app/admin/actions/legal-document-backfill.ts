"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { revalidateStorefrontPath } from "@/lib/content/revalidate-storefront";
import { backfillLegalDocuments } from "@/lib/content/legal-document-backfill-runner";
import { writeAuditLog } from "./shared";

export type LegalDocumentBackfillActionState = {
  error?: string;
  success?: string;
  summary?: string[];
};

/**
 * One-time (safe to re-run) initialization step: copies shipped default
 * copy into any Legal Document field that has never held a real value —
 * see lib/content/legal-document-backfill.ts. Never touches a field that
 * already has admin-saved content.
 */
export async function backfillLegalDocumentDefaultsAction(): Promise<LegalDocumentBackfillActionState> {
  await requireAdminSession("/admin/pages");

  const results = await backfillLegalDocuments();
  const summary: string[] = [];
  let anyChange = false;

  for (const result of results) {
    if (!result.found) {
      summary.push(`${result.slug}: page not found — skipped`);
      continue;
    }
    const parts: string[] = [];
    if (result.enFilledSectionIds.length) parts.push(`EN sections: ${result.enFilledSectionIds.join(", ")}`);
    if (result.enFilledIntro) parts.push("EN intro");
    if (result.enFilledLastUpdated) parts.push("EN last updated");
    if (result.ptFilledSectionIds.length) parts.push(`PT sections: ${result.ptFilledSectionIds.join(", ")}`);

    if (parts.length === 0) {
      summary.push(`${result.slug}: already fully initialized — no change`);
      continue;
    }
    anyChange = true;
    summary.push(`${result.slug}: filled ${parts.join("; ")}`);

    await writeAuditLog({
      action: "LEGAL_DOCUMENT_BACKFILL",
      entityType: "PAGE",
      entityId: result.pageId ?? result.slug,
      metadata: result,
    });

    revalidateStorefrontPath(`/${result.slug}`);
  }

  revalidatePath("/admin/pages");

  return {
    success: anyChange ? "Backfill applied — see summary for what changed." : "Nothing to backfill — every Legal Document already has real content for every field.",
    summary,
  };
}
