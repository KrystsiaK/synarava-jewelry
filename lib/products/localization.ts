import type { Locale } from "@/lib/i18n/locales";
import {
  contentCompleteness,
  resolveLocalizedContent,
} from "@/lib/i18n/localized-content";

export type ProductTranslationRecord = {
  locale: string;
  localizedHandle?: string | null;
  title: string;
  shortDescription?: string | null;
  description?: string | null;
  materialLine?: string | null;
  symbolismLabel?: string | null;
  symbolismTitle?: string | null;
  symbolismBody?: string | null;
  symbolismBody2?: string | null;
  details?: unknown;
  seoTitle?: string | null;
  seoDescription?: string | null;
  reviewStatus?: "DRAFT" | "REVIEWED";
  syncStatus?: "NOT_APPLICABLE" | "PENDING" | "SYNCED" | "FAILED" | "CONFLICT";
  syncError?: string | null;
  lastSyncedAt?: Date | string | null;
};

export type LocalizableProduct = {
  name: string;
  shortDescription: string | null;
  description: string | null;
  materialLine: string | null;
  symbolismLabel: string | null;
  symbolismTitle: string | null;
  symbolismBody: string | null;
  symbolismBody2: string | null;
  details: unknown;
  seoTitle: string | null;
  seoDescription: string | null;
  translations?: ProductTranslationRecord[];
};

export type ProductLocalizedCopy = {
  title: string;
  shortDescription: string;
  description: string;
  materialLine: string;
  symbolismLabel: string;
  symbolismTitle: string;
  symbolismBody: string;
  symbolismBody2: string;
  details: unknown;
  seoTitle: string;
  seoDescription: string;
};

const OPTIONAL_PRODUCT_FIELDS: Array<keyof ProductLocalizedCopy> = [
  "materialLine",
  "symbolismLabel",
  "symbolismTitle",
  "symbolismBody",
  "symbolismBody2",
  "details",
  "seoTitle",
  "seoDescription",
];

const REQUIRED_PRODUCT_FIELDS: Array<keyof ProductLocalizedCopy> = [
  "title",
  "shortDescription",
  "description",
];

function sourceCopy(product: LocalizableProduct): ProductLocalizedCopy {
  return {
    title: product.name,
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    materialLine: product.materialLine ?? "",
    symbolismLabel: product.symbolismLabel ?? "",
    symbolismTitle: product.symbolismTitle ?? "",
    symbolismBody: product.symbolismBody ?? "",
    symbolismBody2: product.symbolismBody2 ?? "",
    details: product.details,
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
  };
}

function translatedCopy(translation: ProductTranslationRecord): ProductLocalizedCopy {
  return {
    title: translation.title,
    shortDescription: translation.shortDescription ?? "",
    description: translation.description ?? "",
    materialLine: translation.materialLine ?? "",
    symbolismLabel: translation.symbolismLabel ?? "",
    symbolismTitle: translation.symbolismTitle ?? "",
    symbolismBody: translation.symbolismBody ?? "",
    symbolismBody2: translation.symbolismBody2 ?? "",
    details: translation.details,
    seoTitle: translation.seoTitle ?? "",
    seoDescription: translation.seoDescription ?? "",
  };
}

export function findProductTranslation(product: LocalizableProduct, locale: Locale) {
  return product.translations?.find((translation) => translation.locale === locale) ?? null;
}

export function resolveProductCopy(product: LocalizableProduct, locale: Locale): ProductLocalizedCopy {
  const source = sourceCopy(product);
  if (locale === "en") return source;

  const translation = findProductTranslation(product, locale);
  return resolveLocalizedContent({
    source,
    translation: translation ? translatedCopy(translation) : null,
    optionalFields: OPTIONAL_PRODUCT_FIELDS,
  });
}

export function productLocaleReadiness(product: LocalizableProduct, locale: Locale) {
  if (locale === "en") {
    const completeness = contentCompleteness(sourceCopy(product), REQUIRED_PRODUCT_FIELDS);
    return {
      complete: completeness.complete,
      reviewed: true,
      percent: completeness.percent,
      missing: completeness.missing,
    };
  }

  const translation = findProductTranslation(product, locale);
  const content = translation
    ? translatedCopy(translation)
    : translatedCopy({ locale, title: "" });
  const completeness = contentCompleteness(content, REQUIRED_PRODUCT_FIELDS);
  return {
    complete: completeness.complete,
    reviewed: translation?.reviewStatus === "REVIEWED",
    percent: completeness.percent,
    missing: completeness.missing,
  };
}

type ProductPublishCopy = Pick<ProductLocalizedCopy, "title" | "shortDescription" | "description">;

/** One non-English locale's publish-readiness input: its label (for the missing-fields message), its copy, and whether it's been marked reviewed. */
export type ProductPublishTranslation = {
  label: string;
  copy: ProductPublishCopy;
  reviewed: boolean;
};

export function validateProductPublication({
  isAlreadyPublic,
  english,
  translations,
}: {
  isAlreadyPublic: boolean;
  english: ProductPublishCopy;
  translations: ProductPublishTranslation[];
}) {
  if (isAlreadyPublic) return [];

  const labels: Record<keyof ProductPublishCopy, string> = {
    title: "title",
    shortDescription: "short description",
    description: "description",
  };
  const fields = ["title", "shortDescription", "description"] as const;
  const missing: string[] = [];
  for (const field of fields) {
    if (!(typeof english[field] === "string" && english[field].trim())) {
      missing.push(`English ${labels[field]}`);
    }
    for (const { label, copy } of translations) {
      if (!(typeof copy[field] === "string" && copy[field].trim())) {
        missing.push(`${label} ${labels[field]}`);
      }
    }
  }
  for (const { label, reviewed } of translations) {
    if (!reviewed) missing.push(`${label} review`);
  }
  return missing;
}
