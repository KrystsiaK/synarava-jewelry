import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import {
  PAGE_FIELD_REGISTRY,
  STOREFRONT_COPY_FIELD_REGISTRY,
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
import { ensureTranslationBinding, recordSyncEvent } from "@/lib/shopify/translation-sync";

type TargetResult = { target: "PAGE" | "METAOBJECT"; status: "SUCCEEDED" | "FAILED"; error?: string };

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

const PAGE_METAOBJECT_FIELDS = localizedFields(PAGE_FIELD_REGISTRY).flatMap((field) =>
  field.shopifyTarget?.kind === "metaobject" ? [field.shopifyTarget.key] : [],
);

async function recordTargetFailure(bindingId: string, error: unknown, actorUsername?: string | null) {
  await recordSyncEvent({
    bindingId,
    locale: "PT",
    direction: "PUSH",
    status: "FAILED",
    error: errorMessage(error),
    actorUsername,
  });
}

async function completeTarget(bindingId: string, snapshot: Record<string, unknown>, actorUsername?: string | null) {
  await db.shopifyTranslationBinding.update({
    where: { id: bindingId },
    data: { lastSyncedSnapshot: snapshot as Prisma.InputJsonValue },
  });
  await recordSyncEvent({ bindingId, locale: "PT", direction: "PUSH", status: "SUCCEEDED", actorUsername });
}

/** Syncs PAGE-native copy and structured page copy independently so one target can be retried without replaying the other. */
export async function syncPageEditorialTranslation(pageId: string, actorUsername?: string | null): Promise<TargetResult[]> {
  const page = await db.page.findUnique({
    where: { id: pageId },
    include: { translations: true },
  });
  if (!page) throw new Error("Page not found.");

  const en = page.translations.find((translation) => translation.locale === "EN");
  const pt = page.translations.find((translation) => translation.locale === "PT");
  if (!pt) throw new Error("Portuguese page translation is missing.");

  const enContent = normalizePageTranslationContent(en?.content ?? page.content);
  const ptContent = normalizePageTranslationContent(pt.content);
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
    localizedHandle: pt.localizedHandle,
    title: pt.title,
    body: ptContent.body ?? "",
    seoTitle: pt.seoTitle,
    seoDescription: pt.seoDescription,
  });
  try {
    await registerPageTranslation(shopifyPage.id, {
      handle: nativeSnapshot.localizedHandle,
      title: nativeSnapshot.title,
      bodyHtml: nativeSnapshot.body,
      seoTitle: nativeSnapshot.seoTitle,
      seoDescription: nativeSnapshot.seoDescription,
    });
    await completeTarget(nativeBinding.id, nativeSnapshot, actorUsername);
    results.push({ target: "PAGE", status: "SUCCEEDED" });
  } catch (error) {
    await recordTargetFailure(nativeBinding.id, error, actorUsername);
    results.push({ target: "PAGE", status: "FAILED", error: errorMessage(error) });
  }

  const enStructured = pageStructuredValues(en?.excerpt ?? page.excerpt, en?.content ?? page.content);
  const ptStructured = pageStructuredValues(pt.excerpt, pt.content);
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
    await registerEditorialMetaobjectTranslation(metaobject.id, ptStructured);
    await completeTarget(structuredBinding.id, ptStructured, actorUsername);
    results.push({ target: "METAOBJECT", status: "SUCCEEDED" });
  } catch (error) {
    await recordTargetFailure(structuredBinding.id, error, actorUsername);
    results.push({ target: "METAOBJECT", status: "FAILED", error: errorMessage(error) });
  }

  const failed = results.find((result) => result.status === "FAILED");
  await db.pageTranslation.update({
    where: { pageId_locale: { pageId: page.id, locale: "PT" } },
    data: {
      syncStatus: failed ? "FAILED" : "SYNCED",
      syncError: failed?.error ?? null,
      lastSyncedAt: failed ? undefined : new Date(),
    },
  });
  return results;
}

export async function syncStorefrontCopyTranslation(actorUsername?: string | null): Promise<TargetResult[]> {
  const setting = await db.siteSetting.findUnique({ where: { key: STOREFRONT_COPY_KEY } });
  const value = setting?.value as StorefrontCopy | null;
  if (!setting || !value?.en || !value?.pt) throw new Error("Storefront copy is missing.");

  const fieldKeys = localizedFields(STOREFRONT_COPY_FIELD_REGISTRY).flatMap((field) =>
    field.shopifyTarget?.kind === "metaobject" ? [field.shopifyTarget.key] : [],
  );
  const metaobject = await ensureEditorialMetaobject({
    definition: "storefront_copy",
    name: "Storefront copy",
    handle: "storefront-copy",
    values: value.en,
    fieldKeys,
  });
  const binding = await ensureTranslationBinding({
    resourceType: "METAOBJECT",
    entityId: STOREFRONT_COPY_KEY,
    shopifyResourceId: metaobject.id,
  });
  try {
    await registerEditorialMetaobjectTranslation(metaobject.id, value.pt);
    await completeTarget(binding.id, value.pt, actorUsername);
    return [{ target: "METAOBJECT", status: "SUCCEEDED" }];
  } catch (error) {
    await recordTargetFailure(binding.id, error, actorUsername);
    return [{ target: "METAOBJECT", status: "FAILED", error: errorMessage(error) }];
  }
}
