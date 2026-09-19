"use server";

import { Prisma } from "@prisma/client";
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
} from "@/lib/shopify/editorial-translation-sync";
import { pushProductToShopify } from "@/lib/shopify/product-sync";
import { ensureTranslationBinding, recordSyncEvent } from "@/lib/shopify/translation-sync";

export type TranslationOverviewEntity = "PRODUCT" | "COLLECTION" | "PAGE" | "STOREFRONT_COPY";

async function syncCollection(collectionId: string, actorUsername: string) {
  const collection = await db.collection.findUnique({
    where: { id: collectionId },
    include: { translations: { where: { locale: "PT" } } },
  });
  if (!collection?.shopifyCollectionId) throw new Error("Collection is not linked to Shopify.");
  const translation = collection.translations[0];
  if (!translation) throw new Error("Portuguese collection translation is missing.");
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
    });
    await Promise.all([
      db.shopifyTranslationBinding.update({
        where: { id: binding.id },
        data: { lastSyncedSnapshot: snapshot as Prisma.InputJsonValue },
      }),
      recordSyncEvent({
        bindingId: binding.id, locale: "PT", direction: "PUSH", status: "SUCCEEDED", actorUsername,
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await Promise.all([
      db.collectionTranslation.update({ where: { id: translation.id }, data: { syncStatus: "FAILED", syncError: message } }),
      recordSyncEvent({
        bindingId: binding.id, locale: "PT", direction: "PUSH", status: "FAILED", error: message, actorUsername,
      }),
    ]);
    throw error;
  }

  const editorialResults = await syncCollectionEditorialTranslation(collection.id, actorUsername);
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

async function recordProductTranslationSync(productId: string, actorUsername: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      shopifyProductId: true,
      translations: {
        where: { locale: "PT" },
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
  if (!translation) throw new Error("Portuguese product translation is missing.");

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
  await Promise.all([
    db.shopifyTranslationBinding.update({
      where: { id: binding.id },
      data: { lastSyncedSnapshot: snapshot as Prisma.InputJsonValue },
    }),
    recordSyncEvent({
      bindingId: binding.id,
      locale: "PT",
      direction: "PUSH",
      status: "SUCCEEDED",
      actorUsername,
    }),
  ]);
}

export async function retryTranslationSyncAction(entityType: TranslationOverviewEntity, entityId: string) {
  const session = await requireAdminSession("/admin/translations");
  if (!hasShopifyAdminConfig()) return { error: "Shopify Admin API credentials are not configured." };

  try {
    if (entityType === "PRODUCT") {
      const result = await pushProductToShopify(entityId, false);
      if (!result.ok) throw new Error(result.error);
      if (result.translationError) throw new Error(result.translationError);
      await recordProductTranslationSync(entityId, session.username);
      const editorialResults = await syncProductEditorialTranslation(entityId, session.username);
      const editorialFailure = editorialResults.find((target) => target.status === "FAILED");
      if (editorialFailure) {
        await db.productTranslation.update({
          where: { productId_locale: { productId: entityId, locale: "PT" } },
          data: { syncStatus: "FAILED", syncError: editorialFailure.error },
        });
        throw new Error(editorialFailure.error);
      }
    } else if (entityType === "COLLECTION") {
      await syncCollection(entityId, session.username);
    } else if (entityType === "PAGE") {
      const results = await syncPageEditorialTranslation(entityId, session.username);
      const failed = results.find((result) => result.status === "FAILED");
      if (failed) throw new Error(failed.error);
    } else {
      const results = await syncStorefrontCopyTranslation(session.username);
      const failed = results.find((result) => result.status === "FAILED");
      if (failed) throw new Error(failed.error);
    }
    revalidatePath("/admin/translations");
    return { success: "Translation synced." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Translation sync failed." };
  }
}
