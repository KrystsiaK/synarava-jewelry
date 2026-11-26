"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminSession } from "@/lib/auth/admin-session";
import {
  addProductPairingImage,
  createProductPairing,
  deleteProductPairing,
  deleteProductPairingImage,
  listPairingsForProduct,
  ProductPairingError,
  reorderProductPairingImage,
} from "@/lib/commerce/product-pairings";
import {
  revalidateStorefront,
  revalidateStorefrontPath,
} from "@/lib/content/revalidate-storefront";
import { db } from "@/lib/db";
import { savePairingImageUpload } from "@/lib/media/local-upload";
import { deleteStoredGalleryObject } from "@/lib/products/gallery";
import { getS3Bucket, getS3PublicUrl } from "@/lib/s3";

export type ProductPairingActionState = {
  error?: string;
  success?: string;
  pairings?: AdminProductPairingRow[];
};

export type AdminProductPairingImage = {
  id: string;
  imageAssetId: string;
  imageUrl: string;
  sortOrder: number;
};

export type AdminProductPairingRow = {
  id: string;
  baseProductId: string;
  addonProductId: string;
  sortOrder: number;
  images: AdminProductPairingImage[];
  partner: {
    id: string;
    slug: string;
    name: string;
    status: string;
    visibility: string;
    hasShopifyVariant: boolean;
  };
  role: "base" | "addon";
};

const idSchema = z.string().trim().min(1).max(64);

function actionError(error: unknown): ProductPairingActionState {
  if (error instanceof ProductPairingError) return { error: error.message };
  if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? "Invalid input." };
  return { error: error instanceof Error ? error.message : "Pairing update failed." };
}

async function loadAdminPairings(productId: string): Promise<AdminProductPairingRow[]> {
  const rows = await listPairingsForProduct(productId);
  return rows.map((row) => {
    const isBase = row.baseProductId === productId;
    const partner = isBase ? row.addonProduct : row.baseProduct;
    return {
      id: row.id,
      baseProductId: row.baseProductId,
      addonProductId: row.addonProductId,
      sortOrder: row.sortOrder,
      images: row.images.map((image) => ({
        id: image.id,
        imageAssetId: image.imageAssetId,
        imageUrl: getS3PublicUrl(image.imageAsset.key),
        sortOrder: image.sortOrder,
      })),
      partner: {
        id: partner.id,
        slug: partner.slug,
        name: partner.name,
        status: partner.status,
        visibility: partner.visibility,
        hasShopifyVariant: partner.variants.some((variant) => Boolean(variant.shopifyVariantId)),
      },
      role: isBase ? ("addon" as const) : ("base" as const),
    };
  });
}

async function revalidatePairingProducts(productIds: string[]) {
  revalidatePath("/admin/products");
  revalidateStorefront();
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;
  const products = await db.product.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, slug: true },
  });
  for (const product of products) {
    revalidatePath(`/admin/products/${product.slug}`);
    revalidateStorefrontPath(`/products/${product.slug}`);
  }
}

async function finish(productIds: string[], success: string): Promise<ProductPairingActionState> {
  await revalidatePairingProducts(productIds);
  const primary = productIds[0];
  return {
    success,
    pairings: primary ? await loadAdminPairings(primary) : undefined,
  };
}

export async function listProductPairingsAction(
  productId: string,
): Promise<ProductPairingActionState> {
  await requireAdminSession("/admin/products");
  const id = idSchema.parse(productId);
  return { pairings: await loadAdminPairings(id) };
}

export async function searchPairingCandidatesAction(
  productId: string,
  query: string,
): Promise<Array<{ id: string; slug: string; name: string; sku: string }>> {
  await requireAdminSession("/admin/products");
  const baseId = idSchema.parse(productId);
  const q = query.trim().slice(0, 80);
  if (q.length < 1) return [];

  // Current product is already an addon → read-only on storefront; no new links from here.
  const asAddon = await db.productPairing.findFirst({
    where: { addonProductId: baseId },
    select: { id: true },
  });
  if (asAddon) return [];

  const [existingAddons, usedAsBase] = await Promise.all([
    db.productPairing.findMany({
      where: { baseProductId: baseId },
      select: { addonProductId: true },
    }),
    db.productPairing.findMany({
      distinct: ["baseProductId"],
      select: { baseProductId: true },
    }),
  ]);

  const excluded = new Set<string>([
    baseId,
    ...existingAddons.map((row) => row.addonProductId),
    ...usedAsBase.map((row) => row.baseProductId),
  ]);

  return db.product.findMany({
    where: {
      id: { notIn: [...excluded] },
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, slug: true, name: true, sku: true },
    take: 12,
    orderBy: { name: "asc" },
  });
}

export async function createProductPairingAction(
  baseProductId: string,
  addonProductId: string,
): Promise<ProductPairingActionState> {
  await requireAdminSession("/admin/products");
  try {
    const baseId = idSchema.parse(baseProductId);
    const addonId = idSchema.parse(addonProductId);
    const maxSort = await db.productPairing.aggregate({
      where: { baseProductId: baseId },
      _max: { sortOrder: true },
    });
    await createProductPairing({
      baseProductId: baseId,
      addonProductId: addonId,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    });
    return finish([baseId, addonId], "Pairing created.");
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteProductPairingAction(
  pairingId: string,
  productId: string,
): Promise<ProductPairingActionState> {
  await requireAdminSession("/admin/products");
  try {
    const id = idSchema.parse(pairingId);
    const ownerId = idSchema.parse(productId);
    const row = await db.productPairing.findUnique({
      where: { id },
      select: { baseProductId: true, addonProductId: true },
    });
    if (!row) return { error: "Pairing not found." };
    await deleteProductPairing(id);
    return finish([ownerId, row.baseProductId, row.addonProductId], "Pairing removed.");
  } catch (error) {
    return actionError(error);
  }
}

export async function reorderProductPairingAction(
  productId: string,
  pairingId: string,
  direction: "up" | "down",
): Promise<ProductPairingActionState> {
  await requireAdminSession("/admin/products");
  try {
    const ownerId = idSchema.parse(productId);
    const id = idSchema.parse(pairingId);
    const rows = await db.productPairing.findMany({
      where: { baseProductId: ownerId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, sortOrder: true, addonProductId: true },
    });
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) return { error: "Pairing not found on this base product." };
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= rows.length) {
      return { pairings: await loadAdminPairings(ownerId) };
    }
    const left = rows[index];
    const right = rows[swapWith];
    await db.$transaction([
      db.productPairing.update({ where: { id: left.id }, data: { sortOrder: right.sortOrder } }),
      db.productPairing.update({ where: { id: right.id }, data: { sortOrder: left.sortOrder } }),
    ]);
    return finish(
      [ownerId, left.addonProductId, right.addonProductId],
      "Pairing order updated.",
    );
  } catch (error) {
    return actionError(error);
  }
}

export async function uploadProductPairingImageAction(
  formData: FormData,
): Promise<ProductPairingActionState> {
  const currentUser = await requireAdminSession("/admin/products");
  try {
    const pairingId = idSchema.parse(String(formData.get("pairingId") ?? ""));
    const productId = idSchema.parse(String(formData.get("productId") ?? ""));
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Choose an image to upload." };
    }

    const pairing = await db.productPairing.findUnique({
      where: { id: pairingId },
      select: { baseProductId: true, addonProductId: true },
    });
    if (!pairing) return { error: "Pairing not found." };

    const uploaded = await savePairingImageUpload(file);
    if (!uploaded) return { error: "The image could not be uploaded." };

    let assetId: string | null = null;
    try {
      const asset = await db.mediaAsset.create({
        data: {
          key: uploaded.storageKey,
          filename: uploaded.filename,
          mimeType: uploaded.mimeType,
          extension: uploaded.extension,
          sizeBytes: uploaded.sizeBytes,
          width: uploaded.width,
          height: uploaded.height,
          bucket: getS3Bucket(),
          source: "UPLOAD",
          status: "READY",
          uploadedByUsername: currentUser?.username ?? null,
          alt: null,
        },
      });
      assetId = asset.id;
      await addProductPairingImage(pairingId, asset.id);
    } catch (error) {
      try {
        await deleteStoredGalleryObject(uploaded.storageKey);
      } catch {
        // best-effort
      }
      if (assetId) {
        await db.mediaAsset.delete({ where: { id: assetId } }).catch(() => undefined);
      }
      throw error;
    }

    return finish(
      [productId, pairing.baseProductId, pairing.addonProductId],
      "Pairing photo added.",
    );
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteProductPairingImageAction(
  imageRowId: string,
  productId: string,
): Promise<ProductPairingActionState> {
  await requireAdminSession("/admin/products");
  try {
    const id = idSchema.parse(imageRowId);
    const ownerId = idSchema.parse(productId);
    const row = await db.productPairingImage.findUnique({
      where: { id },
      select: {
        pairing: { select: { baseProductId: true, addonProductId: true } },
      },
    });
    if (!row) return { error: "Pairing photo not found." };
    await deleteProductPairingImage(id);
    return finish(
      [ownerId, row.pairing.baseProductId, row.pairing.addonProductId],
      "Pairing photo removed.",
    );
  } catch (error) {
    return actionError(error);
  }
}

export async function reorderProductPairingImageAction(
  pairingId: string,
  imageRowId: string,
  direction: "up" | "down",
  productId: string,
): Promise<ProductPairingActionState> {
  await requireAdminSession("/admin/products");
  try {
    const id = idSchema.parse(pairingId);
    const imageId = idSchema.parse(imageRowId);
    const ownerId = idSchema.parse(productId);
    const pairing = await db.productPairing.findUnique({
      where: { id },
      select: { baseProductId: true, addonProductId: true },
    });
    if (!pairing) return { error: "Pairing not found." };
    await reorderProductPairingImage(id, imageId, direction);
    return finish(
      [ownerId, pairing.baseProductId, pairing.addonProductId],
      "Pairing photo order updated.",
    );
  } catch (error) {
    return actionError(error);
  }
}
