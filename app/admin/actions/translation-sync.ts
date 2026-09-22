"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db";
import { hasShopifyAdminConfig } from "@/lib/shopify/admin";
import { registerCollectionTranslation } from "@/lib/shopify/collection-translations";
import {
  syncCollectionEditorialTranslation,
  syncPageEditorialTranslation,
  syncProductEditorialTranslation,
  syncStorefrontCopyTranslation,
  type SyncTargetLocale,
} from "@/lib/shopify/editorial-translation-sync";
import { invalidateStorefrontLocaleCache } from "@/lib/i18n/storefront-locale-cache";
import { listStorefrontLocales } from "@/lib/i18n/storefront-locale-registry";
import { syncStorefrontLocalesFromShopify } from "@/lib/shopify/storefront-locale-sync";
import { registerProductTranslation } from "@/lib/shopify/translations";
import { ensureTranslationBinding, recordSyncEvent, saveTranslationSnapshot } from "@/lib/shopify/translation-sync";

export type TranslationOverviewEntity = "PRODUCT" | "COLLECTION" | "PAGE" | "STOREFRONT_COPY";

/** Resolves the registered locale to sync, defaulting to the first published translation locale (today, always Portuguese) when the caller doesn't request one — same default every editor used before the registry drove this. */
async function resolveSyncTargetLocale(requestedCode?: string): Promise<SyncTargetLocale> {
  const locales = (await listStorefrontLocales()).filter((locale) => !locale.isDefault);
  const locale = requestedCode
    ? locales.find((item) => item.code === requestedCode)
    : locales[0];
  if (!locale) {
    throw new Error(requestedCode ? `Locale "${requestedCode}" is not registered.` : "No translation locale is registered.");
  }
  return locale;
}

async function syncCollection(collectionId: string, locale: SyncTargetLocale, actorUsername: string) {
  const collection = await db.collection.findUnique({
    where: { id: collectionId },
    include: { translations: { where: { locale: locale.code } } },
  });
  if (!collection?.shopifyCollectionId) throw new Error("Collection is not linked to Shopify.");
  const translation = collection.translations[0];
  if (!translation) throw new Error(`${locale.name} collection translation is missing.`);
  const binding = await ensureTranslationBinding({
    resourceType: "COLLECTION",
    entityId: collection.id,
    shopifyResourceId: collection.shopifyCollectionId,
  });
  const snapshot = {
    localizedHandle: translation.localizedHandle ?? "",
    name: translation.name,
    description: translation.description ?? "",
    seoTitle: translation.seoTitle ?? "",
    seoDescription: translation.seoDescription ?? "",
  };
  try {
    await registerCollectionTranslation(collection.shopifyCollectionId, {
      handle: snapshot.localizedHandle,
      name: snapshot.name,
      descriptionHtml: snapshot.description,
      seoTitle: snapshot.seoTitle,
      seoDescription: snapshot.seoDescription,
    }, locale.shopifyLocale);
    await Promise.all([
      saveTranslationSnapshot({ bindingId: binding.id, locale: locale.shopifyLocale, values: snapshot }),
      recordSyncEvent({
        bindingId: binding.id, locale: locale.code, direction: "PUSH", status: "SUCCEEDED", actorUsername,
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await Promise.all([
      db.collectionTranslation.update({ where: { id: translation.id }, data: { syncStatus: "FAILED", syncError: message } }),
      recordSyncEvent({
        bindingId: binding.id, locale: locale.code, direction: "PUSH", status: "FAILED", error: message, actorUsername,
      }),
    ]);
    throw error;
  }

  const editorialResults = await syncCollectionEditorialTranslation(collection.id, locale, actorUsername);
  const editorialFailure = editorialResults.find((result) => result.status === "FAILED");
  if (editorialFailure) {
    await db.collectionTranslation.update({
      where: { id: translation.id },
      data: { syncStatus: "FAILED", syncError: editorialFailure.error },
    });
    throw new Error(editorialFailure.error);
  }
  await db.collectionTranslation.update({
    where: { id: translation.id },
    data: { syncStatus: "SYNCED", syncError: null, lastSyncedAt: new Date() },
  });
}

async function syncProductNativeTranslation(productId: string, locale: SyncTargetLocale, actorUsername: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      shopifyProductId: true,
      translations: {
        where: { locale: locale.code },
        select: {
          localizedHandle: true,
          title: true,
          description: true,
          seoTitle: true,
          seoDescription: true,
        },
      },
    },
  });
  if (!product?.shopifyProductId) throw new Error("Product is not linked to Shopify.");
  const translation = product.translations[0];
  if (!translation) throw new Error(`${locale.name} product translation is missing.`);

  const binding = await ensureTranslationBinding({
    resourceType: "PRODUCT",
    entityId: productId,
    shopifyResourceId: product.shopifyProductId,
  });
  const snapshot = {
    localizedHandle: translation.localizedHandle ?? "",
    title: translation.title,
    description: translation.description ?? "",
    seoTitle: translation.seoTitle ?? "",
    seoDescription: translation.seoDescription ?? "",
  };
  try {
    await registerProductTranslation(product.shopifyProductId, {
      handle: snapshot.localizedHandle,
      title: snapshot.title,
      descriptionHtml: snapshot.description,
      seoTitle: snapshot.seoTitle,
      seoDescription: snapshot.seoDescription,
    }, locale.shopifyLocale);
    await Promise.all([
      saveTranslationSnapshot({ bindingId: binding.id, locale: locale.shopifyLocale, values: snapshot }),
      recordSyncEvent({
        bindingId: binding.id,
        locale: locale.code,
        direction: "PUSH",
        status: "SUCCEEDED",
        actorUsername,
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await Promise.all([
      db.productTranslation.update({
        where: { productId_locale: { productId, locale: locale.code } },
        data: { syncStatus: "FAILED", syncError: message },
      }),
      recordSyncEvent({
        bindingId: binding.id,
        locale: locale.code,
        direction: "PUSH",
        status: "FAILED",
        error: message,
        actorUsername,
      }),
    ]);
    throw error;
  }
}

/** `localeCode` selects which registered translation locale to sync; omit it to use the first published one (today, always Portuguese) — every caller before the registry drove this synced exactly one locale. */
export async function retryTranslationSyncAction(entityType: TranslationOverviewEntity, entityId: string, localeCode?: string) {
  const session = await requireAdminSession("/admin/translations");
  if (!hasShopifyAdminConfig()) return { error: "Shopify Admin API credentials are not configured." };

  try {
    const locale = await resolveSyncTargetLocale(localeCode);
    if (entityType === "STOREFRONT_COPY") {
      const results = await syncStorefrontCopyTranslation(locale, session.username);
      const failed = results.find((result) => result.status === "FAILED");
      if (failed) throw new Error(failed.error);
      revalidatePath("/admin/translations");
      return { success: "Translation synced." };
    }

    if (entityType === "PRODUCT") {
      await syncProductNativeTranslation(entityId, locale, session.username);
      const editorialResults = await syncProductEditorialTranslation(entityId, locale, session.username);
      const editorialFailure = editorialResults.find((target) => target.status === "FAILED");
      if (editorialFailure) {
        await db.productTranslation.update({
          where: { productId_locale: { productId: entityId, locale: locale.code } },
          data: { syncStatus: "FAILED", syncError: editorialFailure.error },
        });
        throw new Error(editorialFailure.error);
      }
      await db.productTranslation.update({
        where: { productId_locale: { productId: entityId, locale: locale.code } },
        data: { syncStatus: "SYNCED", syncError: null, lastSyncedAt: new Date() },
      });
    } else if (entityType === "COLLECTION") {
      await syncCollection(entityId, locale, session.username);
    } else {
      const results = await syncPageEditorialTranslation(entityId, locale, session.username);
      const failed = results.find((result) => result.status === "FAILED");
      if (failed) throw new Error(failed.error);
    }
    revalidatePath("/admin/translations");
    return { success: "Translation synced." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Translation sync failed." };
  }
}

export async function syncStorefrontLocalesAction() {
  await requireAdminSession("/admin/translations");
  if (!hasShopifyAdminConfig()) return { error: "Shopify Admin API credentials are not configured." };

  try {
    const result = await syncStorefrontLocalesFromShopify();
    invalidateStorefrontLocaleCache();
    revalidatePath("/admin/translations");
    const summary = `Checked ${result.updated.length} locale${result.updated.length === 1 ? "" : "s"} against Shopify.`;
    return {
      success: result.unmatched.length > 0
        ? `${summary} Shopify has ${result.unmatched.length} more not yet in the registry.`
        : summary,
      unmatched: result.unmatched,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Locale sync failed." };
  }
}
