import { z } from "zod";

import type { Locale } from "@/lib/i18n/locales";
import { hasContent } from "@/lib/i18n/localized-content";

const materialSchema = z.object({
  name: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  properties: z.string().optional(),
});

const legalSectionSchema = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
});

export const pageTranslationContentSchema = z.object({
  eyebrow: z.string().optional(),
  body: z.string().optional(),
  ctaLabel: z.string().optional(),
  quote: z.string().optional(),
  secondaryTitle: z.string().optional(),
  secondaryBody: z.string().optional(),
  archiveSectionLabel: z.string().optional(),
  editSectionEyebrow: z.string().optional(),
  editSectionTitle: z.string().optional(),
  editSectionBody: z.string().optional(),
  editSectionViewAllLabel: z.string().optional(),
  materialSectionEyebrow: z.string().optional(),
  materialSectionTitle: z.string().optional(),
  materialSectionNoteLabel: z.string().optional(),
  materialLexicon: z.array(materialSchema).optional(),
  manifestoSectionLabel: z.string().optional(),
  manifestoSectionAttribution: z.string().optional(),
  finalCtaLabel: z.string().optional(),
  finalFooterTitle: z.string().optional(),
  finalContactLabel: z.string().optional(),
  legalIntro: z.string().optional(),
  legalLastUpdated: z.string().optional(),
  legalSections: z.record(z.string(), legalSectionSchema).optional(),
  serviceSections: z.record(z.string(), legalSectionSchema).optional(),
});

export type PageTranslationContent = z.infer<typeof pageTranslationContentSchema>;

export function normalizePageTranslationContent(value: unknown): PageTranslationContent {
  const parsed = pageTranslationContentSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

type PageTranslationRow = {
  title: string;
  localizedHandle?: string | null;
  excerpt?: string | null;
  content?: unknown;
};

type PageSource = {
  title: string;
  excerpt?: string | null;
  content?: Record<string, unknown> | null;
};

function overlayContent(source: Record<string, unknown>, translation: PageTranslationContent) {
  const resolved = { ...source };
  for (const [key, value] of Object.entries(translation)) {
    if (hasContent(value)) resolved[key] = value;
  }
  delete resolved.translations;
  return resolved;
}

export function resolvePageLocalizedCopy({
  locale,
  source,
  translation,
  legacyTranslation,
}: {
  locale: Locale;
  source: PageSource;
  translation?: PageTranslationRow | null;
  legacyTranslation?: Record<string, unknown> | null;
}) {
  const sourceContent = source.content ?? {};
  if (locale === "en") {
    return { title: source.title, excerpt: source.excerpt ?? "", content: overlayContent(sourceContent, {}) };
  }

  const selected = translation ?? (legacyTranslation ? {
    title: typeof legacyTranslation.title === "string" ? legacyTranslation.title : "",
    excerpt: typeof legacyTranslation.excerpt === "string" ? legacyTranslation.excerpt : "",
    content: legacyTranslation,
  } : null);
  const translatedContent = normalizePageTranslationContent(selected?.content);

  return {
    title: hasContent(selected?.title) ? selected!.title : source.title,
    excerpt: hasContent(selected?.excerpt) ? selected!.excerpt! : source.excerpt ?? "",
    content: overlayContent(sourceContent, translatedContent),
  };
}
