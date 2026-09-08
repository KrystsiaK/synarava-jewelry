"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

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
import { saveProductImageUpload } from "@/lib/media/local-upload";
import { getS3Bucket, getS3PublicUrl } from "@/lib/s3";
import { buildProductSearchDocument, parseCharacteristicsForm } from "@/lib/products/characteristics";
import { isShopifyConfigured } from "@/lib/shopify/config";
import { deleteShopifyProduct } from "@/lib/shopify/product-sync";
import { parseShopifyTaxonomySelection } from "@/lib/shopify/taxonomy-selection";
import { parseTags } from "@/lib/text/parse-tags";
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
  seriesLabel: string | null;
  shortDescription: string | null;
  description: string | null;
  materialLine: string | null;
  symbolismLabel: string | null;
  symbolismTitle: string | null;
  symbolismBody: string | null;
  symbolismBody2: string | null;
  details: unknown;
  imageUrl: string | null;
  primaryAssetId: string | null;
  priceCents: number;
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
      isPrimaryNav: boolean;
    };
  }[];
  tags: {
    id: string;
    tag: { id: string; slug: string; name: string };
  }[];
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
      seriesLabel: true,
      shortDescription: true,
      description: true,
      materialLine: true,
      symbolismLabel: true,
      symbolismTitle: true,
      symbolismBody: true,
      symbolismBody2: true,
      details: true,
      imageUrl: true,
      primaryAssetId: true,
      priceCents: true,
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
              isPrimaryNav: true,
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
  seriesLabel: z.string().trim().default(""),
  shortDescription: z.string().trim().default(""),
  description: z.string().trim().default(""),
  materialLine: z.string().trim().default(""),
  symbolismLabel: z.string().trim().default(""),
  symbolismTitle: z.string().trim().default(""),
  symbolismBody: z.string().trim().default(""),
  symbolismBody2: z.string().trim().default(""),
  removeImage: z.string().trim().default(""),
  existingImageUrl: z.string().trim().default(""),
  price: z.string().trim().default("0"),
  stockOnHand: z.string().trim().default("0"),
  shopifyCategoryId: z.string().trim().default(""),
  shopifyCategoryName: z.string().trim().default(""),
  collectionSlug: z.string().trim().default(""),
  tags: z.string().trim().default(""),
  workflowState: z.string().trim().default("DRAFT"),
});

/**
 * Keeps a product's storefront-navigation membership (its "department")
 * in sync with the admin's department select, without touching any other
 * collection membership (e.g. the marketing collection set below). Only
 * `isPrimaryNav` collections are ever added or removed here.
 */
async function syncDepartmentCollectionMembership(productId: string, departmentSlug: string) {
  const existingNavMemberships = await db.productCollection.findMany({
    where: { productId, collection: { isPrimaryNav: true } },
    select: { id: true, collectionId: true },
  });
  const target = departmentSlug
    ? await db.collection.findFirst({ where: { slug: departmentSlug, isPrimaryNav: true }, select: { id: true } })
    : null;

  const staleIds = existingNavMemberships
    .filter((item) => item.collectionId !== target?.id)
    .map((item) => item.id);
  if (staleIds.length) {
    await db.productCollection.deleteMany({ where: { id: { in: staleIds } } });
  }
  if (target && !existingNavMemberships.some((item) => item.collectionId === target.id)) {
    await db.productCollection.create({ data: { productId, collectionId: target.id } });
  }
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
    productId, sku, name, seriesLabel, shortDescription, description, materialLine,
    symbolismLabel, symbolismTitle, symbolismBody, symbolismBody2,
    collectionSlug, workflowState,
  } = parsed.data;
  const slug = slugify(parsed.data.slug);
  const removeImage = parsed.data.removeImage === "1";
  const existingImageUrl = removeImage ? "" : parsed.data.existingImageUrl;
  const price = Number(parsed.data.price || "0");
  const stockOnHand = Math.max(0, Math.trunc(Number(parsed.data.stockOnHand || "0")));
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

  const department = formValue(formData, "department");
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
    ? await db.collection.findUnique({ where: { slug: collectionSlug }, select: { id: true } })
    : null;

  const isPublished = workflowState === "PUBLISHED";
  const isUnlisted = workflowState === "UNLISTED";
  if ((isPublished || isUnlisted) && !imageUrl) {
    return { error: "Product image is required before publishing." };
  }

  const wasCreate = !productId;
  const before = productId ? await getSavedProductPayload(productId).catch(() => null) : null;

  const productData = {
    slug,
    sku,
    name,
    seriesLabel,
    shortDescription,
    description,
    materialLine,
    symbolismLabel: symbolismLabel || null,
    symbolismTitle: symbolismTitle || null,
    symbolismBody: symbolismBody || null,
    symbolismBody2: symbolismBody2 || null,
    details,
    imageUrl,
    ...(uploadedAssetId ? { primaryAssetId: uploadedAssetId } : removeImage ? { primaryAssetId: null } : {}),
    priceCents: Math.round(price * 100),
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
  if (existingVariant) {
    await db.productVariant.update({
      where: { id: existingVariant.id },
      data: { sku, priceCents: Math.round(price * 100), stockOnHand, status: isPublished ? "ACTIVE" : isUnlisted ? "UNLISTED" : "DRAFT" },
    });
  } else {
    await db.productVariant.create({
      data: { productId: product.id, sku, title: "Default Title", priceCents: Math.round(price * 100), stockOnHand, status: isPublished ? "ACTIVE" : isUnlisted ? "UNLISTED" : "DRAFT" },
    });
  }

  await db.productCollection.deleteMany({
    where: { productId: product.id },
  });

  if (collection) {
    await db.productCollection.create({
      data: {
        productId: product.id,
        collectionId: collection.id,
      },
    });
  }

  await syncDepartmentCollectionMembership(product.id, department);

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
  revalidateStorefrontPath(`/products/${product.slug}`);

  let savedProduct = await getSavedProductPayload(product.id);
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

  return {
    success: commerceChanged
      ? `${wasCreate ? "Product created" : "Product saved"} locally. Commerce changes are ready to push.`
      : `${wasCreate ? "Product created" : "Product saved"} locally. Shopify commerce data is unchanged.`,
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
  const { productId, seriesLabel, shortDescription, description, materialLine } = parsed.data;
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
  // department is no longer stored in details — it's ProductCollection
  // membership. Strip any legacy key left over from before this migration.
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
  if (action === "publish" && !before?.imageUrl) {
    return { error: "Product image is required before publishing." };
  }

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
    product: savedProduct,
  };
}
