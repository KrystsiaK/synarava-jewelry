import "server-only";

import { SHOPIFY_PORTUGUESE_ADMIN_LOCALE } from "@/lib/shopify/locales";
import {
  fetchResourceTranslation,
  fetchTranslatableResourceIndex,
  registerTranslations,
  type RemoteTranslation,
} from "@/lib/shopify/translations";

export type ShopifyCollectionTranslationCopy = {
  name: string;
  descriptionHtml: string;
  seoTitle: string;
  seoDescription: string;
};

export type ShopifyCollectionTranslationSnapshot = ShopifyCollectionTranslationCopy & {
  updatedAt: string | null;
  outdated: boolean;
};

const COLLECTION_TRANSLATION_KEYS = {
  name: "title",
  descriptionHtml: "body_html",
  seoTitle: "meta_title",
  seoDescription: "meta_description",
} as const;

function collectionTranslationSnapshot(translations: RemoteTranslation[]): ShopifyCollectionTranslationSnapshot | null {
  const values = new Map(translations.map((translation) => [translation.key, translation.value]));
  if (values.size === 0) return null;
  const updatedAt = translations.reduce<string | null>((latest, translation) => {
    if (!latest || new Date(translation.updatedAt).getTime() > new Date(latest).getTime()) {
      return new Date(translation.updatedAt).toISOString();
    }
    return latest;
  }, null);
  return {
    name: values.get("title") ?? "",
    descriptionHtml: values.get("body_html") ?? "",
    seoTitle: values.get("meta_title") ?? "",
    seoDescription: values.get("meta_description") ?? "",
    updatedAt,
    outdated: translations.some((translation) => translation.outdated),
  };
}

export async function registerCollectionTranslation(
  resourceId: string,
  copy: ShopifyCollectionTranslationCopy,
) {
  const values = Object.fromEntries(
    Object.entries(COLLECTION_TRANSLATION_KEYS).map(([localKey, shopifyKey]) => [
      shopifyKey,
      copy[localKey as keyof ShopifyCollectionTranslationCopy],
    ]),
  );
  return registerTranslations({ resourceId, locale: SHOPIFY_PORTUGUESE_ADMIN_LOCALE, values });
}

export async function fetchCollectionTranslation(resourceId: string) {
  const translations = await fetchResourceTranslation(resourceId, SHOPIFY_PORTUGUESE_ADMIN_LOCALE);
  return translations ? collectionTranslationSnapshot(translations) : null;
}

export async function fetchCollectionTranslationIndex() {
  const raw = await fetchTranslatableResourceIndex("COLLECTION", SHOPIFY_PORTUGUESE_ADMIN_LOCALE);
  const result = new Map<string, ShopifyCollectionTranslationSnapshot | null>();
  for (const [resourceId, translations] of raw) {
    result.set(resourceId, collectionTranslationSnapshot(translations));
  }
  return result;
}
