import en from "@/messages/en.json";
import pt from "@/messages/pt.json";
import ru from "@/messages/ru.json";
import type { Locale } from "@/lib/i18n/locales";

const SHIPPED_COLLECTION_LABEL: Record<Locale, string> = {
  en: en.home.archive.collection,
  pt: pt.home.archive.collection,
  ru: ru.home.archive.collection,
};

/** Shipped dictionary label for the Collection / Coleção / Коллекция chrome word. */
export function shippedCollectionEyebrowLabel(locale: Locale): string {
  return SHIPPED_COLLECTION_LABEL[locale] ?? SHIPPED_COLLECTION_LABEL.en;
}

/**
 * Technical series eyebrow from catalog sort order.
 * Uses the localized Collection word so `/ru` never shows English “Collection 02”.
 */
export function formatCollectionEyebrow(
  sortOrder: number | null | undefined,
  collectionLabel: string,
): string {
  const label = collectionLabel.trim() || SHIPPED_COLLECTION_LABEL.en;
  if (!Number.isFinite(sortOrder) || (sortOrder ?? 0) <= 0) {
    return label;
  }
  return `${label} ${String(sortOrder).padStart(2, "0")}`;
}
