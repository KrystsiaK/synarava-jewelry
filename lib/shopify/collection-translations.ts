import "server-only";

import {
  fetchResourceTranslation,
  fetchTranslatableResourceIndex,
  registerTranslations,
  type RemoteTranslation,
} from "@/lib/shopify/translations";

export type ShopifyCollectionTranslationCopy = {
  handle?: string;
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
  handle: "handle",
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
    handle: values.get("handle") ?? "",
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
  locale: string,
) {
  const values = Object.fromEntries(
    Object.entries(COLLECTION_TRANSLATION_KEYS).map(([localKey, shopifyKey]) => [
      shopifyKey,
      copy[localKey as keyof ShopifyCollectionTranslationCopy],
    ]),
  );
  return registerTranslations({ resourceId, locale, values });
}

export async function fetchCollectionTranslation(resourceId: string, locale: string) {
  const translations = await fetchResourceTranslation(resourceId, locale);
  return translations ? collectionTranslationSnapshot(translations) : null;
}

export async function fetchCollectionTranslationIndex(locale: string) {
  const raw = await fetchTranslatableResourceIndex("COLLECTION", locale);
  const result = new Map<string, ShopifyCollectionTranslationSnapshot | null>();
  for (const [resourceId, translations] of raw) {
    result.set(resourceId, collectionTranslationSnapshot(translations));
  }
  return result;
}
