import { JEWELRY_TAXONOMY_VALUE_TRANSLATIONS } from "@/lib/catalog/shop-facet-labels";
import type { TaxonomyKind } from "@/lib/catalog/taxonomy-value-kinds";
import type { Locale } from "@/lib/i18n/locales";

export type TaxonomyLabelDivergence = {
  divergesFromDictionary: true;
  dictionaryLabel: string;
};

/** Code-dictionary display label for a taxonomy EN value + locale, if any. */
export function taxonomyDictionaryLabel(enValue: string, locale: string): string | undefined {
  const dictionary = JEWELRY_TAXONOMY_VALUE_TRANSLATIONS[locale as Locale];
  const label = dictionary?.[enValue]?.trim();
  return label || undefined;
}

/**
 * When a saved DB label differs from the code dictionary for the same
 * enValue/locale, return the divergence marker; otherwise undefined.
 */
export function taxonomyLabelDivergence(
  enValue: string,
  locale: string,
  savedLabel: string,
): TaxonomyLabelDivergence | undefined {
  const dictionaryLabel = taxonomyDictionaryLabel(enValue, locale);
  if (!dictionaryLabel) return undefined;
  if (savedLabel.trim() === dictionaryLabel) return undefined;
  return { divergesFromDictionary: true, dictionaryLabel };
}

export function emptyTaxonomyDivergenceMaps(): Record<
  TaxonomyKind,
  Record<string, TaxonomyLabelDivergence>
> {
  return { CATEGORY_LEAF: {}, PRODUCT_TYPE: {} };
}
