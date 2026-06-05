"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { saveCollectionImageUpload, saveProductImageUpload } from "@/lib/media/local-upload";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseTags(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((item) => slugify(item))
        .filter(Boolean),
    ),
  );
}

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function uploadOptionalProductAsset(input: {
  formData: FormData;
  fieldName: string;
  existingValue: string;
  currentUserId?: string | null;
}) {
  const file = input.formData.get(input.fieldName);

  if (!(file instanceof File) || file.size === 0) {
    return input.existingValue.trim();
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
      source: "UPLOAD",
      status: "READY",
      uploadedById: input.currentUserId ?? null,
    },
    select: { id: true },
  });

  return uploaded.publicPath;
}

function revalidateStorefront() {
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/collections");
  revalidatePath("/collections/[slug]", "page");
  revalidatePath("/products/[slug]", "page");
  revalidatePath("/about");
  revalidatePath("/about/manifesto");
}

export type CollectionActionState = {
  error?: string;
  success?: string;
  resetKey?: number;
  fieldErrors?: Partial<Record<CollectionFieldName, string>>;
  collection?: SavedCollectionPayload;
  deletedCollectionId?: string;
};

export type CollectionFieldName =
  | "name"
  | "slug"
  | "description"
  | "workflowState"
  | "heroImageFile";

export type SavedCollectionPayload = {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  subtitle: string | null;
  description: string | null;
  manifesto: string | null;
  searchSummary: string | null;
  symbolismLabel: string | null;
  symbolismTitle: string | null;
  symbolismBody: string | null;
  symbolismBody2: string | null;
  heroImageUrl: string | null;
  sortOrder: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
};

export type ProductActionState = {
  error?: string;
  success?: string;
  product?: SavedProductPayload;
  deletedProductId?: string;
  created?: boolean;
};

export type SavedProductPayload = {
  id: string;
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

function validateCollectionInput(input: {
  name: string;
  slug: string;
  description: string;
  workflowState: string;
}) {
  const fieldErrors: Partial<Record<CollectionFieldName, string>> = {};

  if (!input.name) {
    fieldErrors.name = "Collection name is required.";
  }

  if (!input.slug) {
    fieldErrors.slug = "Slug is required.";
  }

  if (!input.description) {
    fieldErrors.description = "Collection summary is required.";
  }

  if (input.workflowState !== "DRAFT" && input.workflowState !== "PUBLISHED") {
    fieldErrors.workflowState = "Choose Draft or Published.";
  }

  return fieldErrors;
}

export async function savePageAction(formData: FormData) {
  await requirePermission("pages.manage", "/admin/pages");

  const slug = String(formData.get("slug") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const eyebrow = String(formData.get("eyebrow") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const ctaLabel = String(formData.get("ctaLabel") ?? "").trim();
  const ctaHref = String(formData.get("ctaHref") ?? "").trim();
  const quote = String(formData.get("quote") ?? "").trim();
  const secondaryTitle = String(formData.get("secondaryTitle") ?? "").trim();
  const secondaryBody = String(formData.get("secondaryBody") ?? "").trim();

  await db.page.update({
    where: { slug },
    data: {
      title,
      excerpt,
      content: {
        eyebrow,
        body,
        ctaLabel,
        ctaHref,
        quote,
        secondaryTitle,
        secondaryBody,
      },
      status: "PUBLISHED",
      visibility: "PUBLIC",
      publishedAt: new Date(),
    },
  });

  revalidateStorefront();
  revalidatePath(`/admin/pages?updated=${slug}`);
}

export async function saveCategoryAction(formData: FormData) {
  await requirePermission("products.manage", "/admin/products");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return;
  }

  const slug = slugify(String(formData.get("slug") ?? "") || name);
  const description = String(formData.get("description") ?? "").trim();

  await db.productCategory.upsert({
    where: { slug },
    update: {
      name,
      description,
    },
    create: {
      slug,
      name,
      description,
    },
  });

  revalidateStorefront();
  revalidatePath("/admin/products");
}

export async function saveTagAction(formData: FormData) {
  await requirePermission("products.manage", "/admin/products");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return;
  }

  const slug = slugify(String(formData.get("slug") ?? "") || name);

  await db.tag.upsert({
    where: { slug },
    update: {
      name,
    },
    create: {
      slug,
      name,
    },
  });

  revalidateStorefront();
  revalidatePath("/admin/products");
}

export async function saveCollectionAction(
  _prevState: CollectionActionState,
  formData: FormData,
): Promise<CollectionActionState> {
  await requirePermission("products.manage", "/admin/collections");
  const currentUser = await getCurrentUser();

  const collectionId = String(formData.get("collectionId") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "").trim());
  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const subtitle = String(formData.get("subtitle") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const manifesto = String(formData.get("manifesto") ?? "").trim();
  const searchSummary = String(formData.get("searchSummary") ?? "").trim();
  const symbolismLabel = String(formData.get("symbolismLabel") ?? "").trim();
  const symbolismTitle = String(formData.get("symbolismTitle") ?? "").trim();
  const symbolismBody = String(formData.get("symbolismBody") ?? "").trim();
  const symbolismBody2 = String(formData.get("symbolismBody2") ?? "").trim();
  const existingHeroImageUrl = String(formData.get("existingHeroImageUrl") ?? "").trim();
  const workflowState = String(formData.get("workflowState") ?? "DRAFT").trim();
  const sortOrder = Number(String(formData.get("sortOrder") ?? "0").trim() || "0");
  const imageFile = formData.get("heroImageFile");

  const fieldErrors = validateCollectionInput({
    name,
    slug,
    description,
    workflowState,
  });

  if (Object.keys(fieldErrors).length > 0) {
    return {
      error: "Please fix the required fields and try again.",
      fieldErrors,
    };
  }

  let heroImageUrl = existingHeroImageUrl || null;
  let uploadedAssetId: string | null = null;

  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      const uploaded = await saveCollectionImageUpload(imageFile);
      if (uploaded) {
        heroImageUrl = uploaded.publicPath;
        const asset = await db.mediaAsset.create({
          data: {
            key: uploaded.storageKey,
            filename: uploaded.filename,
            mimeType: uploaded.mimeType,
            extension: uploaded.extension.replace(/^\./, ""),
            sizeBytes: uploaded.sizeBytes,
            source: "UPLOAD",
            status: "READY",
            uploadedById: currentUser?.id ?? null,
          },
          select: { id: true },
        });
        uploadedAssetId = asset.id;
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Collection image upload failed.",
      };
    }
  }

  const isPublished = workflowState === "PUBLISHED";

  const baseData = {
    slug,
    code: code || null,
    name,
    subtitle: subtitle || null,
    description: description || null,
    manifesto: manifesto || null,
    searchSummary: searchSummary || null,
    symbolismLabel: symbolismLabel || null,
    symbolismTitle: symbolismTitle || null,
    symbolismBody: symbolismBody || null,
    symbolismBody2: symbolismBody2 || null,
    heroImageUrl,
    ...(uploadedAssetId ? { heroAssetId: uploadedAssetId } : {}),
    status: (isPublished ? "ACTIVE" : "DRAFT") as "DRAFT" | "ACTIVE",
    visibility: (isPublished ? "PUBLIC" : "PRIVATE") as "PRIVATE" | "PUBLIC",
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    publishedAt: isPublished ? new Date() : null,
  };

  const savedCollection = await db.collection.upsert({
    where: collectionId ? { id: collectionId } : { slug },
    update: baseData,
    create: baseData,
    select: {
      id: true,
      name: true,
      slug: true,
      code: true,
      subtitle: true,
      description: true,
      manifesto: true,
      searchSummary: true,
      symbolismLabel: true,
      symbolismTitle: true,
      symbolismBody: true,
      symbolismBody2: true,
      heroImageUrl: true,
      sortOrder: true,
      status: true,
      visibility: true,
    },
  });

  revalidateStorefront();
  return {
    success: collectionId ? "Collection updated." : "Collection created.",
    resetKey: collectionId ? undefined : Date.now(),
    collection: savedCollection,
  };
}

export async function deleteCollectionAction(
  _prevState: CollectionActionState,
  formData: FormData,
): Promise<CollectionActionState> {
  await requirePermission("products.manage", "/admin/collections");

  const collectionId = String(formData.get("collectionId") ?? "").trim();
  const collectionSlug = String(formData.get("collectionSlug") ?? "").trim();

  if (!collectionId) {
    return { error: "Collection id is missing." };
  }

  await db.collection.delete({
    where: { id: collectionId },
  });

  revalidateStorefront();
  return {
    success: collectionSlug ? `Collection ${collectionSlug} deleted.` : "Collection deleted.",
    resetKey: Date.now(),
    deletedCollectionId: collectionId,
  };
}

export async function saveProductAction(formData: FormData): Promise<ProductActionState> {
  await requirePermission("products.manage", "/admin/products");
  const currentUser = await getCurrentUser();

  const productId = String(formData.get("productId") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? ""));
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const seriesLabel = String(formData.get("seriesLabel") ?? "").trim();
  const shortDescription = String(formData.get("shortDescription") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const materialLine = String(formData.get("materialLine") ?? "").trim();
  const symbolismLabel = String(formData.get("symbolismLabel") ?? "").trim();
  const symbolismTitle = String(formData.get("symbolismTitle") ?? "").trim();
  const symbolismBody = String(formData.get("symbolismBody") ?? "").trim();
  const symbolismBody2 = String(formData.get("symbolismBody2") ?? "").trim();
  const existingImageUrl = String(formData.get("existingImageUrl") ?? "").trim();
  const price = Number(String(formData.get("price") ?? "0").trim() || "0");
  const categorySlug = String(formData.get("categorySlug") ?? "").trim();
  const collectionSlug = String(formData.get("collectionSlug") ?? "").trim();
  const tagInput = String(formData.get("tags") ?? "").trim();
  const workflowState = String(formData.get("workflowState") ?? "DRAFT").trim();
  const imageFile = formData.get("imageFile");

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
          source: "UPLOAD",
          status: "READY",
          uploadedById: currentUser?.id ?? null,
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
        currentUserId: currentUser?.id,
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
    currentUserId: currentUser?.id,
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
        currentUserId: currentUser?.id,
      });

      return {
        src,
        label: formValue(formData, `lookbookLabel${index}`),
        featured: String(formData.get(`lookbookFeatured${index}`) ?? "") === "on",
      };
    }),
  );

  const details = {
    materials: materialEntries.filter((item) => item.title && item.body && item.image),
    process: {
      eyebrow: formValue(formData, "processEyebrow"),
      title: formValue(formData, "processTitle"),
      mediaImage: processMediaImage,
      stats: processStats,
    },
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

  const wasCreate = !productId;

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
    },
    select: {
      id: true,
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

  for (const tagSlug of parseTags(tagInput)) {
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

  revalidateStorefront();
  revalidatePath("/admin/products");
  revalidatePath(`/products/${product.slug}`);

  return {
    success: wasCreate ? "Product created." : "Product updated.",
    created: wasCreate,
    product,
  };
}

export async function deleteProductAction(formData: FormData): Promise<ProductActionState> {
  await requirePermission("products.manage", "/admin/products");

  const productId = String(formData.get("productId") ?? "").trim();
  const productSlug = String(formData.get("productSlug") ?? "").trim();

  if (!productId) {
    return {
      error: "Product id is missing.",
    };
  }

  await db.product.delete({
    where: { id: productId },
  });

  revalidateStorefront();
  revalidatePath("/admin/products");

  if (productSlug) {
    revalidatePath(`/products/${productSlug}`);
  }

  return {
    success: "Product deleted.",
    deletedProductId: productId,
  };
}
