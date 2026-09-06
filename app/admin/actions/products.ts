"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db";
import { revalidateStorefrontPath } from "@/lib/content/revalidate-storefront";
import { parseFormData } from "@/lib/forms/parse-form-data";
import { slugify } from "@/lib/text/slug";
import { saveProductImageUpload } from "@/lib/media/local-upload";
import { buildProductSearchDocument, parseCharacteristicsForm } from "@/lib/products/characteristics";
import { isShopifyConfigured } from "@/lib/shopify/config";
import { deleteShopifyProduct } from "@/lib/shopify/product-sync";
import {
  asRecord,
  createDraftToken,
  formValue,
  hasMeaningfulDraftInput,
  revalidateStorefront,
  writeAuditLog,
  type DraftAutosaveResult,
} from "./shared";
import { parseTags } from "./tags";

export type ProductActionState = {
  error?: string;
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
  priceCents: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  shopifyProductId: string | null;
  shopifyHandle: string | null;
  shopifyUpdatedAt: Date | null;
  lastSyncedAt: Date | null;
  syncStatus: "UNLINKED" | "PENDING" | "SYNCED" | "CONFLICT" | "FAILED";
  syncError: string | null;
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
  category: { id: string; slug: string; name: string } | null;
  collections: {
    id: string;
    sortOrder: number;
    collection: {
      id: string;
      slug: string;
      name: string;
    };
  }[];
  tags: {
    id: string;
    tag: { id: string; slug: string; name: string };
  }[];
};

export function productCommerceSignature(product: SavedProductPayload) {
  const primaryVariant = product.variants[0] ?? null;
  return JSON.stringify({
    name: product.name,
    slug: product.slug,
    description: product.description ?? "",
    imageUrl: product.imageUrl ?? "",
    status: product.status,
    visibility: product.visibility,
    sku: primaryVariant?.sku ?? product.sku,
    priceCents: primaryVariant?.priceCents ?? product.priceCents,
    compareAtCents: primaryVariant?.compareAtCents ?? null,
    stockOnHand: primaryVariant?.stockOnHand ?? 0,
    tags: product.tags.map((item) => item.tag.slug).sort(),
    characteristics: product.characteristics
      .map((item) => ({
        key: item.key,
        valueType: item.valueType,
        value: item.valueType === "BOOLEAN"
          ? Boolean(item.booleanValue)
          : item.valueType === "NUMBER"
            ? item.numberValue
            : item.textValue ?? "",
        certificateUrl: item.certificateUrl ?? "",
      }))
      .sort((left, right) => left.key.localeCompare(right.key)),
  });
}

export async function getSavedProductPayload(productId: string): Promise<SavedProductPayload> {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
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
      priceCents: true,
      status: true,
      visibility: true,
      shopifyProductId: true,
      shopifyHandle: true,
      shopifyUpdatedAt: true,
      lastSyncedAt: true,
      syncStatus: true,
      syncError: true,
      characteristics: { orderBy: [{ group: "asc" }, { sortOrder: "asc" }] },
      variants: { orderBy: { createdAt: "asc" } },
      category: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
      collections: {
        include: {
          collection: {
            select: {
              id: true,
              slug: true,
              name: true,
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
  categorySlug: z.string().trim().default(""),
  collectionSlug: z.string().trim().default(""),
  tags: z.string().trim().default(""),
  workflowState: z.string().trim().default("DRAFT"),
});

export async function saveProductAction(formData: FormData): Promise<ProductActionState> {
  const currentUser = await requireAdminSession("/admin/products");

  const parsed = parseFormData(formData, saveProductFieldsSchema);
  if (!parsed.success) {
    return { error: "Name, slug, SKU, and price are required." };
  }
  const {
    productId, sku, name, seriesLabel, shortDescription, description, materialLine,
    symbolismLabel, symbolismTitle, symbolismBody, symbolismBody2, categorySlug,
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
    department: formValue(formData, "department"),
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

  if (!slug || !sku || !name || !price) {
    return {
      error: "Name, slug, SKU, and price are required.",
    };
  }

  const category = categorySlug
    ? await db.productCategory.findUnique({ where: { slug: categorySlug }, select: { id: true } })
    : null;
  const collection = collectionSlug
    ? await db.collection.findUnique({ where: { slug: collectionSlug }, select: { id: true } })
    : null;

  const isPublished = workflowState === "PUBLISHED";
  if (isPublished && !imageUrl) {
    return { error: "Product image is required before publishing." };
  }

  const wasCreate = !productId;
  const before = productId ? await getSavedProductPayload(productId).catch(() => null) : null;

  const product = await db.product.upsert({
    where: productId ? { id: productId } : { slug },
    update: {
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
      ...(uploadedAssetId ? { primaryAssetId: uploadedAssetId } : {}),
      priceCents: Math.round(price * 100),
      categoryId: category?.id ?? null,
      status: isPublished ? "ACTIVE" : "DRAFT",
      visibility: isPublished ? "PUBLIC" : "PRIVATE",
      publishedAt: isPublished ? new Date() : null,
      searchDocument: buildProductSearchDocument({
        name, sku, slug, description, shortDescription, materialLine,
        tags: tagSlugs, characteristics,
      }),
    },
    create: {
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
      ...(uploadedAssetId ? { primaryAssetId: uploadedAssetId } : {}),
      priceCents: Math.round(price * 100),
      currency: "EUR",
      categoryId: category?.id ?? null,
      status: isPublished ? "ACTIVE" : "DRAFT",
      visibility: isPublished ? "PUBLIC" : "PRIVATE",
      publishedAt: isPublished ? new Date() : null,
      searchDocument: buildProductSearchDocument({
        name, sku, slug, description, shortDescription, materialLine,
        tags: tagSlugs, characteristics,
      }),
    },
    select: { id: true, slug: true },
  });

  const existingVariant = await db.productVariant.findFirst({ where: { productId: product.id }, orderBy: { createdAt: "asc" } });
  if (existingVariant) {
    await db.productVariant.update({
      where: { id: existingVariant.id },
      data: { sku, priceCents: Math.round(price * 100), stockOnHand, status: isPublished ? "ACTIVE" : "DRAFT" },
    });
  } else {
    await db.productVariant.create({
      data: { productId: product.id, sku, title: "Default Title", priceCents: Math.round(price * 100), stockOnHand, status: isPublished ? "ACTIVE" : "DRAFT" },
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
  price: z.string().trim().default("0"),
  removeImage: z.string().trim().default(""),
  existingImageUrl: z.string().trim().default(""),
});

export async function autosaveProductDraftAction(formData: FormData): Promise<DraftAutosaveResult> {
  await requireAdminSession("/admin/products");

  if (!hasMeaningfulDraftInput(formData, ["productId", "workflowState", "existingImageUrl"])) {
    return {};
  }

  const parsed = parseFormData(formData, autosaveProductFieldsSchema);
  if (!parsed.success) {
    return {};
  }
  const { productId, seriesLabel, shortDescription, description, materialLine } = parsed.data;
  const slug = slugify(parsed.data.slug) || createDraftToken("draft-product");
  const sku = parsed.data.sku || createDraftToken("sku").toUpperCase();
  const name = parsed.data.name || "Untitled product";
  const price = Number(parsed.data.price || "0");
  const removeImage = parsed.data.removeImage === "1";
  const existingImageUrl = removeImage ? "" : parsed.data.existingImageUrl;
  const existingProduct = productId
    ? await db.product.findUnique({ where: { id: productId }, select: { details: true } })
    : null;
  const department = formValue(formData, "department");
  const attributes = Array.from({ length: 8 }, (_, index) => ({
    label: formValue(formData, `attributeLabel${index + 1}`),
    value: formValue(formData, `attributeValue${index + 1}`),
  })).filter((item) => item.label && item.value);
  const draftDetails = {
    ...asRecord(existingProduct?.details),
    department: department || null,
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
    details: draftDetails,
    imageUrl: existingImageUrl || null,
    priceCents: Number.isFinite(price) ? Math.round(price * 100) : 0,
    status: "DRAFT" as const,
    visibility: "PRIVATE" as const,
    publishedAt: null,
  };

  const product = productId
    ? await db.product.update({
        where: { id: productId },
        data: productData,
        select: { id: true },
      })
    : await db.product.create({
        data: productData,
        select: { id: true },
      });

  revalidatePath("/admin/products");
  revalidatePath("/admin");
  return { recordId: product.id };
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
