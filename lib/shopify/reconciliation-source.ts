import "server-only";

import { Prisma, type TranslationResourceType } from "@prisma/client";

import { STOREFRONT_COPY_KEY, type StorefrontCopy } from "@/lib/content/storefront-copy";
import { db } from "@/lib/db";
import {
  COLLECTION_FIELD_REGISTRY,
  PAGE_FIELD_REGISTRY,
  PRODUCT_FIELD_REGISTRY,
  STOREFRONT_COPY_FIELD_REGISTRY,
  type EntityFieldRegistry,
} from "@/lib/i18n/admin-field-registry";
import type { LocalizedRecord } from "@/lib/i18n/admin-localization";
import { shopifyValueForLocal } from "@/lib/i18n/sync-comparison";
import { normalizePageTranslationContent } from "@/lib/pages/localization";

export type ReconcileBindingSource = {
  id: string;
  resourceType: TranslationResourceType;
  entityId: string;
  shopifyResourceId: string;
  lastSyncedSnapshot: unknown;
};

export type ReconcileSubject = {
  rootEntityType: "PRODUCT" | "COLLECTION" | "PAGE" | "STOREFRONT_COPY";
  rootEntityId: string;
  label: string;
  registry: EntityFieldRegistry;
  local: LocalizedRecord;
};

function registryForTarget(
  registry: EntityFieldRegistry,
  target: "native" | "metaobject",
  definition?: string,
): EntityFieldRegistry {
  return {
    entity: registry.entity,
    fields: registry.fields.filter((field) => {
      const shopifyTarget = field.shopifyTarget;
      if (field.mode !== "localized" || shopifyTarget?.kind !== target) return false;
      return shopifyTarget.kind !== "metaobject" || shopifyTarget.definition === definition;
    }),
  };
}

function productCopy(translation: Record<string, unknown>) {
  return {
    title: translation.title,
    localizedHandle: translation.localizedHandle,
    shortDescription: translation.shortDescription,
    description: translation.description,
    materialLine: translation.materialLine,
    symbolismLabel: translation.symbolismLabel,
    symbolismTitle: translation.symbolismTitle,
    symbolismBody: translation.symbolismBody,
    symbolismBody2: translation.symbolismBody2,
    details: translation.details,
    seoTitle: translation.seoTitle,
    seoDescription: translation.seoDescription,
  };
}

function productSourceCopy(product: Record<string, unknown>) {
  return productCopy({ ...product, title: product.name, localizedHandle: product.slug });
}

function collectionCopy(translation: Record<string, unknown>) {
  return {
    name: translation.name,
    localizedHandle: translation.localizedHandle,
    subtitle: translation.subtitle,
    description: translation.description,
    manifesto: translation.manifesto,
    symbolismLabel: translation.symbolismLabel,
    symbolismTitle: translation.symbolismTitle,
    symbolismBody: translation.symbolismBody,
    symbolismBody2: translation.symbolismBody2,
    searchSummary: translation.searchSummary,
    seoTitle: translation.seoTitle,
    seoDescription: translation.seoDescription,
  };
}

function collectionSourceCopy(collection: Record<string, unknown>) {
  return collectionCopy({ ...collection, localizedHandle: collection.slug });
}

function pageCopy(translation: Record<string, unknown>) {
  return {
    title: translation.title,
    localizedHandle: translation.localizedHandle,
    excerpt: translation.excerpt,
    ...normalizePageTranslationContent(translation.content),
    seoTitle: translation.seoTitle,
    seoDescription: translation.seoDescription,
  };
}

function pageSourceCopy(page: Record<string, unknown>) {
  return pageCopy({ ...page, localizedHandle: page.slug });
}

export function contentLocaleForShopify(locale: string): string {
  if (locale.toLowerCase().startsWith("en")) return "en";
  if (locale.toLowerCase().startsWith("pt")) return "pt";
  throw new Error(`Locale ${locale} is not supported by the Synarava translation editor.`);
}

function rootIdForMetaobject(entityId: string, definition: string) {
  const suffix = `:${definition}`;
  return entityId.endsWith(suffix) ? entityId.slice(0, -suffix.length) : null;
}

export async function loadReconcileSubject(
  binding: ReconcileBindingSource,
  locale = "pt-PT",
): Promise<ReconcileSubject | null> {
  const contentLocale = contentLocaleForShopify(locale);
  const english = contentLocale === "en";
  if (binding.resourceType === "PRODUCT") {
    const product = await db.product.findUnique({
      where: { id: binding.entityId },
      include: { translations: { where: { locale: contentLocale }, take: 1 } },
    });
    const translation = product?.translations[0];
    return product && (english || translation) ? {
      rootEntityType: "PRODUCT",
      rootEntityId: product.id,
      label: product.name,
      registry: registryForTarget(PRODUCT_FIELD_REGISTRY, "native"),
      local: english
        ? productSourceCopy(product as unknown as Record<string, unknown>)
        : productCopy(translation as unknown as Record<string, unknown>),
    } : null;
  }

  if (binding.resourceType === "COLLECTION") {
    const collection = await db.collection.findUnique({
      where: { id: binding.entityId },
      include: { translations: { where: { locale: contentLocale }, take: 1 } },
    });
    const translation = collection?.translations[0];
    return collection && (english || translation) ? {
      rootEntityType: "COLLECTION",
      rootEntityId: collection.id,
      label: collection.name,
      registry: registryForTarget(COLLECTION_FIELD_REGISTRY, "native"),
      local: english
        ? collectionSourceCopy(collection as unknown as Record<string, unknown>)
        : collectionCopy(translation as unknown as Record<string, unknown>),
    } : null;
  }

  if (binding.resourceType === "PAGE") {
    const page = await db.page.findUnique({
      where: { id: binding.entityId },
      include: { translations: { where: { locale: contentLocale }, take: 1 } },
    });
    const translation = page?.translations[0];
    return page && (english || translation) ? {
      rootEntityType: "PAGE",
      rootEntityId: page.id,
      label: page.title,
      registry: registryForTarget(PAGE_FIELD_REGISTRY, "native"),
      local: english
        ? pageSourceCopy(page as unknown as Record<string, unknown>)
        : pageCopy(translation as unknown as Record<string, unknown>),
    } : null;
  }

  if (binding.resourceType !== "METAOBJECT") return null;

  if (binding.entityId === STOREFRONT_COPY_KEY) {
    const setting = await db.siteSetting.findUnique({ where: { key: STOREFRONT_COPY_KEY } });
    const copy = setting?.value as StorefrontCopy | null;
    const localizedCopy = english ? copy?.en : copy?.pt;
    return localizedCopy ? {
      rootEntityType: "STOREFRONT_COPY",
      rootEntityId: STOREFRONT_COPY_KEY,
      label: "Site copy",
      registry: registryForTarget(STOREFRONT_COPY_FIELD_REGISTRY, "metaobject", "storefront_copy"),
      local: localizedCopy,
    } : null;
  }

  const productId = rootIdForMetaobject(binding.entityId, "product_detail_copy");
  if (productId) {
    const product = await db.product.findUnique({
      where: { id: productId },
      include: { translations: { where: { locale: contentLocale }, take: 1 } },
    });
    const translation = product?.translations[0];
    return product && (english || translation) ? {
      rootEntityType: "PRODUCT",
      rootEntityId: product.id,
      label: product.name,
      registry: registryForTarget(PRODUCT_FIELD_REGISTRY, "metaobject", "product_detail_copy"),
      local: english
        ? productSourceCopy(product as unknown as Record<string, unknown>)
        : productCopy(translation as unknown as Record<string, unknown>),
    } : null;
  }

  const collectionId = rootIdForMetaobject(binding.entityId, "collection_section_copy");
  if (collectionId) {
    const collection = await db.collection.findUnique({
      where: { id: collectionId },
      include: { translations: { where: { locale: contentLocale }, take: 1 } },
    });
    const translation = collection?.translations[0];
    return collection && (english || translation) ? {
      rootEntityType: "COLLECTION",
      rootEntityId: collection.id,
      label: collection.name,
      registry: registryForTarget(COLLECTION_FIELD_REGISTRY, "metaobject", "collection_section_copy"),
      local: english
        ? collectionSourceCopy(collection as unknown as Record<string, unknown>)
        : collectionCopy(translation as unknown as Record<string, unknown>),
    } : null;
  }

  const pageId = rootIdForMetaobject(binding.entityId, "page_section_copy");
  if (pageId) {
    const page = await db.page.findUnique({
      where: { id: pageId },
      include: { translations: { where: { locale: contentLocale }, take: 1 } },
    });
    const translation = page?.translations[0];
    return page && (english || translation) ? {
      rootEntityType: "PAGE",
      rootEntityId: page.id,
      label: page.title,
      registry: registryForTarget(PAGE_FIELD_REGISTRY, "metaobject", "page_section_copy"),
      local: english
        ? pageSourceCopy(page as unknown as Record<string, unknown>)
        : pageCopy(translation as unknown as Record<string, unknown>),
    } : null;
  }

  return null;
}

const PRODUCT_TRANSLATION_FIELDS = new Set([
  "title", "localizedHandle", "shortDescription", "description", "materialLine",
  "symbolismLabel", "symbolismTitle", "symbolismBody", "symbolismBody2", "details",
  "seoTitle", "seoDescription",
]);
const COLLECTION_TRANSLATION_FIELDS = new Set([
  "name", "localizedHandle", "subtitle", "description", "manifesto", "symbolismLabel",
  "symbolismTitle", "symbolismBody", "symbolismBody2", "searchSummary", "seoTitle", "seoDescription",
]);
const PAGE_SCALAR_FIELDS = new Set(["title", "localizedHandle", "excerpt", "seoTitle", "seoDescription"]);

/** Writes one allowlisted translated field locally after the caller has completed stale-review guards. */
export async function writeLocalReconcileField({
  binding,
  locale,
  fieldKey,
  shopifyValue,
}: {
  binding: ReconcileBindingSource;
  locale: string;
  fieldKey: string;
  shopifyValue: unknown;
}) {
  const contentLocale = contentLocaleForShopify(locale);
  const english = contentLocale === "en";
  const subject = await loadReconcileSubject(binding, locale);
  if (!subject) throw new Error("The local translation no longer exists.");
  const field = subject.registry.fields.find((candidate) => candidate.key === fieldKey);
  if (!field || field.mode !== "localized" || !field.shopifyTarget) {
    throw new Error("This field is not available for translation sync.");
  }
  const value = shopifyValueForLocal(field, shopifyValue);

  if (subject.rootEntityType === "PRODUCT") {
    if (!PRODUCT_TRANSLATION_FIELDS.has(fieldKey)) throw new Error("This Product field does not have a local translation editor yet.");
    const stored = fieldKey === "details"
      ? value === null ? Prisma.DbNull : value as Prisma.InputJsonValue
      : value;
    if (english) {
      const sourceKey = fieldKey === "title" ? "name" : fieldKey === "localizedHandle" ? "slug" : fieldKey;
      await db.$transaction([
        db.product.update({
          where: { id: subject.rootEntityId },
          data: { [sourceKey]: stored } as Prisma.ProductUpdateInput,
        }),
        db.productTranslation.upsert({
          where: { productId_locale: { productId: subject.rootEntityId, locale: "en" } },
          update: { [fieldKey]: stored } as Prisma.ProductTranslationUpdateInput,
          create: {
            productId: subject.rootEntityId,
            locale: "en",
            title: fieldKey === "title" ? String(value ?? "") : String(subject.local.title ?? ""),
            [fieldKey]: stored,
          } as Prisma.ProductTranslationUncheckedCreateInput,
        }),
      ]);
    } else {
      await db.productTranslation.update({
        where: { productId_locale: { productId: subject.rootEntityId, locale: "pt" } },
        data: { [fieldKey]: stored } as Prisma.ProductTranslationUpdateInput,
      });
    }
    return value;
  }

  if (subject.rootEntityType === "COLLECTION") {
    if (!COLLECTION_TRANSLATION_FIELDS.has(fieldKey)) throw new Error("This Collection field does not have a local translation editor yet.");
    if (english) {
      const sourceKey = fieldKey === "name" ? "name" : fieldKey === "localizedHandle" ? "slug" : fieldKey;
      await db.$transaction([
        db.collection.update({
          where: { id: subject.rootEntityId },
          data: { [sourceKey]: value } as Prisma.CollectionUpdateInput,
        }),
        db.collectionTranslation.upsert({
          where: { collectionId_locale: { collectionId: subject.rootEntityId, locale: "en" } },
          update: { [fieldKey]: value } as Prisma.CollectionTranslationUpdateInput,
          create: {
            collectionId: subject.rootEntityId,
            locale: "en",
            name: fieldKey === "name" ? String(value ?? "") : String(subject.local.name ?? ""),
            [fieldKey]: value,
          } as Prisma.CollectionTranslationUncheckedCreateInput,
        }),
      ]);
    } else {
      await db.collectionTranslation.update({
        where: { collectionId_locale: { collectionId: subject.rootEntityId, locale: "pt" } },
        data: { [fieldKey]: value } as Prisma.CollectionTranslationUpdateInput,
      });
    }
    return value;
  }

  if (subject.rootEntityType === "PAGE") {
    if (PAGE_SCALAR_FIELDS.has(fieldKey)) {
      if (english) {
        const sourceKey = fieldKey === "localizedHandle" ? "slug" : fieldKey;
        await db.$transaction([
          db.page.update({
            where: { id: subject.rootEntityId },
            data: { [sourceKey]: value } as Prisma.PageUpdateInput,
          }),
          db.pageTranslation.upsert({
            where: { pageId_locale: { pageId: subject.rootEntityId, locale: "en" } },
            update: { [fieldKey]: value } as Prisma.PageTranslationUpdateInput,
            create: {
              pageId: subject.rootEntityId,
              locale: "en",
              title: fieldKey === "title" ? String(value ?? "") : String(subject.local.title ?? ""),
              [fieldKey]: value,
            } as Prisma.PageTranslationUncheckedCreateInput,
          }),
        ]);
      } else {
        await db.pageTranslation.update({
          where: { pageId_locale: { pageId: subject.rootEntityId, locale: "pt" } },
          data: { [fieldKey]: value } as Prisma.PageTranslationUpdateInput,
        });
      }
      return value;
    }

    const page = english
      ? await db.page.findUnique({ where: { id: subject.rootEntityId }, select: { content: true } })
      : await db.pageTranslation.findUnique({
          where: { pageId_locale: { pageId: subject.rootEntityId, locale: "pt" } },
          select: { content: true },
        });
    if (!page) throw new Error("The page translation no longer exists.");
    const content = { ...normalizePageTranslationContent(page.content) } as Record<string, unknown>;
    if (value === null) delete content[fieldKey];
    else content[fieldKey] = value;
    const storedContent = Object.keys(content).length > 0 ? content as Prisma.InputJsonValue : Prisma.DbNull;
    if (english) {
      await db.$transaction([
        db.page.update({ where: { id: subject.rootEntityId }, data: { content: storedContent } }),
        db.pageTranslation.upsert({
          where: { pageId_locale: { pageId: subject.rootEntityId, locale: "en" } },
          update: { content: storedContent },
          create: {
            pageId: subject.rootEntityId,
            locale: "en",
            title: String(subject.local.title ?? ""),
            content: storedContent,
          },
        }),
      ]);
    } else {
      await db.pageTranslation.update({
        where: { pageId_locale: { pageId: subject.rootEntityId, locale: "pt" } },
        data: { content: storedContent },
      });
    }
    return value;
  }

  const setting = await db.siteSetting.findUnique({ where: { key: STOREFRONT_COPY_KEY } });
  const current = setting?.value as StorefrontCopy | null;
  if (!current) throw new Error("Storefront copy no longer exists.");
  const localized = { ...(english ? current.en : current.pt) };
  if (value === null) delete localized[fieldKey];
  else localized[fieldKey] = String(value);
  await db.siteSetting.update({
    where: { key: STOREFRONT_COPY_KEY },
    data: { value: { ...current, [english ? "en" : "pt"]: localized } },
  });
  return value;
}
