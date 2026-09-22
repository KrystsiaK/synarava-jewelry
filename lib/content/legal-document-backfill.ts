import type { LegalSectionDefault, LegalSectionMeta } from "@/lib/content/legal-sections";
import { PRIVACY_SECTIONS, PRIVACY_SECTION_DEFAULTS, PRIVACY_LAST_UPDATED_DEFAULT } from "@/lib/content/privacy-defaults";
import { OFFER_SECTIONS, OFFER_SECTION_DEFAULTS, OFFER_INTRO_DEFAULT, OFFER_LAST_UPDATED_DEFAULT } from "@/lib/content/offer-defaults";
import { TERMS_SECTIONS, TERMS_SECTION_DEFAULTS, TERMS_INTRO_DEFAULT, TERMS_LAST_UPDATED_DEFAULT } from "@/lib/content/terms-defaults";
import { LEGAL_NOTICE_SECTIONS, LEGAL_NOTICE_SECTION_DEFAULTS, LEGAL_NOTICE_INTRO_DEFAULT, LEGAL_NOTICE_LAST_UPDATED_DEFAULT } from "@/lib/content/legal-notice-defaults";

// -----------------------------------------------------------------------
// Once a Legal Document's Page row exists, admin-saved content is the only
// source of truth for what's shown. The shipped *-defaults.ts constants are
// an INITIAL TEMPLATE, not a runtime fallback: they may only be copied into
// a row's content once, at the moment a field has never held a real value.
// computeLegalDocumentLocaleBackfill (pure, unit-tested) is that one-time
// copy step; lib/content/legal-document-backfill-runner.ts applies it to
// the database — kept in a separate server-only file so this one stays
// trivially unit-testable.
//
// The merge is intentionally conservative: for every field, if the row
// already holds a non-empty value, that value is left completely untouched
// — this only ever fills gaps, never overwrites. Safe and idempotent.
// -----------------------------------------------------------------------

export type LegalSectionsContent = Record<string, { title?: string; body?: string }>;

export type LocaleDocConfig = {
  sections: LegalSectionMeta[];
  sectionDefaults: Record<string, LegalSectionDefault>;
  introDefault?: string;
  lastUpdatedDefault?: string;
};

export type LegalDocumentConfig = {
  slug: string;
  en: LocaleDocConfig & { lastUpdatedDefault: string };
  pt?: LocaleDocConfig;
};

export const LEGAL_DOCUMENT_CONFIGS: LegalDocumentConfig[] = [
  {
    slug: "privacy",
    en: { sections: PRIVACY_SECTIONS.en, sectionDefaults: PRIVACY_SECTION_DEFAULTS.en, lastUpdatedDefault: PRIVACY_LAST_UPDATED_DEFAULT },
    pt: { sections: PRIVACY_SECTIONS.pt!, sectionDefaults: PRIVACY_SECTION_DEFAULTS.pt! },
  },
  {
    slug: "offer",
    en: { sections: OFFER_SECTIONS, sectionDefaults: OFFER_SECTION_DEFAULTS, introDefault: OFFER_INTRO_DEFAULT, lastUpdatedDefault: OFFER_LAST_UPDATED_DEFAULT },
  },
  {
    slug: "terms-and-conditions",
    en: { sections: TERMS_SECTIONS, sectionDefaults: TERMS_SECTION_DEFAULTS, introDefault: TERMS_INTRO_DEFAULT, lastUpdatedDefault: TERMS_LAST_UPDATED_DEFAULT },
  },
  {
    slug: "legal-notice",
    en: { sections: LEGAL_NOTICE_SECTIONS, sectionDefaults: LEGAL_NOTICE_SECTION_DEFAULTS, introDefault: LEGAL_NOTICE_INTRO_DEFAULT, lastUpdatedDefault: LEGAL_NOTICE_LAST_UPDATED_DEFAULT },
  },
];

export type LocaleBackfillPatch = {
  legalSections: LegalSectionsContent;
  legalIntro?: string;
  legalLastUpdated?: string;
  filledSectionIds: string[];
};

/**
 * Given a locale's currently-saved legalSections/legalIntro/legalLastUpdated
 * and the shipped template for that document, returns only the fields that
 * were genuinely missing (never touches a present value) — or null if there
 * is nothing to fill in.
 */
export function computeLegalDocumentLocaleBackfill(
  current: { legalSections?: LegalSectionsContent; legalIntro?: string; legalLastUpdated?: string },
  config: LocaleDocConfig,
): LocaleBackfillPatch | null {
  const currentSections = current.legalSections ?? {};
  const filledSections: LegalSectionsContent = { ...currentSections };
  const filledSectionIds: string[] = [];

  for (const { id } of config.sections) {
    const existing = currentSections[id];
    const hasTitle = Boolean(existing?.title?.trim());
    const hasBody = Boolean(existing?.body?.trim());
    if (hasTitle && hasBody) continue;

    const template = config.sectionDefaults[id];
    if (!template) continue;

    filledSections[id] = {
      title: hasTitle ? existing!.title : template.title,
      body: hasBody ? existing!.body : template.body,
    };
    filledSectionIds.push(id);
  }

  const needsIntro = config.introDefault !== undefined && !current.legalIntro?.trim();
  const needsLastUpdated = config.lastUpdatedDefault !== undefined && !current.legalLastUpdated?.trim();

  if (filledSectionIds.length === 0 && !needsIntro && !needsLastUpdated) return null;

  return {
    legalSections: filledSections,
    ...(needsIntro ? { legalIntro: config.introDefault } : {}),
    ...(needsLastUpdated ? { legalLastUpdated: config.lastUpdatedDefault } : {}),
    filledSectionIds,
  };
}
