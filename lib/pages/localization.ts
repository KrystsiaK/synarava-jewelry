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

type MaterialEntry = {
  name?: string;
  category?: string;
  description?: string;
  properties?: string;
  image?: string;
};

type SectionEntry = {
  title?: string;
  body?: string;
};

/**
 * Material lexicon structure (count, order, images) is shared across locales.
 * Translation rows only store text; replacing the whole array would drop images
 * and change card count when a locale's text is incomplete — never do that.
 */
export function mergeMaterialLexicon(
  source: unknown,
  translation: unknown,
): MaterialEntry[] | undefined {
  if (!Array.isArray(source)) return undefined;
  const translationEntries = Array.isArray(translation) ? (translation as MaterialEntry[]) : [];

  return (source as MaterialEntry[]).map((entry, index) => {
    const localized = translationEntries[index];
    if (!localized) return { ...entry };

    return {
      image: entry.image,
      name: hasContent(localized.name) ? localized.name : entry.name,
      category: hasContent(localized.category) ? localized.category : entry.category,
      description: hasContent(localized.description) ? localized.description : entry.description,
      properties: hasContent(localized.properties) ? localized.properties : entry.properties,
    };
  });
}

/**
 * Section maps keep source keys (structure). Localized title/body overlay
 * field-by-field so a partial translation cannot delete sections.
 */
export function mergeLocalizedSectionRecord(
  source: unknown,
  translation: unknown,
): Record<string, SectionEntry> | undefined {
  if (!source || typeof source !== "object" || Array.isArray(source)) return undefined;
  const sourceRecord = source as Record<string, SectionEntry>;
  const translationRecord = (
    translation && typeof translation === "object" && !Array.isArray(translation)
      ? translation
      : {}
  ) as Record<string, SectionEntry>;

  return Object.fromEntries(
    Object.keys(sourceRecord).map((id) => {
      const entry = sourceRecord[id] ?? {};
      const localized = translationRecord[id] ?? {};
      return [id, {
        title: hasContent(localized.title) ? localized.title : entry.title,
        body: hasContent(localized.body) ? localized.body : entry.body,
      }];
    }),
  );
}

function overlayContent(source: Record<string, unknown>, translation: PageTranslationContent) {
  const resolved = { ...source };
  for (const [key, value] of Object.entries(translation)) {
    if (key === "materialLexicon") {
      const merged = mergeMaterialLexicon(source.materialLexicon, value);
      if (merged) resolved.materialLexicon = merged;
      continue;
    }
    if (key === "legalSections" || key === "serviceSections") {
      const merged = mergeLocalizedSectionRecord(source[key], value);
      if (merged) resolved[key] = merged;
      continue;
    }
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
