import { z } from "zod";

import type { Locale } from "@/lib/i18n/locales";
import { hasContent } from "@/lib/i18n/localized-content";
import { mergeLocalizedLegalSections } from "@/lib/content/legal-sections";
import {
  blankUntranslatedShopPageCopy,
  SHOP_PAGE_COPY_KEYS,
  type ShopPageCopyKey,
} from "@/lib/content/shop-page-copy";

const materialSchema = z.object({
  name: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  properties: z.string().optional(),
});

const legalSectionSchema = z.object({
  id: z.string().optional(),
  label: z.string().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
});

export const pageTranslationContentSchema = z.object({
  eyebrow: z.string().optional(),
  body: z.string().optional(),
  ctaLabel: z.string().optional(),
  calloutEyebrow: z.string().optional(),
  calloutHeading: z.string().optional(),
  calloutCtaHref: z.string().optional(),
  heroOpeningLabel: z.string().optional(),
  heroCountLabel: z.string().optional(),
  heroQualifier: z.string().optional(),
  detailShopLabel: z.string().optional(),
  detailCollectionsLabel: z.string().optional(),
  detailTeaserEyebrow: z.string().optional(),
  detailTeaserHeading: z.string().optional(),
  detailTeaserShopLabel: z.string().optional(),
  detailCatalogEyebrow: z.string().optional(),
  detailCatalogHeading: z.string().optional(),
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
  finalSecondaryCtaLabel: z.string().optional(),
  finalSecondaryCtaHref: z.string().optional(),
  finalFooterTitle: z.string().optional(),
  finalContactLabel: z.string().optional(),
  legalIntro: z.string().optional(),
  legalLastUpdated: z.string().optional(),
  legalLastUpdatedLabel: z.string().optional(),
  // Array (admin-owned order) or legacy Record<id, {title,body}>.
  legalSections: z.union([
    z.array(legalSectionSchema),
    z.record(z.string(), legalSectionSchema),
  ]).optional(),
  serviceSections: z.union([
    z.array(legalSectionSchema),
    z.record(z.string(), legalSectionSchema),
  ]).optional(),
}).extend(
  Object.fromEntries(SHOP_PAGE_COPY_KEYS.map((key) => [key, z.string().optional()])) as {
    [K in ShopPageCopyKey]: z.ZodOptional<z.ZodString>;
  },
);

export type PageTranslationContent = z.infer<typeof pageTranslationContentSchema>;

export function normalizePageTranslationContent(value: unknown): PageTranslationContent {
  const parsed = pageTranslationContentSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

type PageTranslationRow = {
  title: string;
  localizedHandle?: string | null;
  excerpt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  content?: unknown;
};

type PageSource = {
  title: string;
  excerpt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  content?: Record<string, unknown> | null;
};

type MaterialEntry = {
  name?: string;
  category?: string;
  description?: string;
  properties?: string;
  image?: string;
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
 * Section maps/lists keep source structure. Localized label/title/body overlay
 * field-by-field so a partial translation cannot delete sections.
 * @deprecated Prefer mergeLocalizedLegalSections from legal-sections — kept as
 * a thin re-export for older tests/imports.
 */
export function mergeLocalizedSectionRecord(
  source: unknown,
  translation: unknown,
) {
  return mergeLocalizedLegalSections(source, translation);
}

function selectedPageTranslation(
  translation: PageTranslationRow | null | undefined,
  legacyTranslation: Record<string, unknown> | null | undefined,
): PageTranslationRow | null {
  if (translation) return translation;
  if (!legacyTranslation) return null;
  return {
    title: typeof legacyTranslation.title === "string" ? legacyTranslation.title : "",
    excerpt: typeof legacyTranslation.excerpt === "string" ? legacyTranslation.excerpt : "",
    content: legacyTranslation,
  };
}

/**
 * Eyebrow and excerpt saved for this locale only.
 * An empty translation must not inherit the English string — Terms uses that
 * emptiness to show the locale default. Other pages keep reading `excerpt`
 * and `content.eyebrow`, which still fall back to English.
 */
export function ownedLocalizedPageFields({
  locale,
  source,
  translation,
  legacyTranslation,
}: {
  locale: Locale;
  source: PageSource;
  translation?: PageTranslationRow | null;
  legacyTranslation?: Record<string, unknown> | null;
}): { eyebrow: string; excerpt: string } {
  const sourceContent = source.content ?? {};
  const sourceEyebrow = typeof sourceContent.eyebrow === "string" ? sourceContent.eyebrow : "";
  if (locale === "en") {
    return { eyebrow: sourceEyebrow, excerpt: source.excerpt ?? "" };
  }

  const selected = selectedPageTranslation(translation, legacyTranslation);
  const translatedContent = normalizePageTranslationContent(selected?.content);
  const eyebrow = typeof translatedContent.eyebrow === "string" ? translatedContent.eyebrow : "";
  const excerpt = typeof selected?.excerpt === "string" ? selected.excerpt : "";
  return {
    eyebrow: hasContent(eyebrow) ? eyebrow : "",
    excerpt: hasContent(excerpt) ? excerpt : "",
  };
}

const CATALOG_HEADING_KEYS = ["detailCatalogEyebrow", "detailCatalogHeading"] as const;

/** Collections index/detail labels that fall back to `messages/*.json`, not English admin copy. */
const COLLECTIONS_DICTIONARY_FALLBACK_KEYS = [
  // /collections card CTA under each description (admin: Collection card link label)
  "secondaryBody",
  "heroOpeningLabel",
  "heroCountLabel",
  "heroQualifier",
  "detailShopLabel",
  "detailCollectionsLabel",
  "detailTeaserEyebrow",
  "detailTeaserHeading",
  "detailTeaserShopLabel",
  ...CATALOG_HEADING_KEYS,
] as const;

function blankUntranslatedCatalogHeading(
  content: Record<string, unknown>,
  translation: PageTranslationContent,
) {
  for (const key of CATALOG_HEADING_KEYS) {
    if (!hasContent(translation[key])) content[key] = "";
  }
}

function blankUntranslatedCollectionsCopy(
  content: Record<string, unknown>,
  translation: PageTranslationContent,
) {
  for (const key of COLLECTIONS_DICTIONARY_FALLBACK_KEYS) {
    if (!hasContent(translation[key])) content[key] = "";
  }
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
      const merged = mergeLocalizedLegalSections(source[key], value);
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
  pageSlug,
}: {
  locale: Locale;
  source: PageSource;
  translation?: PageTranslationRow | null;
  legacyTranslation?: Record<string, unknown> | null;
  /** When `collections`, empty locale labels clear English so the storefront dictionary can fill them. */
  pageSlug?: string;
}) {
  const sourceContent = source.content ?? {};
  if (locale === "en") {
    return {
      title: source.title,
      excerpt: source.excerpt ?? "",
      seoTitle: source.seoTitle ?? "",
      seoDescription: source.seoDescription ?? "",
      content: overlayContent(sourceContent, {}),
    };
  }

  const selected = selectedPageTranslation(translation, legacyTranslation);
  const translatedContent = normalizePageTranslationContent(selected?.content);
  const content = overlayContent(sourceContent, translatedContent);
  // The label is per locale. An empty translation must not inherit the English
  // admin string — the storefront then uses that locale's dictionary.
  const sourceLabel = typeof sourceContent.legalLastUpdatedLabel === "string"
    ? sourceContent.legalLastUpdatedLabel
    : undefined;
  if (!hasContent(translatedContent.legalLastUpdatedLabel) && hasContent(sourceLabel)) {
    content.legalLastUpdatedLabel = "";
  }
  // Shop section labels fall back to the active locale's dictionary, not English admin copy.
  blankUntranslatedShopPageCopy(content, translatedContent);
  // Collection catalog heading does the same on every page slug (keys are collections-only).
  blankUntranslatedCatalogHeading(content, translatedContent);
  // Collections index/detail chrome: blank only for the collections page so
  // shared keys like secondaryBody still inherit English on Home/About/Shop.
  if (pageSlug === "collections") {
    blankUntranslatedCollectionsCopy(content, translatedContent);
  }

  return {
    title: hasContent(selected?.title) ? selected!.title : source.title,
    excerpt: hasContent(selected?.excerpt) ? selected!.excerpt! : source.excerpt ?? "",
    seoTitle: hasContent(selected?.seoTitle) ? selected!.seoTitle! : source.seoTitle ?? "",
    seoDescription: hasContent(selected?.seoDescription) ? selected!.seoDescription! : source.seoDescription ?? "",
    content,
  };
}
