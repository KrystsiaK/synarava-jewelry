import "server-only";

import { db } from "@/lib/db";
import {
  LEGAL_DOCUMENT_CONFIGS,
  computeLegalDocumentLocaleBackfill,
  type LegalSectionsContent,
} from "@/lib/content/legal-document-backfill";

export type LegalDocumentBackfillResult = {
  slug: string;
  pageId?: string;
  found: boolean;
  enFilledSectionIds: string[];
  enFilledIntro: boolean;
  enFilledLastUpdated: boolean;
  ptFilledSectionIds: string[];
};

/** Applies computeLegalDocumentLocaleBackfill for every configured Legal Document. Safe to re-run — only ever fills currently-empty fields. */
export async function backfillLegalDocuments(): Promise<LegalDocumentBackfillResult[]> {
  const results: LegalDocumentBackfillResult[] = [];

  for (const docConfig of LEGAL_DOCUMENT_CONFIGS) {
    const page = await db.page.findUnique({
      where: { slug: docConfig.slug },
      include: { translations: { where: { locale: "pt" } } },
    });

    if (!page) {
      results.push({ slug: docConfig.slug, found: false, enFilledSectionIds: [], enFilledIntro: false, enFilledLastUpdated: false, ptFilledSectionIds: [] });
      continue;
    }

    const content = (page.content ?? {}) as { legalSections?: LegalSectionsContent; legalIntro?: string; legalLastUpdated?: string };
    const enBackfill = computeLegalDocumentLocaleBackfill(content, docConfig.en);
    if (enBackfill) {
      await db.page.update({
        where: { id: page.id },
        data: {
          content: {
            ...(page.content as object),
            legalSections: enBackfill.legalSections,
            ...(enBackfill.legalIntro !== undefined ? { legalIntro: enBackfill.legalIntro } : {}),
            ...(enBackfill.legalLastUpdated !== undefined ? { legalLastUpdated: enBackfill.legalLastUpdated } : {}),
          },
        },
      });
    }

    let ptFilledSectionIds: string[] = [];
    if (docConfig.pt) {
      const ptTranslation = page.translations[0];
      const ptContent = (ptTranslation?.content ?? {}) as { legalSections?: LegalSectionsContent };
      const ptBackfill = computeLegalDocumentLocaleBackfill(ptContent, docConfig.pt);
      if (ptBackfill && ptTranslation) {
        ptFilledSectionIds = ptBackfill.filledSectionIds;
        await db.pageTranslation.update({
          where: { id: ptTranslation.id },
          data: { content: { ...(ptTranslation.content as object), legalSections: ptBackfill.legalSections } },
        });
      }
    }

    results.push({
      slug: docConfig.slug,
      pageId: page.id,
      found: true,
      enFilledSectionIds: enBackfill?.filledSectionIds ?? [],
      enFilledIntro: Boolean(enBackfill?.legalIntro !== undefined),
      enFilledLastUpdated: Boolean(enBackfill?.legalLastUpdated !== undefined),
      ptFilledSectionIds,
    });
  }

  return results;
}
