"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { createHash } from "node:crypto";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { productCommerceSignature } from "@/lib/admin/product-commerce-signature";
import { db } from "@/lib/db";
import { revalidateStorefrontPath } from "@/lib/content/revalidate-storefront";
import { parseFormData } from "@/lib/forms/parse-form-data";
import {
  validateProductInput,
  type ProductFieldErrors,
} from "@/lib/products/product-form-validation";
import { slugify } from "@/lib/text/slug";
import { recordLocalizedHandleRedirect } from "@/lib/content/handle-redirects";
import { saveProductImageUpload } from "@/lib/media/local-upload";
import { getS3Bucket, getS3PublicUrl } from "@/lib/s3";
import { buildProductSearchDocument, parseCharacteristicsForm } from "@/lib/products/characteristics";
import { isShopifyConfigured } from "@/lib/shopify/config";
import { deleteShopifyProduct } from "@/lib/shopify/product-sync";
import { writeThroughLocalCommerceToProjection } from "@/lib/shopify/shopify-projection-diff";
import { parseShopifyTaxonomySelection } from "@/lib/shopify/taxonomy-selection";
import { parseTags } from "@/lib/text/parse-tags";
import { validateProductPublication } from "@/lib/products/localization";
import { readLocaleField } from "@/lib/i18n/admin-locale-fields";
import { getAdminTranslationLocales } from "@/lib/i18n/admin-translation-locales";
import {
  syncScopedCollectionMembership,
  syncStorefrontPriorityMembership,
} from "@/lib/admin/collection-membership-sync";
import { liveProductRequiresPublishedCollectionMessage } from "@/lib/admin/collection-select-options";
import { resolveSatisfiedProductTaxonomyIssues } from "@/lib/admin/issues";
import { hasShopifyAdminConfig } from "@/lib/shopify/admin";
import { runProductConflictCheck } from "@/lib/shopify/catalog-conflict-signals-server";
import {
  asRecord,
  createDraftToken,
  formValue,
  hasMeaningfulDraftInput,
  revalidateStorefront,
  writeAuditLog,
  type DraftAutosaveResult,
} from "./shared";

export type ProductActionState = {
  error?: string;
  fieldErrors?: ProductFieldErrors;
  success?: string;
  warning?: string;
  product?: SavedProductPayload;
  deletedProductId?: string;
  created?: boolean;
  syncWarning?: string;
};

export type SavedProductPayload = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  slug: string;
  sku: string;
  name: string;
  vendor: string | null;
  productType: string | null;
  shopifySnapshot: unknown;
  seriesLabel: string | null;
  shortDescription: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  materialLine: string | null;
  symbolismLabel: string | null;
  symbolismTitle: string | null;
  symbolismBody: string | null;
  symbolismBody2: string | null;
  details: unknown;
  imageUrl: string | null;
  primaryAssetId: string | null;
  priceCents: number;
  /** Shopify compare-at mirror on Product (variant is source of truth for the Price tab). */
  compareAtCents: number | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED" | "UNLISTED";
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  shopifyProductId: string | null;
  shopifyHandle: string | null;
  shopifyCategoryId: string | null;
  shopifyCategoryName: string | null;
  shopifyUpdatedAt: Date | null;
  lastSyncedAt: Date | null;
  syncStatus: "UNLINKED" | "PENDING" | "SYNCED" | "CONFLICT" | "FAILED";
  syncError: string | null;
  translations: SavedProductTranslationPayload[];
  media: SavedProductMediaPayload[];
  characteristics: {
    id: string;
    key: string;
    label: string;
    group: string;
    valueType: "TEXT" | "NUMBER" | "BOOLEAN";
    textValue: string | null;
    numberValue: number | null;
    booleanValue: boolean | null;
    unit: string | null;
    certificateUrl: string | null;
    sortOrder: number;
  }[];
  variants: {
    id: string;
    sku: string;
    title: string;
    priceCents: number;
    compareAtCents: number | null;
    costCents: number | null;
    stockOnHand: number;
    barcode: string | null;
    taxable: boolean;
    requiresShipping: boolean;
    tracked: boolean;
    weightGrams: number | null;
    imageUrl: string | null;
    selectedOptions: unknown;
    shopifyVariantId: string | null;
    shopifyInventoryItemId: string | null;
  }[];
  collections: {
    id: string;
    sortOrder: number;
    collection: {
      id: string;
      slug: string;
      name: string;
      isStorefrontDefault: boolean;
    };
  }[];
  tags: {
    id: string;
    tag: { id: string; slug: string; name: string };
  }[];
};

export type SavedProductTranslationPayload = {
  id: string;
  locale: string;
  title: string;
  localizedHandle: string | null;
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
  reviewStatus: "DRAFT" | "REVIEWED";
  reviewedAt: Date | null;
  syncStatus: "NOT_APPLICABLE" | "PENDING" | "SYNCED" | "FAILED" | "CONFLICT";
  syncError: string | null;
  contentHash: string | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  productId: string;
};

export type SavedProductMediaPayload = {
  id: string;
  assetId: string;
  kind: "PRIMARY" | "GALLERY" | "DETAIL" | "LOOKBOOK";
  alt: string | null;
  caption: string | null;
  sortOrder: number;
  url: string;
  width: number | null;
  height: number | null;
};

export async function getSavedProductPayload(productId: string): Promise<SavedProductPayload> {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      publishedAt: true,
      slug: true,
      sku: true,
      name: true,
      vendor: true,
      productType: true,
      shopifySnapshot: true,
      seriesLabel: true,
      shortDescription: true,
      description: true,
      seoTitle: true,
      seoDescription: true,
      materialLine: true,
      symbolismLabel: true,
      symbolismTitle: true,
      symbolismBody: true,
      symbolismBody2: true,
      details: true,
      imageUrl: true,
      primaryAssetId: true,
      priceCents: true,
      compareAtCents: true,
      status: true,
      visibility: true,
      shopifyProductId: true,
      shopifyHandle: true,
      shopifyCategoryId: true,
      shopifyCategoryName: true,
      shopifyUpdatedAt: true,
      lastSyncedAt: true,
      syncStatus: true,
      syncError: true,
      translations: { orderBy: { locale: "asc" } },
      media: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { asset: true },
      },
      characteristics: { orderBy: [{ group: "asc" }, { sortOrder: "asc" }] },
      variants: { orderBy: { createdAt: "asc" } },
      collections: {
        include: {
          collection: {
            select: {
              id: true,
              slug: true,
              name: true,
              isStorefrontDefault: true,
            },
          },
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
      tags: {
        include: {
          tag: {
            select: {
              id: true,
              slug: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!product) {
    throw new Error("Product not found.");
  }

  return {
    ...product,
    media: product.media.map((item) => ({
      id: item.id,
      assetId: item.assetId,
      kind: item.kind,
      alt: item.alt,
      caption: item.caption,
      sortOrder: item.sortOrder,
      url: getS3PublicUrl(item.asset.key),
      width: item.asset.width,
      height: item.asset.height,
    })),
    characteristics: product.characteristics.map((item) => ({
      ...item,
      numberValue: item.numberValue == null ? null : Number(item.numberValue),
    })),
    variants: product.variants.map((variant) => ({
      ...variant,
      weightGrams: variant.weightGrams == null ? null : Number(variant.weightGrams),
    })),
  };
}

export type ProductMediaActionState = {
  error?: string;
  success?: string;
  product?: SavedProductPayload;
};

async function finishProductMediaMutation(productId: string, success: string): Promise<ProductMediaActionState> {
  await db.product.updateMany({
    where: { id: productId, shopifyProductId: { not: null } },
    data: { syncStatus: "PENDING", syncError: null },
  });
  revalidatePath("/admin/products");
  revalidateStorefront();
  return { success, product: await getSavedProductPayload(productId) };
}

export async function uploadProductMediaAction(formData: FormData): Promise<ProductMediaActionState> {
  const currentUser = await requireAdminSession("/admin/products");
  const productId = formValue(formData, "productId");
  const alt = formValue(formData, "alt");
  const file = formData.get("file");
  if (!productId || !(file instanceof File) || file.size === 0) return { error: "Choose an image to upload." };
  const existingProduct = await db.product.findUnique({ where: { id: productId }, select: { id: true, primaryAssetId: true } });
  if (!existingProduct) return { error: "Save the product before adding gallery images." };
  const mediaCount = await db.productMedia.count({ where: { productId } });
  if (mediaCount >= 250) return { error: "Shopify supports up to 250 media items per product." };

  try {
    const uploaded = await saveProductImageUpload(file);
    if (!uploaded) return { error: "The image could not be uploaded." };
    const last = await db.productMedia.findFirst({ where: { productId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    await db.$transaction(async (tx) => {
      const asset = await tx.mediaAsset.create({
        data: {
          key: uploaded.storageKey, filename: uploaded.filename, mimeType: uploaded.mimeType,
          extension: uploaded.extension.replace(/^\./, ""), sizeBytes: uploaded.sizeBytes,
          width: uploaded.width, height: uploaded.height, bucket: getS3Bucket(),
          source: "UPLOAD", status: "READY", uploadedByUsername: currentUser?.username ?? null,
        },
        select: { id: true },
      });
      await tx.productMedia.create({
        data: { productId, assetId: asset.id, kind: existingProduct.primaryAssetId ? "GALLERY" : "PRIMARY", alt: alt || null, sortOrder: (last?.sortOrder ?? -1) + 1 },
      });
      if (!existingProduct.primaryAssetId) {
        await tx.product.update({ where: { id: productId }, data: { primaryAssetId: asset.id, imageUrl: uploaded.publicPath } });
      }
    });
    return finishProductMediaMutation(productId, "Gallery image uploaded.");
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Gallery upload failed." };
  }
}

export async function setPrimaryProductMediaAction(mediaId: string): Promise<ProductMediaActionState> {
  await requireAdminSession("/admin/products");
  const media = await db.productMedia.findUnique({ where: { id: mediaId }, include: { asset: true } });
  if (!media) return { error: "Gallery image not found." };
  await db.$transaction([
    db.productMedia.updateMany({ where: { productId: media.productId }, data: { kind: "GALLERY" } }),
    db.productMedia.updateMany({ where: { productId: media.productId, sortOrder: { lt: media.sortOrder } }, data: { sortOrder: { increment: 1 } } }),
    db.productMedia.update({ where: { id: media.id }, data: { kind: "PRIMARY", sortOrder: 0 } }),
    db.product.update({ where: { id: media.productId }, data: { primaryAssetId: media.assetId, imageUrl: getS3PublicUrl(media.asset.key) } }),
  ]);
  return finishProductMediaMutation(media.productId, "Primary image updated.");
}

export async function moveProductMediaAction(mediaId: string, direction: -1 | 1): Promise<ProductMediaActionState> {
  await requireAdminSession("/admin/products");
  const media = await db.productMedia.findUnique({ where: { id: mediaId } });
  if (!media) return { error: "Gallery image not found." };
  const neighbor = await db.productMedia.findFirst({
    where: { productId: media.productId, sortOrder: direction < 0 ? { lt: media.sortOrder } : { gt: media.sortOrder } },
    orderBy: { sortOrder: direction < 0 ? "desc" : "asc" },
  });
  if (!neighbor) return { product: await getSavedProductPayload(media.productId) };
  await db.$transaction([
    db.productMedia.update({ where: { id: media.id }, data: { sortOrder: neighbor.sortOrder } }),
    db.productMedia.update({ where: { id: neighbor.id }, data: { sortOrder: media.sortOrder } }),
  ]);
  const first = await db.productMedia.findFirst({
    where: { productId: media.productId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { asset: true },
  });
  if (first) {
    await db.$transaction([
      db.productMedia.updateMany({ where: { productId: media.productId }, data: { kind: "GALLERY" } }),
      db.productMedia.update({ where: { id: first.id }, data: { kind: "PRIMARY" } }),
      db.product.update({ where: { id: media.productId }, data: { primaryAssetId: first.assetId, imageUrl: getS3PublicUrl(first.asset.key) } }),
    ]);
  }
  return finishProductMediaMutation(media.productId, "Gallery order updated.");
}

export async function removeProductMediaAction(mediaId: string): Promise<ProductMediaActionState> {
  await requireAdminSession("/admin/products");
  const media = await db.productMedia.findUnique({ where: { id: mediaId }, include: { product: { select: { primaryAssetId: true } } } });
  if (!media) return { error: "Gallery image not found." };
  await db.productMedia.delete({ where: { id: media.id } });
  if (media.product.primaryAssetId === media.assetId) {
    const next = await db.productMedia.findFirst({ where: { productId: media.productId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { asset: true } });
    await db.$transaction([
      ...(next ? [db.productMedia.update({ where: { id: next.id }, data: { kind: "PRIMARY" } })] : []),
      db.product.update({
        where: { id: media.productId },
        data: next ? { primaryAssetId: next.assetId, imageUrl: getS3PublicUrl(next.asset.key) } : { primaryAssetId: null, imageUrl: null },
      }),
    ]);
  }
  return finishProductMediaMutation(media.productId, "Image removed from this product. The source asset was retained safely.");
}

async function uploadOptionalProductAsset(input: {
  formData: FormData;
  fieldName: string;
  existingValue: string;
  removeFieldName?: string;
  uploadedByUsername?: string | null;
}) {
  const file = input.formData.get(input.fieldName);
  const shouldRemoveExisting = input.removeFieldName
    ? String(input.formData.get(input.removeFieldName) ?? "").trim() === "1"
    : false;

  if (!(file instanceof File) || file.size === 0) {
    return shouldRemoveExisting ? "" : input.existingValue.trim();
  }

  const uploaded = await saveProductImageUpload(file);
  if (!uploaded) {
    return input.existingValue.trim();
  }

  await db.mediaAsset.create({
    data: {
      key: uploaded.storageKey,
      filename: uploaded.filename,
      mimeType: uploaded.mimeType,
      extension: uploaded.extension.replace(/^\./, ""),
      sizeBytes: uploaded.sizeBytes,
      width: uploaded.width,
      height: uploaded.height,
      bucket: process.env.S3_BUCKET ?? null,
      source: "UPLOAD",
      status: "READY",
      uploadedByUsername: input.uploadedByUsername ?? null,
    },
    select: { id: true },
  });

  return uploaded.publicPath;
}

// Only the flat, singly-named fields are validated declaratively here.
// The indexed/repeated fields (materialTitle1..3, attributeLabel1..8,
// lookbookImageFile1..4, etc.) are free-form and built dynamically further
// down via the shared formValue() helper — a fixed zod schema doesn't fit
// a field set whose keys are generated in a loop.
const saveProductFieldsSchema = z.object({
  productId: z.string().trim().default(""),
  slug: z.string().trim().default(""),
  sku: z.string().trim().default(""),
  name: z.string().trim().default(""),
  vendor: z.string().trim().default(""),
  productType: z.string().trim().default(""),
  seriesLabel: z.string().trim().default(""),
  shortDescription: z.string().trim().default(""),
  description: z.string().trim().default(""),
  seoTitle: z.string().trim().default(""),
  seoDescription: z.string().trim().default(""),
  materialLine: z.string().trim().default(""),
  symbolismLabel: z.string().trim().default(""),
  symbolismTitle: z.string().trim().default(""),
  symbolismBody: z.string().trim().default(""),
  symbolismBody2: z.string().trim().default(""),
  removeImage: z.string().trim().default(""),
  existingImageUrl: z.string().trim().default(""),
  price: z.string().trim().default("0"),
  compareAt: z.string().trim().default(""),
  cost: z.string().trim().default(""),
  // Unchecked checkbox is absent from FormData — default must be off, not "1".
  taxable: z.string().trim().default("0"),
  stockOnHand: z.string().trim().default("0"),
  shopifyCategoryId: z.string().trim().default(""),
  shopifyCategoryName: z.string().trim().default(""),
  collectionSlug: z.string().trim().default(""),
  tags: z.string().trim().default(""),
  workflowState: z.string().trim().default("DRAFT"),
});

const TRANSLATABLE_PRODUCT_FIELDS = [
  "title", "shortDescription", "description", "materialLine",
  "symbolismLabel", "symbolismTitle", "symbolismBody", "symbolismBody2",
  "seoTitle", "seoDescription",
] as const;

/** Reads one locale's flat copy fields straight from the raw FormData (not the strict shared-field schema above — a translation is optional everywhere, so nothing here needs `.min(1)`). */
function readProductTranslationFields(formData: FormData, locale: string) {
  const fields = Object.fromEntries(
    TRANSLATABLE_PRODUCT_FIELDS.map((key) => [key, readLocaleField(formData, locale, key)]),
  ) as Record<(typeof TRANSLATABLE_PRODUCT_FIELDS)[number], string>;
  return {
    ...fields,
    localizedHandle: readLocaleField(formData, locale, "localizedHandle"),
    reviewedFlag: readLocaleField(formData, locale, "reviewed"),
  };
}

/**
 * One locale's `details` (materials/process/lookbook) text — images/src/
 * mediaImage are shared with English (see `details` in saveProductAction)
 * and never re-uploaded per locale.
 */
function readProductTranslationDetails(formData: FormData, locale: string) {
  const materials = [1, 2, 3].map((index) => ({
    title: readLocaleField(formData, locale, `materialTitle${index}`),
    body: readLocaleField(formData, locale, `materialBody${index}`),
  }));
  const stats = [1, 2, 3, 4]
    .map((index) => ({
      value: readLocaleField(formData, locale, `processStatValue${index}`),
      label: readLocaleField(formData, locale, `processStatLabel${index}`),
    }))
    .filter((item) => item.value && item.label);
  const lookbook = [1, 2, 3, 4]
    .map((index) => ({ label: readLocaleField(formData, locale, `lookbookLabel${index}`) }))
    .filter((item) => item.label);
  return {
    materialsEyebrow: readLocaleField(formData, locale, "materialsEyebrow"),
    materialsTitle: readLocaleField(formData, locale, "materialsTitle"),
    materials: materials.filter((item) => item.title && item.body),
    process: {
      eyebrow: readLocaleField(formData, locale, "processEyebrow"),
      title: readLocaleField(formData, locale, "processTitle"),
      stats,
    },
    lookbookEyebrow: readLocaleField(formData, locale, "lookbookEyebrow"),
    lookbookTitle: readLocaleField(formData, locale, "lookbookTitle"),
    lookbook,
  };
}


/**
 * Publishing never blocks on incomplete content — the storefront already
 * falls back gracefully (resolveLocalizedContent uses English when a
 * Portuguese field is blank; storefrontMedia substitutes a placeholder
 * image). This turns `missingTranslations`/a missing photo into a plain-
 * language heads-up instead, so the admin knows what a visitor will see.
 */
function publishGapsNotice({ missingTranslations, missingImage }: { missingTranslations: string[]; missingImage: boolean }): string | undefined {
  const notes: string[] = [];
  if (missingTranslations.length) {
    notes.push(
      `Missing ${missingTranslations.join(", ")}. Portuguese gaps show the English text as a fallback; English gaps appear blank until filled in.`,
    );
  }
  if (missingImage) {
    notes.push("No photo yet — the site will show a placeholder image until one is uploaded.");
  }
  return notes.length ? notes.join(" ") : undefined;
}

function productConflictState(field: "slug" | "sku"): ProductActionState {
  return field === "slug"
    ? {
        error: "A product with this slug already exists.",
        fieldErrors: { slug: "A product with this URL slug already exists." },
      }
    : {
        error: "A product with this SKU already exists.",
        fieldErrors: { sku: "A product with this SKU already exists." },
      };
}

export async function saveProductAction(formData: FormData): Promise<ProductActionState> {
  const currentUser = await requireAdminSession("/admin/products");

  const parsed = parseFormData(formData, saveProductFieldsSchema);
  if (!parsed.success) {
    return { error: "Name, slug, SKU, and price are required." };
  }
  const {
    productId, sku, name, vendor, productType, seriesLabel, shortDescription, description, seoTitle, seoDescription, materialLine,
    symbolismLabel, symbolismTitle, symbolismBody, symbolismBody2,
    collectionSlug, workflowState,
  } = parsed.data;
  const translationLocales = await getAdminTranslationLocales();
  const slug = slugify(parsed.data.slug);
  const removeImage = parsed.data.removeImage === "1";
  const existingImageUrl = removeImage ? "" : parsed.data.existingImageUrl;
  const price = Number(parsed.data.price || "0");
  const stockOnHand = Math.max(0, Math.trunc(Number(parsed.data.stockOnHand || "0")));
  const taxable = parsed.data.taxable !== "0" && parsed.data.taxable !== "false";
  const tagInput = parsed.data.tags;
  const imageFile = formData.get("imageFile");
  const characteristics = parseCharacteristicsForm(formData);
  const tagSlugs = parseTags(tagInput);
  const hasShopifyCategorySelection =
    formData.has("shopifyCategoryId") || formData.has("shopifyCategoryName");
  let shopifyCategory;
  if (hasShopifyCategorySelection) {
    try {
      shopifyCategory = parseShopifyTaxonomySelection({
        id: parsed.data.shopifyCategoryId,
        name: parsed.data.shopifyCategoryName,
      });
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Choose a Shopify product category." };
    }
  }

  const fieldErrors = validateProductInput({
    name,
    slug,
    sku,
    price: parsed.data.price,
  });
  if (Object.keys(fieldErrors).length > 0) {
    return {
      error: "Review the highlighted fields and try again.",
      fieldErrors,
    };
  }

  if (!productId) {
    const conflictingProduct = await db.product.findFirst({
      where: { OR: [{ slug }, { sku }] },
      select: { slug: true, sku: true },
    });
    if (conflictingProduct?.slug === slug) return productConflictState("slug");
    if (conflictingProduct?.sku === sku) return productConflictState("sku");
  }

  const before = productId ? await getSavedProductPayload(productId).catch(() => null) : null;
  // Compare-at and cost are Synarava read-only (edit in Shopify). Preserve last pull; ignore FormData.
  const compareAtCents = before?.variants[0]?.compareAtCents ?? before?.compareAtCents ?? null;
  const costCents = before?.variants[0]?.costCents ?? null;
  const translationFields = translationLocales.map(({ code, label }) => ({
    code, label, fields: readProductTranslationFields(formData, code),
  }));
  const isPublished = workflowState === "PUBLISHED";
  const isUnlisted = workflowState === "UNLISTED";
  const missingTranslations = (isPublished || isUnlisted)
    ? validateProductPublication({
        isAlreadyPublic: Boolean(
          (before?.visibility === "PUBLIC" || before?.visibility === "UNLISTED")
          && !before.translations.some((translation) => translation.locale !== "en"),
        ),
        english: { title: name, shortDescription, description },
        translations: translationFields.map(({ label, fields }) => ({
          label,
          copy: { title: fields.title, shortDescription: fields.shortDescription, description: fields.description },
          reviewed: fields.reviewedFlag === "on",
        })),
      })
    : [];

  let imageUrl = existingImageUrl || null;
  let uploadedAssetId: string | null = null;

  if (imageFile instanceof File && imageFile.size > 0) {
    const uploaded = await saveProductImageUpload(imageFile);
    if (uploaded) {
      imageUrl = uploaded.publicPath;
      const asset = await db.mediaAsset.create({
        data: {
          key: uploaded.storageKey,
          filename: uploaded.filename,
          mimeType: uploaded.mimeType,
          extension: uploaded.extension.replace(/^\./, ""),
          sizeBytes: uploaded.sizeBytes,
          width: uploaded.width,
          height: uploaded.height,
          bucket: process.env.S3_BUCKET ?? null,
          source: "UPLOAD",
          status: "READY",
          uploadedByUsername: currentUser?.username ?? null,
        },
        select: { id: true },
      });
      uploadedAssetId = asset.id;
    }
  }

  const materialEntries = await Promise.all(
    [1, 2, 3].map(async (index) => {
      const image = await uploadOptionalProductAsset({
        formData,
        fieldName: `materialImageFile${index}`,
        existingValue: formValue(formData, `existingMaterialImage${index}`),
        removeFieldName: `removeMaterialImage${index}`,
        uploadedByUsername: currentUser?.username,
      });

      return {
        title: formValue(formData, `materialTitle${index}`),
        body: formValue(formData, `materialBody${index}`),
        image,
      };
    }),
  );

  const processMediaImage = await uploadOptionalProductAsset({
    formData,
    fieldName: "processMediaImageFile",
    existingValue: formValue(formData, "existingProcessMediaImage"),
    removeFieldName: "removeProcessMediaImage",
    uploadedByUsername: currentUser?.username,
  });

  const processStats = [1, 2, 3, 4]
    .map((index) => ({
      value: formValue(formData, `processStatValue${index}`),
      label: formValue(formData, `processStatLabel${index}`),
    }))
    .filter((item) => item.value && item.label);

  const lookbookEntries = await Promise.all(
    [1, 2, 3, 4].map(async (index) => {
      const src = await uploadOptionalProductAsset({
        formData,
        fieldName: `lookbookImageFile${index}`,
        existingValue: formValue(formData, `existingLookbookImage${index}`),
        removeFieldName: `removeLookbookImage${index}`,
        uploadedByUsername: currentUser?.username,
      });

      return {
        src,
        label: formValue(formData, `lookbookLabel${index}`),
        featured: String(formData.get(`lookbookFeatured${index}`) ?? "") === "on",
      };
    }),
  );

  const details = {
    attributes: Array.from({ length: 8 }, (_, index) => ({
      label: formValue(formData, `attributeLabel${index + 1}`),
      value: formValue(formData, `attributeValue${index + 1}`),
    })).filter((item) => item.label && item.value),
    materialsEyebrow: formValue(formData, "materialsEyebrow"),
    materialsTitle: formValue(formData, "materialsTitle"),
    materials: materialEntries.filter((item) => item.title && item.body && item.image),
    process: {
      eyebrow: formValue(formData, "processEyebrow"),
      title: formValue(formData, "processTitle"),
      mediaImage: processMediaImage,
      stats: processStats,
    },
    lookbookEyebrow: formValue(formData, "lookbookEyebrow"),
    lookbookTitle: formValue(formData, "lookbookTitle"),
    lookbook: lookbookEntries.filter((item) => item.src),
  };

  const collection = collectionSlug
    ? await db.collection.findUnique({
        where: { slug: collectionSlug },
        select: { id: true, name: true, status: true, visibility: true },
      })
    : null;

  if (collectionSlug && !collection) {
    return {
      error: "Review the highlighted fields and try again.",
      fieldErrors: { collectionSlug: "Choose a collection from the list." },
    };
  }

  const liveCollectionError = liveProductRequiresPublishedCollectionMessage(
    collection,
    isPublished || isUnlisted,
  );
  if (liveCollectionError) {
    return {
      error: "Review the highlighted fields and try again.",
      fieldErrors: { collectionSlug: liveCollectionError },
    };
  }

  const missingImage = (isPublished || isUnlisted) && !imageUrl;
  const publishWarning = publishGapsNotice({ missingTranslations, missingImage });

  const wasCreate = !productId;
  const productData = {
    slug,
    sku,
    name,
    vendor: vendor || null,
    productType: productType || null,
    seriesLabel,
    shortDescription,
    description,
    seoTitle: seoTitle || null,
    seoDescription: seoDescription || null,
    materialLine,
    symbolismLabel: symbolismLabel || null,
    symbolismTitle: symbolismTitle || null,
    symbolismBody: symbolismBody || null,
    symbolismBody2: symbolismBody2 || null,
    details,
    imageUrl,
    ...(uploadedAssetId ? { primaryAssetId: uploadedAssetId } : removeImage ? { primaryAssetId: null } : {}),
    priceCents: Math.round(price * 100),
    compareAtCents,
    ...(hasShopifyCategorySelection ? {
      shopifyCategoryId: shopifyCategory?.id ?? null,
      shopifyCategoryName: shopifyCategory?.name ?? null,
    } : {}),
    status: isPublished ? "ACTIVE" as const : isUnlisted ? "UNLISTED" as const : "DRAFT" as const,
    visibility: isPublished ? "PUBLIC" as const : isUnlisted ? "UNLISTED" as const : "PRIVATE" as const,
    publishedAt: isPublished || isUnlisted ? new Date() : null,
    searchDocument: buildProductSearchDocument({
      name, sku, slug, description, shortDescription, materialLine,
      tags: tagSlugs, characteristics,
    }),
  };

  let product: { id: string; slug: string };
  try {
    product = productId
      ? await db.product.update({
          where: { id: productId },
          data: productData,
          select: { id: true, slug: true },
        })
      : await db.product.create({
          data: { ...productData, currency: "EUR" },
          select: { id: true, slug: true },
        });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : [];
      return productConflictState(target.includes("sku") ? "sku" : "slug");
    }
    throw error;
  }

  const sourceTranslationChanged = !before
    || before.name !== name
    || before.description !== description
    || before.seoTitle !== (seoTitle || null)
    || before.seoDescription !== (seoDescription || null);
  const translationUpserts = translationFields.map(({ code: locale, fields }) => {
    const translationDetails = readProductTranslationDetails(formData, locale);
    const copy = {
      localizedHandle: slugify(fields.localizedHandle) || null,
      title: fields.title,
      shortDescription: fields.shortDescription || null,
      description: fields.description || null,
      materialLine: fields.materialLine || null,
      symbolismLabel: fields.symbolismLabel || null,
      symbolismTitle: fields.symbolismTitle || null,
      symbolismBody: fields.symbolismBody || null,
      symbolismBody2: fields.symbolismBody2 || null,
      seoTitle: fields.seoTitle || null,
      seoDescription: fields.seoDescription || null,
      details: translationDetails as Prisma.InputJsonValue,
    };
    const contentHash = createHash("sha256").update(JSON.stringify(copy)).digest("hex");
    const reviewed = fields.reviewedFlag === "on"
      && Boolean(fields.title && fields.shortDescription && fields.description);
    const previousTranslation = before?.translations.find((translation) => translation.locale === locale);
    const syncStatus = !before?.shopifyProductId || !reviewed
      ? "NOT_APPLICABLE" as const
      : previousTranslation?.contentHash === contentHash
        && !sourceTranslationChanged
        && previousTranslation.syncStatus === "SYNCED"
        ? "SYNCED" as const
        : "PENDING" as const;
    return { locale, copy, reviewed, syncStatus, contentHash, previousHandle: previousTranslation?.localizedHandle };
  });
  await db.$transaction([
    db.productTranslation.upsert({
      where: { productId_locale: { productId: product.id, locale: "en" } },
      update: {
        title: name,
        shortDescription: shortDescription || null,
        description: description || null,
        materialLine: materialLine || null,
        symbolismLabel: symbolismLabel || null,
        symbolismTitle: symbolismTitle || null,
        symbolismBody: symbolismBody || null,
        symbolismBody2: symbolismBody2 || null,
        details: details as Prisma.InputJsonValue,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
        reviewStatus: "REVIEWED",
        reviewedAt: new Date(),
      },
      create: {
        productId: product.id,
        locale: "en",
        title: name,
        shortDescription: shortDescription || null,
        description: description || null,
        materialLine: materialLine || null,
        symbolismLabel: symbolismLabel || null,
        symbolismTitle: symbolismTitle || null,
        symbolismBody: symbolismBody || null,
        symbolismBody2: symbolismBody2 || null,
        details: details as Prisma.InputJsonValue,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
        reviewStatus: "REVIEWED",
        reviewedAt: new Date(),
      },
    }),
    ...translationUpserts.map(({ locale, copy, reviewed, syncStatus, contentHash }) => db.productTranslation.upsert({
      where: { productId_locale: { productId: product.id, locale } },
      update: {
        ...copy,
        reviewStatus: reviewed ? "REVIEWED" : "DRAFT",
        reviewedAt: reviewed ? new Date() : null,
        contentHash,
        syncStatus,
        syncError: null,
      },
      create: {
        productId: product.id,
        locale,
        ...copy,
        reviewStatus: reviewed ? "REVIEWED" : "DRAFT",
        reviewedAt: reviewed ? new Date() : null,
        contentHash,
        syncStatus,
      },
    })),
  ]);
  await Promise.all(translationUpserts.map(({ locale, copy, previousHandle }) => recordLocalizedHandleRedirect({
    entityType: "PRODUCT",
    entityId: product.id,
    locale,
    previousHandle,
    nextHandle: copy.localizedHandle ?? slug,
  })));

  if (uploadedAssetId) {
    await db.$transaction(async (tx) => {
      await tx.productMedia.updateMany({ where: { productId: product.id }, data: { sortOrder: { increment: 1 }, kind: "GALLERY" } });
      if (before?.primaryAssetId) {
        await tx.productMedia.upsert({
          where: { productId_assetId: { productId: product.id, assetId: before.primaryAssetId } },
          update: { kind: "GALLERY" },
          create: { productId: product.id, assetId: before.primaryAssetId, kind: "GALLERY", alt: before.name, sortOrder: 1 },
        });
      }
      await tx.productMedia.upsert({
        where: { productId_assetId: { productId: product.id, assetId: uploadedAssetId } },
        update: { kind: "PRIMARY", alt: name, sortOrder: 0 },
        create: { productId: product.id, assetId: uploadedAssetId, kind: "PRIMARY", alt: name, sortOrder: 0 },
      });
    });
  }

  const existingVariant = await db.productVariant.findFirst({ where: { productId: product.id }, orderBy: { createdAt: "asc" } });
  const priceCents = Math.round(price * 100);
  if (existingVariant) {
    await db.productVariant.update({
      where: { id: existingVariant.id },
      data: {
        sku,
        priceCents,
        compareAtCents,
        costCents,
        taxable,
        stockOnHand,
        status: isPublished ? "ACTIVE" : isUnlisted ? "UNLISTED" : "DRAFT",
      },
    });
  } else {
    await db.productVariant.create({
      data: {
        productId: product.id,
        sku,
        title: "Default Title",
        priceCents,
        compareAtCents,
        costCents,
        taxable,
        stockOnHand,
        status: isPublished ? "ACTIVE" : isUnlisted ? "UNLISTED" : "DRAFT",
      },
    });
  }

  // Dual snapshot: Save updates working only; shopifySnapshot changes on refresh/pull.
  if (before?.shopifyProductId) {
    const linked = await db.product.findUnique({
      where: { id: product.id },
      select: {
        shopifyProductId: true,
        workingSnapshot: true,
        shopifySnapshot: true,
        name: true,
        slug: true,
        vendor: true,
        productType: true,
        variants: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { shopifyVariantId: true, sku: true, priceCents: true, taxable: true, stockOnHand: true },
        },
      },
    });
    if (linked?.shopifyProductId) {
      const variant = linked.variants[0];
      const baseWindow = linked.workingSnapshot ?? linked.shopifySnapshot;
      const nextWorking = writeThroughLocalCommerceToProjection(baseWindow, {
        title: linked.name,
        handle: linked.slug,
        vendor: linked.vendor,
        productType: linked.productType,
        tags: tagSlugs.map((slug) => slug.replace(/-/g, " ")),
        variant: variant
          ? {
              shopifyVariantId: variant.shopifyVariantId,
              sku: variant.sku,
              priceCents: variant.priceCents,
              taxable: variant.taxable,
              inventoryQuantity: variant.stockOnHand,
            }
          : {
              sku,
              priceCents,
              taxable,
              inventoryQuantity: stockOnHand,
            },
      });
      await db.product.update({
        where: { id: product.id },
        data: { workingSnapshot: nextWorking as Prisma.InputJsonValue },
      });
      const { patchOurProductWindow } = await import("@/lib/commerce-store/refresh");
      await patchOurProductWindow({
        shopifyProductId: linked.shopifyProductId,
        localProductId: product.id,
        window: nextWorking,
      });
    }
  }

  await syncScopedCollectionMembership(
    product.id,
    { isStorefrontDefault: false },
    collection?.id ?? null,
  );
  await syncStorefrontPriorityMembership(product.id, isPublished);

  await db.productTag.deleteMany({
    where: { productId: product.id },
  });

  for (const tagSlug of tagSlugs) {
    const tag = await db.tag.upsert({
      where: { slug: tagSlug },
      update: { name: tagSlug.replace(/-/g, " ") },
      create: { slug: tagSlug, name: tagSlug.replace(/-/g, " ") },
      select: { id: true },
    });

    await db.productTag.create({
      data: {
        productId: product.id,
        tagId: tag.id,
      },
    });
  }

  await db.productCharacteristic.deleteMany({ where: { productId: product.id } });
  if (characteristics.length) {
    await db.productCharacteristic.createMany({
      data: characteristics.map((item) => ({ ...item, productId: product.id })),
    });
  }

  revalidateStorefront();
  revalidatePath("/admin/products");
  revalidatePath("/admin/issues");
  revalidateStorefrontPath(`/products/${product.slug}`);

  let savedProduct = await getSavedProductPayload(product.id);
  await resolveSatisfiedProductTaxonomyIssues(savedProduct.id, {
    hasCategory: Boolean(savedProduct.shopifyCategoryId),
    hasTags: savedProduct.tags.length > 0,
    hasCollection: savedProduct.collections.some((item) => !item.collection.isStorefrontDefault),
  });
  const commerceChanged = !before || productCommerceSignature(before) !== productCommerceSignature(savedProduct);
  const nextSyncStatus = savedProduct.shopifyProductId
    ? before?.syncStatus === "CONFLICT"
      ? "CONFLICT"
      : commerceChanged
        ? "PENDING"
        : savedProduct.syncStatus
    : "UNLINKED";

  if (savedProduct.syncStatus !== nextSyncStatus || savedProduct.syncError) {
    await db.product.update({
      where: { id: savedProduct.id },
      data: { syncStatus: nextSyncStatus, syncError: null },
    });
    savedProduct = await getSavedProductPayload(product.id);
  }

  await writeAuditLog({
    action: wasCreate ? "CREATE" : "UPDATE",
    entityType: "PRODUCT",
    entityId: savedProduct.id,
    before,
    after: savedProduct,
  });

  if (savedProduct.shopifyProductId && hasShopifyAdminConfig()) {
    after(() => {
      void runProductConflictCheck({
        productId: savedProduct.id,
        requestedBy: currentUser.username,
      }).catch((error) => {
        console.error("[saveProduct] scoped conflict check failed", error);
      });
    });
  }

  return {
    success: commerceChanged
      ? `${wasCreate ? "Product created" : "Product saved"} locally. Commerce changes are ready to push.`
      : `${wasCreate ? "Product created" : "Product saved"} locally. Shopify commerce data is unchanged.`,
    warning: publishWarning,
    created: wasCreate,
    product: savedProduct,
  };
}

const autosaveProductFieldsSchema = z.object({
  productId: z.string().trim().default(""),
  slug: z.string().trim().default(""),
  sku: z.string().trim().default(""),
  name: z.string().trim().default(""),
  seriesLabel: z.string().trim().default(""),
  shortDescription: z.string().trim().default(""),
  description: z.string().trim().default(""),
  seoTitle: z.string().trim().default(""),
  seoDescription: z.string().trim().default(""),
  materialLine: z.string().trim().default(""),
  shopifyCategoryId: z.string().trim().default(""),
  shopifyCategoryName: z.string().trim().default(""),
  price: z.string().trim().default("0"),
  removeImage: z.string().trim().default(""),
  existingImageUrl: z.string().trim().default(""),
});

export async function autosaveProductDraftAction(formData: FormData): Promise<DraftAutosaveResult & { product?: SavedProductPayload }> {
  await requireAdminSession("/admin/products");

  if (formValue(formData, "forceDraft") !== "1" && !hasMeaningfulDraftInput(formData, ["productId", "workflowState", "existingImageUrl"])) {
    return {};
  }

  const parsed = parseFormData(formData, autosaveProductFieldsSchema);
  if (!parsed.success) {
    return {};
  }
  const {
    productId, seriesLabel, shortDescription, description, seoTitle, seoDescription, materialLine,
  } = parsed.data;
  const translationLocales = await getAdminTranslationLocales();
  const translationFields = translationLocales.map(({ code }) => ({
    code, fields: readProductTranslationFields(formData, code),
  }));
  const hasShopifyCategorySelection =
    formData.has("shopifyCategoryId") || formData.has("shopifyCategoryName");
  let shopifyCategory;
  if (hasShopifyCategorySelection) {
    try {
      shopifyCategory = parseShopifyTaxonomySelection({
        id: parsed.data.shopifyCategoryId,
        name: parsed.data.shopifyCategoryName,
      });
    } catch {
      return { error: "Choose a category from Shopify taxonomy results." };
    }
  }
  const slug = slugify(parsed.data.slug) || createDraftToken("draft-product");
  const sku = parsed.data.sku || createDraftToken("sku").toUpperCase();
  const name = parsed.data.name || "Untitled product";
  const price = Number(parsed.data.price || "0");
  const removeImage = parsed.data.removeImage === "1";
  const existingImageUrl = removeImage ? "" : parsed.data.existingImageUrl;
  const existingProduct = productId
    ? await db.product.findUnique({ where: { id: productId }, select: { details: true } })
    : null;
  const attributes = Array.from({ length: 8 }, (_, index) => ({
    label: formValue(formData, `attributeLabel${index + 1}`),
    value: formValue(formData, `attributeValue${index + 1}`),
  })).filter((item) => item.label && item.value);
  // Strip legacy keys left over from before the department removal.
  const existingDetails = Object.fromEntries(
    Object.entries(asRecord(existingProduct?.details)).filter(([key]) => key !== "department"),
  );
  const draftDetails = {
    ...existingDetails,
    attributes,
  } as Prisma.InputJsonValue;

  const productData = {
    slug,
    sku,
    name,
    seriesLabel: seriesLabel || null,
    shortDescription: shortDescription || null,
    description: description || null,
    seoTitle: seoTitle || null,
    seoDescription: seoDescription || null,
    materialLine: materialLine || null,
    ...(hasShopifyCategorySelection ? {
      shopifyCategoryId: shopifyCategory?.id ?? null,
      shopifyCategoryName: shopifyCategory?.name ?? null,
    } : {}),
    details: draftDetails,
    imageUrl: existingImageUrl || null,
    priceCents: Number.isFinite(price) ? Math.round(price * 100) : 0,
    status: "DRAFT" as const,
    visibility: "PRIVATE" as const,
    publishedAt: null,
  };

  let product: { id: string };
  try {
    product = productId
      ? await db.product.update({
          where: { id: productId },
          data: productData,
          select: { id: true },
        })
      : await db.product.create({
          data: productData,
          select: { id: true },
        });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : [];
      if (target.includes("sku")) {
        return { error: `A product with the SKU “${sku}” already exists. Choose a different SKU.` };
      }
      return { error: `A product with the slug “${slug}” already exists. Choose a different slug.` };
    }
    throw error;
  }

  await db.$transaction([
    db.productTranslation.upsert({
      where: { productId_locale: { productId: product.id, locale: "en" } },
      update: {
        title: name,
        shortDescription: shortDescription || null,
        description: description || null,
        materialLine: materialLine || null,
        details: draftDetails,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
        reviewStatus: "REVIEWED",
        reviewedAt: new Date(),
      },
      create: {
        productId: product.id,
        locale: "en",
        title: name,
        shortDescription: shortDescription || null,
        description: description || null,
        materialLine: materialLine || null,
        details: draftDetails,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
        reviewStatus: "REVIEWED",
        reviewedAt: new Date(),
      },
    }),
    ...translationFields.map(({ code: locale, fields }) => db.productTranslation.upsert({
      where: { productId_locale: { productId: product.id, locale } },
      update: {
        title: fields.title,
        shortDescription: fields.shortDescription || null,
        description: fields.description || null,
        materialLine: fields.materialLine || null,
        seoTitle: fields.seoTitle || null,
        seoDescription: fields.seoDescription || null,
        reviewStatus: fields.reviewedFlag === "on" ? "REVIEWED" : "DRAFT",
        syncStatus: "NOT_APPLICABLE",
      },
      create: {
        productId: product.id,
        locale,
        title: fields.title,
        shortDescription: fields.shortDescription || null,
        description: fields.description || null,
        materialLine: fields.materialLine || null,
        seoTitle: fields.seoTitle || null,
        seoDescription: fields.seoDescription || null,
        reviewStatus: fields.reviewedFlag === "on" ? "REVIEWED" : "DRAFT",
      },
    })),
  ]);

  revalidatePath("/admin/products");
  revalidatePath("/admin");
  return { recordId: product.id, product: await getSavedProductPayload(product.id) };
}

const deleteProductSchema = z.object({
  productId: z.string().trim().min(1),
  productSlug: z.string().trim().default(""),
});

export async function deleteProductAction(formData: FormData): Promise<ProductActionState> {
  await requireAdminSession("/admin/products");

  const parsed = parseFormData(formData, deleteProductSchema);
  if (!parsed.success) {
    return {
      error: "Product id is missing.",
    };
  }
  const { productId, productSlug } = parsed.data;

  const existing = await db.product.findUnique({ where: { id: productId }, select: { shopifyProductId: true } });
  if (isShopifyConfigured() && existing?.shopifyProductId) {
    try {
      await deleteShopifyProduct(existing.shopifyProductId);
    } catch (error) {
      return { error: error instanceof Error ? `Shopify deletion failed: ${error.message}` : "Shopify deletion failed." };
    }
  }

  await db.product.delete({
    where: { id: productId },
  });

  revalidateStorefront();
  revalidatePath("/admin/products");

  if (productSlug) {
    revalidateStorefrontPath(`/products/${productSlug}`);
  }

  return {
    success: "Product deleted.",
    deletedProductId: productId,
  };
}

const updateProductStatusSchema = z.object({
  productId: z.string().trim().min(1),
  action: z.string().trim().default(""),
});

export async function updateProductStatusAction(formData: FormData): Promise<ProductActionState> {
  await requireAdminSession("/admin/products");

  const parsed = parseFormData(formData, updateProductStatusSchema);
  if (!parsed.success) {
    return { error: "Product id is missing." };
  }
  const { productId, action } = parsed.data;

  const state =
    action === "publish"
      ? { status: "ACTIVE" as const, visibility: "PUBLIC" as const, publishedAt: new Date() }
      : action === "draft"
        ? { status: "DRAFT" as const, visibility: "PRIVATE" as const, publishedAt: null }
        : action === "archive"
          ? { status: "ARCHIVED" as const, visibility: "PRIVATE" as const, publishedAt: null }
          : null;

  if (!state) {
    return { error: "Unknown product action." };
  }

  const before = await getSavedProductPayload(productId).catch(() => null);
  const missingImage = action === "publish" && !before?.imageUrl;
  let missingTranslations: string[] = [];
  if (action === "publish" && before) {
    const translationLocales = await getAdminTranslationLocales();
    missingTranslations = validateProductPublication({
      isAlreadyPublic: false,
      english: {
        title: before.name,
        shortDescription: before.shortDescription ?? "",
        description: before.description ?? "",
      },
      translations: translationLocales.map(({ code, label }) => {
        const translation = before.translations.find((item) => item.locale === code);
        return {
          label,
          copy: {
            title: translation?.title ?? "",
            shortDescription: translation?.shortDescription ?? "",
            description: translation?.description ?? "",
          },
          reviewed: translation?.reviewStatus === "REVIEWED",
        };
      }),
    });

    const marketingCollection = before.collections.find((item) => !item.collection.isStorefrontDefault)?.collection;
    if (marketingCollection) {
      const fullCollection = await db.collection.findUnique({
        where: { id: marketingCollection.id },
        select: { name: true, status: true, visibility: true },
      });
      const liveCollectionError = liveProductRequiresPublishedCollectionMessage(fullCollection, true);
      if (liveCollectionError) {
        return {
          error: liveCollectionError,
          fieldErrors: { collectionSlug: liveCollectionError },
        };
      }
    }
  }
  const publishWarning = publishGapsNotice({ missingTranslations, missingImage });

  const product = await db.product.update({
    where: { id: productId },
    data: {
      ...state,
      syncStatus: before?.shopifyProductId
        ? before.syncStatus === "CONFLICT" ? "CONFLICT" : "PENDING"
        : "UNLINKED",
      syncError: null,
    },
    select: { id: true, slug: true, status: true },
  });

  revalidateStorefront();
  revalidatePath("/admin/products");
  revalidateStorefrontPath(`/products/${product.slug}`);

  const savedProduct = await getSavedProductPayload(product.id);

  await writeAuditLog({
    action: `STATUS_${action.toUpperCase()}`,
    entityType: "PRODUCT",
    entityId: savedProduct.id,
    before,
    after: savedProduct,
  });

  return {
    success: `Product moved to ${product.status.toLowerCase()} locally. Commerce status is ready to push.`,
    warning: publishWarning,
    product: savedProduct,
  };
}
