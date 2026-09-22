import "server-only";

import { db } from "@/lib/db";
import {
  COLLECTION_FIELD_REGISTRY,
  PAGE_FIELD_REGISTRY,
  PRODUCT_FIELD_REGISTRY,
  STOREFRONT_COPY_FIELD_REGISTRY,
  type EntityFieldRegistry,
  localizedFields,
} from "@/lib/i18n/admin-field-registry";
import { normalizePageTranslationContent } from "@/lib/pages/localization";
import { STOREFRONT_COPY_KEY, type StorefrontCopy } from "@/lib/content/storefront-copy";
import {
  ensureEditorialMetaobject,
  registerEditorialMetaobjectTranslation,
} from "@/lib/shopify/editorial-metaobjects";
import { registerPageTranslation } from "@/lib/shopify/page-translations";
import { upsertShopifyPage } from "@/lib/shopify/page-resource";
import { ensureTranslationBinding, recordSyncEvent, saveTranslationSnapshot } from "@/lib/shopify/translation-sync";
import type { StorefrontLocaleRecord } from "@/lib/i18n/storefront-locale-registry";

export type TargetResult = { target: "PAGE" | "METAOBJECT"; status: "SUCCEEDED" | "FAILED"; error?: string };

/** The registry fields these adapters need: the local DB locale code, and the Shopify-side locale to register translations against. */
export type SyncTargetLocale = Pick<StorefrontLocaleRecord, "code" | "shopifyLocale" | "name">;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function pageNativeSnapshot(input: {
  localizedHandle?: string | null;
  title: string;
  body: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
}) {
  return {
    localizedHandle: input.localizedHandle ?? "",
    title: input.title,
    body: input.body,
    seoTitle: input.seoTitle ?? "",
    seoDescription: input.seoDescription ?? "",
  };
}

function pageStructuredValues(excerpt: string | null | undefined, content: unknown) {
  const normalized = normalizePageTranslationContent(content);
  const source: Record<string, unknown> = { excerpt: excerpt ?? "", ...normalized };
  return Object.fromEntries(
    localizedFields(PAGE_FIELD_REGISTRY).flatMap((field) => {
      const target = field.shopifyTarget;
      return target?.kind === "metaobject" && source[field.key] !== undefined
        ? [[target.key, source[field.key]]]
        : [];
    }),
  );
}

function metaobjectValues(registry: EntityFieldRegistry, source: Record<string, unknown>) {
  return Object.fromEntries(
    localizedFields(registry).flatMap((field) => {
      const target = field.shopifyTarget;
      return target?.kind === "metaobject" && source[field.key] !== undefined
        ? [[target.key, source[field.key]]]
        : [];
    }),
  );
}

function metaobjectFieldKeys(registry: EntityFieldRegistry, definition: string) {
  return localizedFields(registry).flatMap((field) => {
    const target = field.shopifyTarget;
    return target?.kind === "metaobject" && target.definition === definition ? [target.key] : [];
  });
}

const PAGE_METAOBJECT_FIELDS = localizedFields(PAGE_FIELD_REGISTRY).flatMap((field) =>
  field.shopifyTarget?.kind === "metaobject" ? [field.shopifyTarget.key] : [],
);

async function recordTargetFailure(bindingId: string, error: unknown, locale: SyncTargetLocale, actorUsername?: string | null) {
  await recordSyncEvent({
    bindingId,
    locale: locale.code,
    direction: "PUSH",
    status: "FAILED",
    error: errorMessage(error),
    actorUsername,
  });
}

async function completeTarget(bindingId: string, snapshot: Record<string, unknown>, locale: SyncTargetLocale, actorUsername?: string | null) {
  await saveTranslationSnapshot({ bindingId, locale: locale.shopifyLocale, values: snapshot });
  await recordSyncEvent({ bindingId, locale: locale.code, direction: "PUSH", status: "SUCCEEDED", actorUsername });
}

/** Syncs PAGE-native copy and structured page copy independently so one target can be retried without replaying the other. */
export async function syncPageEditorialTranslation(pageId: string, locale: SyncTargetLocale, actorUsername?: string | null): Promise<TargetResult[]> {
  const page = await db.page.findUnique({
    where: { id: pageId },
    include: { translations: true },
  });
  if (!page) throw new Error("Page not found.");

  const en = page.translations.find((translation) => translation.locale === "en");
  const translation = page.translations.find((item) => item.locale === locale.code);
  if (!translation) throw new Error(`${locale.name} page translation is missing.`);

  const enContent = normalizePageTranslationContent(en?.content ?? page.content);
  const translationContent = normalizePageTranslationContent(translation.content);
  const shopifyPage = await upsertShopifyPage({
    resourceId: page.shopifyPageId,
    title: en?.title ?? page.title,
    body: enContent.body ?? "",
    handle: page.shopifyHandle ?? page.slug,
    isPublished: page.status === "PUBLISHED" && page.visibility === "PUBLIC",
  });
  if (page.shopifyPageId !== shopifyPage.id || page.shopifyHandle !== shopifyPage.handle) {
    await db.page.update({
      where: { id: page.id },
      data: { shopifyPageId: shopifyPage.id, shopifyHandle: shopifyPage.handle },
    });
  }

  const results: TargetResult[] = [];
  const nativeBinding = await ensureTranslationBinding({
    resourceType: "PAGE",
    entityId: page.id,
    shopifyResourceId: shopifyPage.id,
  });
  const nativeSnapshot = pageNativeSnapshot({
    localizedHandle: translation.localizedHandle,
    title: translation.title,
    body: translationContent.body ?? "",
    seoTitle: translation.seoTitle,
    seoDescription: translation.seoDescription,
  });
  try {
    await registerPageTranslation(shopifyPage.id, {
      handle: nativeSnapshot.localizedHandle,
      title: nativeSnapshot.title,
      bodyHtml: nativeSnapshot.body,
      seoTitle: nativeSnapshot.seoTitle,
      seoDescription: nativeSnapshot.seoDescription,
    }, locale.shopifyLocale);
    await completeTarget(nativeBinding.id, nativeSnapshot, locale, actorUsername);
    results.push({ target: "PAGE", status: "SUCCEEDED" });
  } catch (error) {
    await recordTargetFailure(nativeBinding.id, error, locale, actorUsername);
    results.push({ target: "PAGE", status: "FAILED", error: errorMessage(error) });
  }

  const enStructured = pageStructuredValues(en?.excerpt ?? page.excerpt, en?.content ?? page.content);
  const translationStructured = pageStructuredValues(translation.excerpt, translation.content);
  const metaobject = await ensureEditorialMetaobject({
    definition: "page_section_copy",
    name: "Page section copy",
    handle: `page-${page.slug}`,
    values: enStructured,
    fieldKeys: PAGE_METAOBJECT_FIELDS,
  });
  const structuredEntityId = `${page.id}:page_section_copy`;
  const structuredBinding = await ensureTranslationBinding({
    resourceType: "METAOBJECT",
    entityId: structuredEntityId,
    shopifyResourceId: metaobject.id,
  });
  try {
    await registerEditorialMetaobjectTranslation(metaobject.id, translationStructured, locale.shopifyLocale);
    await completeTarget(structuredBinding.id, translationStructured, locale, actorUsername);
    results.push({ target: "METAOBJECT", status: "SUCCEEDED" });
  } catch (error) {
    await recordTargetFailure(structuredBinding.id, error, locale, actorUsername);
    results.push({ target: "METAOBJECT", status: "FAILED", error: errorMessage(error) });
  }

  const failed = results.find((result) => result.status === "FAILED");
  await db.pageTranslation.update({
    where: { pageId_locale: { pageId: page.id, locale: locale.code } },
    data: {
      syncStatus: failed ? "FAILED" : "SYNCED",
      syncError: failed?.error ?? null,
      lastSyncedAt: failed ? undefined : new Date(),
    },
  });
  return results;
}

export async function syncStorefrontCopyTranslation(
  locale: SyncTargetLocale,
  actorUsername?: string | null,
): Promise<TargetResult[]> {
  const setting = await db.siteSetting.findUnique({ where: { key: STOREFRONT_COPY_KEY } });
  const value = setting?.value as StorefrontCopy | null;
  const englishCopy = value?.en;
  const localizedCopy = value?.[locale.code];
  if (!setting || !englishCopy || !localizedCopy) throw new Error("Storefront copy is missing.");

  const fieldKeys = localizedFields(STOREFRONT_COPY_FIELD_REGISTRY).flatMap((field) =>
    field.shopifyTarget?.kind === "metaobject" ? [field.shopifyTarget.key] : [],
  );
  const metaobject = await ensureEditorialMetaobject({
    definition: "storefront_copy",
    name: "Storefront copy",
    handle: "storefront-copy",
    values: englishCopy,
    fieldKeys,
  });
  const binding = await ensureTranslationBinding({
    resourceType: "METAOBJECT",
    entityId: STOREFRONT_COPY_KEY,
    shopifyResourceId: metaobject.id,
  });
  try {
    await registerEditorialMetaobjectTranslation(metaobject.id, localizedCopy, locale.shopifyLocale);
    await completeTarget(binding.id, localizedCopy, locale, actorUsername);
    return [{ target: "METAOBJECT", status: "SUCCEEDED" }];
  } catch (error) {
    await recordTargetFailure(binding.id, error, locale, actorUsername);
    return [{ target: "METAOBJECT", status: "FAILED", error: errorMessage(error) }];
  }
}

export async function syncProductEditorialTranslation(
  productId: string,
  locale: SyncTargetLocale,
  actorUsername?: string | null,
): Promise<TargetResult[]> {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: { translations: true },
  });
  if (!product) throw new Error("Product not found.");

  const en = product.translations.find((translation) => translation.locale === "en");
  const translation = product.translations.find((item) => item.locale === locale.code);
  if (!translation) throw new Error(`${locale.name} product translation is missing.`);

  const source = {
    shortDescription: en?.shortDescription ?? product.shortDescription,
    materialLine: en?.materialLine ?? product.materialLine,
    symbolismLabel: en?.symbolismLabel ?? product.symbolismLabel,
    symbolismTitle: en?.symbolismTitle ?? product.symbolismTitle,
    symbolismBody: en?.symbolismBody ?? product.symbolismBody,
    symbolismBody2: en?.symbolismBody2 ?? product.symbolismBody2,
    details: en?.details ?? product.details,
  };
  const translated = {
    shortDescription: translation.shortDescription,
    materialLine: translation.materialLine,
    symbolismLabel: translation.symbolismLabel,
    symbolismTitle: translation.symbolismTitle,
    symbolismBody: translation.symbolismBody,
    symbolismBody2: translation.symbolismBody2,
    details: translation.details,
  };
  return syncMetaobjectTarget({
    definition: "product_detail_copy",
    name: "Product detail copy",
    handle: `product-${product.slug}`,
    entityId: `${product.id}:product_detail_copy`,
    source: metaobjectValues(PRODUCT_FIELD_REGISTRY, source),
    translated: metaobjectValues(PRODUCT_FIELD_REGISTRY, translated),
    fieldKeys: metaobjectFieldKeys(PRODUCT_FIELD_REGISTRY, "product_detail_copy"),
    locale,
    actorUsername,
  });
}

export async function syncCollectionEditorialTranslation(
  collectionId: string,
  locale: SyncTargetLocale,
  actorUsername?: string | null,
): Promise<TargetResult[]> {
  const collection = await db.collection.findUnique({
    where: { id: collectionId },
    include: { translations: true },
  });
  if (!collection) throw new Error("Collection not found.");

  const en = collection.translations.find((translation) => translation.locale === "en");
  const translation = collection.translations.find((item) => item.locale === locale.code);
  if (!translation) throw new Error(`${locale.name} collection translation is missing.`);

  const source = {
    subtitle: en?.subtitle ?? collection.subtitle,
    manifesto: en?.manifesto ?? collection.manifesto,
    symbolismLabel: en?.symbolismLabel ?? collection.symbolismLabel,
    symbolismTitle: en?.symbolismTitle ?? collection.symbolismTitle,
    symbolismBody: en?.symbolismBody ?? collection.symbolismBody,
    symbolismBody2: en?.symbolismBody2 ?? collection.symbolismBody2,
    searchSummary: en?.searchSummary ?? collection.searchSummary,
  };
  const translated = {
    subtitle: translation.subtitle,
    manifesto: translation.manifesto,
    symbolismLabel: translation.symbolismLabel,
    symbolismTitle: translation.symbolismTitle,
    symbolismBody: translation.symbolismBody,
    symbolismBody2: translation.symbolismBody2,
    searchSummary: translation.searchSummary,
  };
  return syncMetaobjectTarget({
    definition: "collection_section_copy",
    name: "Collection section copy",
    handle: `collection-${collection.slug}`,
    entityId: `${collection.id}:collection_section_copy`,
    source: metaobjectValues(COLLECTION_FIELD_REGISTRY, source),
    translated: metaobjectValues(COLLECTION_FIELD_REGISTRY, translated),
    fieldKeys: metaobjectFieldKeys(COLLECTION_FIELD_REGISTRY, "collection_section_copy"),
    locale,
    actorUsername,
  });
}

async function syncMetaobjectTarget({
  definition,
  name,
  handle,
  entityId,
  source,
  translated,
  fieldKeys,
  locale,
  actorUsername,
}: {
  definition: string;
  name: string;
  handle: string;
  entityId: string;
  source: Record<string, unknown>;
  translated: Record<string, unknown>;
  fieldKeys: string[];
  locale: SyncTargetLocale;
  actorUsername?: string | null;
}): Promise<TargetResult[]> {
  const metaobject = await ensureEditorialMetaobject({ definition, name, handle, values: source, fieldKeys });
  const binding = await ensureTranslationBinding({
    resourceType: "METAOBJECT",
    entityId,
    shopifyResourceId: metaobject.id,
  });
  try {
    await registerEditorialMetaobjectTranslation(metaobject.id, translated, locale.shopifyLocale);
    await completeTarget(binding.id, translated, locale, actorUsername);
    return [{ target: "METAOBJECT", status: "SUCCEEDED" }];
  } catch (error) {
    await recordTargetFailure(binding.id, error, locale, actorUsername);
    return [{ target: "METAOBJECT", status: "FAILED", error: errorMessage(error) }];
  }
}
