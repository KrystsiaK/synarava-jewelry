import type { Locale } from "@/lib/i18n/locales";
import { storefrontLocaleToContentLocale } from "@/lib/i18n/localized-content";
import { COLLECTION_FIELD_REGISTRY } from "@/lib/i18n/admin-field-registry";
import {
  entityLocaleReadiness,
  missingRequiredForPublish,
  resolveEntityLocale,
} from "@/lib/i18n/admin-localization";

// First entity to route through the generic Phase 1 contract instead of
// hand-rolling its own resolve/readiness pair (compare lib/products/
// localization.ts, which predates the registry and duplicates this logic).

export type CollectionTranslationRecord = {
  locale: "EN" | "PT";
  name: string;
  description?: string | null;
  manifesto?: string | null;
  symbolismLabel?: string | null;
  symbolismTitle?: string | null;
  symbolismBody?: string | null;
  symbolismBody2?: string | null;
  searchSummary?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  reviewStatus?: "DRAFT" | "REVIEWED";
  syncStatus?: "NOT_APPLICABLE" | "PENDING" | "SYNCED" | "FAILED" | "CONFLICT";
  syncError?: string | null;
  lastSyncedAt?: Date | string | null;
};

export type LocalizableCollection = {
  name: string;
  description: string | null;
  manifesto: string | null;
  symbolismLabel: string | null;
  symbolismTitle: string | null;
  symbolismBody: string | null;
  symbolismBody2: string | null;
  searchSummary: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  translations?: CollectionTranslationRecord[];
};

export type CollectionLocalizedCopy = {
  name: string;
  description: string;
  manifesto: string;
  symbolismLabel: string;
  symbolismTitle: string;
  symbolismBody: string;
  symbolismBody2: string;
  searchSummary: string;
  seoTitle: string;
  seoDescription: string;
};

function sourceCopy(collection: LocalizableCollection): CollectionLocalizedCopy {
  return {
    name: collection.name,
    description: collection.description ?? "",
    manifesto: collection.manifesto ?? "",
    symbolismLabel: collection.symbolismLabel ?? "",
    symbolismTitle: collection.symbolismTitle ?? "",
    symbolismBody: collection.symbolismBody ?? "",
    symbolismBody2: collection.symbolismBody2 ?? "",
    searchSummary: collection.searchSummary ?? "",
    seoTitle: collection.seoTitle ?? "",
    seoDescription: collection.seoDescription ?? "",
  };
}

function translatedCopy(translation: CollectionTranslationRecord): CollectionLocalizedCopy {
  return {
    name: translation.name,
    description: translation.description ?? "",
    manifesto: translation.manifesto ?? "",
    symbolismLabel: translation.symbolismLabel ?? "",
    symbolismTitle: translation.symbolismTitle ?? "",
    symbolismBody: translation.symbolismBody ?? "",
    symbolismBody2: translation.symbolismBody2 ?? "",
    searchSummary: translation.searchSummary ?? "",
    seoTitle: translation.seoTitle ?? "",
    seoDescription: translation.seoDescription ?? "",
  };
}

export function findCollectionTranslation(collection: LocalizableCollection, locale: Locale) {
  const persistedLocale = storefrontLocaleToContentLocale(locale);
  return collection.translations?.find((translation) => translation.locale === persistedLocale) ?? null;
}

export function resolveCollectionCopy(collection: LocalizableCollection, locale: Locale): CollectionLocalizedCopy {
  const source = sourceCopy(collection);
  if (locale === "en") return source;

  const translation = findCollectionTranslation(collection, locale);
  return resolveEntityLocale(COLLECTION_FIELD_REGISTRY, source, translation ? translatedCopy(translation) : null);
}

export function collectionLocaleReadiness(collection: LocalizableCollection, locale: Locale, { published }: { published: boolean }) {
  if (locale === "en") {
    const completeness = entityLocaleReadiness(COLLECTION_FIELD_REGISTRY, sourceCopy(collection), { published });
    return { complete: completeness.complete, reviewed: true, percent: completeness.percent, missing: completeness.missing };
  }

  const translation = findCollectionTranslation(collection, locale);
  const content = translation ? translatedCopy(translation) : translatedCopy({ locale: "PT", name: "" });
  const completeness = entityLocaleReadiness(COLLECTION_FIELD_REGISTRY, content, { published });
  return {
    complete: completeness.complete,
    reviewed: translation?.reviewStatus === "REVIEWED",
    percent: completeness.percent,
    missing: completeness.missing,
  };
}

export function validateCollectionPublication({
  isAlreadyPublic,
  english,
  portuguese,
  portugueseReviewed,
}: {
  isAlreadyPublic: boolean;
  english: CollectionLocalizedCopy;
  portuguese: CollectionLocalizedCopy;
  portugueseReviewed: boolean;
}): string[] {
  return missingRequiredForPublish(COLLECTION_FIELD_REGISTRY, english, portuguese, {
    portugueseReviewed,
    isAlreadyPublic,
  });
}
