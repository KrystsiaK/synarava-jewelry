import "server-only";

import { SHOPIFY_PORTUGUESE_ADMIN_LOCALE } from "@/lib/shopify/locales";
import {
  fetchResourceTranslation,
  registerTranslations,
  type RemoteTranslation,
} from "@/lib/shopify/translations";

export type ShopifyPageTranslationCopy = {
  handle?: string;
  title: string;
  bodyHtml: string;
  seoTitle: string;
  seoDescription: string;
};

export type ShopifyPageTranslationSnapshot = ShopifyPageTranslationCopy & {
  updatedAt: string | null;
  outdated: boolean;
};

const PAGE_TRANSLATION_KEYS = {
  handle: "handle",
  title: "title",
  bodyHtml: "body_html",
  seoTitle: "meta_title",
  seoDescription: "meta_description",
} as const;

function pageTranslationSnapshot(
  translations: RemoteTranslation[],
): ShopifyPageTranslationSnapshot | null {
  if (translations.length === 0) return null;
  const values = new Map(translations.map((translation) => [translation.key, translation.value]));
  const updatedAt = translations.reduce<string | null>((latest, translation) => {
    if (!latest || Date.parse(translation.updatedAt) > Date.parse(latest)) {
      return new Date(translation.updatedAt).toISOString();
    }
    return latest;
  }, null);

  return {
    handle: values.get("handle") ?? "",
    title: values.get("title") ?? "",
    bodyHtml: values.get("body_html") ?? "",
    seoTitle: values.get("meta_title") ?? "",
    seoDescription: values.get("meta_description") ?? "",
    updatedAt,
    outdated: translations.some((translation) => translation.outdated),
  };
}

export async function registerPageTranslation(resourceId: string, copy: ShopifyPageTranslationCopy) {
  const values = Object.fromEntries(
    Object.entries(PAGE_TRANSLATION_KEYS).map(([localKey, shopifyKey]) => [
      shopifyKey,
      copy[localKey as keyof ShopifyPageTranslationCopy],
    ]),
  );
  return registerTranslations({
    resourceId,
    locale: SHOPIFY_PORTUGUESE_ADMIN_LOCALE,
    values,
  });
}

export async function fetchPageTranslation(resourceId: string) {
  const translations = await fetchResourceTranslation(resourceId, SHOPIFY_PORTUGUESE_ADMIN_LOCALE);
  return translations ? pageTranslationSnapshot(translations) : null;
}
