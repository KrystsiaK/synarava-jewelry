"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { saveProductImageUpload } from "@/lib/media/local-upload";

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

function revalidateStorefront() {
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/collections");
  revalidatePath("/about");
  revalidatePath("/about/manifesto");
  revalidatePath("/admin");
  revalidatePath("/admin/pages");
  revalidatePath("/admin/products");
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

export async function saveCollectionAction(formData: FormData) {
  await requirePermission("products.manage", "/admin/products");

  const collectionId = String(formData.get("collectionId") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const subtitle = String(formData.get("subtitle") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const symbolismLabel = String(formData.get("symbolismLabel") ?? "").trim();
  const symbolismTitle = String(formData.get("symbolismTitle") ?? "").trim();
  const symbolismBody = String(formData.get("symbolismBody") ?? "").trim();
  const symbolismBody2 = String(formData.get("symbolismBody2") ?? "").trim();

  if (!slug || !name) {
    return;
  }

  const baseData = {
    slug,
    name,
    subtitle: subtitle || null,
    description: description || null,
    symbolismLabel: symbolismLabel || null,
    symbolismTitle: symbolismTitle || null,
    symbolismBody: symbolismBody || null,
    symbolismBody2: symbolismBody2 || null,
    status: "ACTIVE" as const,
    visibility: "PUBLIC" as const,
    publishedAt: new Date(),
  };

  await db.collection.upsert({
    where: collectionId ? { id: collectionId } : { slug },
    update: baseData,
    create: baseData,
  });

  revalidateStorefront();
  revalidatePath("/admin/products");
}

export async function saveProductAction(formData: FormData) {
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

  if (!slug || !sku || !name || !price) {
    return;
  }

  const category = categorySlug
    ? await db.productCategory.findUnique({ where: { slug: categorySlug }, select: { id: true } })
    : null;
  const collection = collectionSlug
    ? await db.collection.findUnique({ where: { slug: collectionSlug }, select: { id: true } })
    : null;

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
      imageUrl,
      ...(uploadedAssetId ? { primaryAssetId: uploadedAssetId } : {}),
      priceCents: Math.round(price * 100),
      categoryId: category?.id ?? null,
      status: "ACTIVE",
      visibility: "PUBLIC",
      publishedAt: new Date(),
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
      imageUrl,
      ...(uploadedAssetId ? { primaryAssetId: uploadedAssetId } : {}),
      priceCents: Math.round(price * 100),
      currency: "EUR",
      categoryId: category?.id ?? null,
      status: "ACTIVE",
      visibility: "PUBLIC",
      publishedAt: new Date(),
    },
    select: { id: true, slug: true },
  });

  if (collection) {
    await db.productCollection.upsert({
      where: {
        productId_collectionId: {
          productId: product.id,
          collectionId: collection.id,
        },
      },
      update: {},
      create: {
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
}
