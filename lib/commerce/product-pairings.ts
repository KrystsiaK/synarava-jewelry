import "server-only";

import { db } from "@/lib/db";
import { deleteStoredGalleryObject } from "@/lib/products/gallery";

export class ProductPairingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductPairingError";
  }
}

/** Forbid self-link, role crossover (base↔addon), and duplicates. */
export async function assertPairingAllowed(
  baseProductId: string,
  addonProductId: string,
): Promise<void> {
  if (baseProductId === addonProductId) {
    throw new ProductPairingError("A product cannot be paired with itself.");
  }

  const [baseAsAddon, addonAsBase, existing] = await Promise.all([
    db.productPairing.findFirst({
      where: { addonProductId: baseProductId },
      select: { id: true },
    }),
    db.productPairing.findFirst({
      where: { baseProductId: addonProductId },
      select: { id: true },
    }),
    db.productPairing.findUnique({
      where: {
        baseProductId_addonProductId: { baseProductId, addonProductId },
      },
      select: { id: true },
    }),
  ]);

  if (baseAsAddon) {
    throw new ProductPairingError("This product is already an addon and cannot be a base.");
  }
  if (addonAsBase) {
    throw new ProductPairingError("This product is already a base and cannot be an addon.");
  }
  if (existing) {
    throw new ProductPairingError("This pairing already exists.");
  }
}

export async function createProductPairing(input: {
  baseProductId: string;
  addonProductId: string;
  imageAssetId?: string | null;
  sortOrder?: number;
}) {
  await assertPairingAllowed(input.baseProductId, input.addonProductId);
  return db.productPairing.create({
    data: {
      baseProductId: input.baseProductId,
      addonProductId: input.addonProductId,
      imageAssetId: input.imageAssetId ?? null,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export async function updateProductPairing(
  pairingId: string,
  data: { imageAssetId?: string | null; sortOrder?: number },
) {
  const previous = await db.productPairing.findUnique({
    where: { id: pairingId },
    select: {
      id: true,
      imageAssetId: true,
      imageAsset: { select: { id: true, key: true } },
    },
  });
  if (!previous) throw new ProductPairingError("Pairing not found.");

  const next = await db.productPairing.update({
    where: { id: pairingId },
    data: {
      ...(data.imageAssetId !== undefined ? { imageAssetId: data.imageAssetId } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
    },
  });

  if (
    data.imageAssetId !== undefined
    && previous.imageAssetId
    && previous.imageAssetId !== data.imageAssetId
  ) {
    await maybeDeleteOrphanPairingAsset(previous.imageAssetId, previous.imageAsset?.key ?? null);
  }

  return next;
}

export async function deleteProductPairing(pairingId: string) {
  const previous = await db.productPairing.findUnique({
    where: { id: pairingId },
    select: {
      id: true,
      imageAssetId: true,
      imageAsset: { select: { id: true, key: true } },
    },
  });
  if (!previous) throw new ProductPairingError("Pairing not found.");

  await db.productPairing.delete({ where: { id: pairingId } });

  if (previous.imageAssetId) {
    await maybeDeleteOrphanPairingAsset(previous.imageAssetId, previous.imageAsset?.key ?? null);
  }
}

async function maybeDeleteOrphanPairingAsset(assetId: string, storageKey: string | null) {
  const stillUsed = await db.productPairing.count({
    where: { imageAssetId: assetId },
  });
  if (stillUsed > 0) return;

  const asset = storageKey
    ? { id: assetId, key: storageKey }
    : await db.mediaAsset.findUnique({
        where: { id: assetId },
        select: { id: true, key: true },
      });
  if (!asset) return;

  try {
    await deleteStoredGalleryObject(asset.key);
  } catch {
    // Best-effort S3 cleanup — still drop the DB row when unreferenced.
  }
  await db.mediaAsset.delete({ where: { id: asset.id } }).catch(() => undefined);
}

export async function pairingExistsBetween(
  productIdA: string,
  productIdB: string,
): Promise<boolean> {
  const row = await db.productPairing.findFirst({
    where: {
      OR: [
        { baseProductId: productIdA, addonProductId: productIdB },
        { baseProductId: productIdB, addonProductId: productIdA },
      ],
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function listPairingsForProduct(productId: string) {
  return db.productPairing.findMany({
    where: {
      OR: [{ baseProductId: productId }, { addonProductId: productId }],
    },
    include: {
      baseProduct: { select: { id: true, slug: true, name: true, status: true, visibility: true } },
      addonProduct: { select: { id: true, slug: true, name: true, status: true, visibility: true } },
      imageAsset: { select: { id: true, key: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function listWornTogetherTitlesByMerchandiseIds(
  merchandiseIds: string[],
): Promise<Map<string, string[]>> {
  if (merchandiseIds.length === 0) return new Map();

  const variants = await db.productVariant.findMany({
    where: { shopifyVariantId: { in: merchandiseIds } },
    select: {
      shopifyVariantId: true,
      productId: true,
      product: { select: { id: true, name: true } },
    },
  });

  const productIdByMerch = new Map<string, string>();
  const titleByProductId = new Map<string, string>();
  for (const variant of variants) {
    if (!variant.shopifyVariantId) continue;
    productIdByMerch.set(variant.shopifyVariantId, variant.productId);
    titleByProductId.set(variant.productId, variant.product.name);
  }

  const productIds = [...new Set(productIdByMerch.values())];
  if (productIds.length === 0) return new Map();

  const pairings = await db.productPairing.findMany({
    where: {
      OR: [
        { baseProductId: { in: productIds } },
        { addonProductId: { in: productIds } },
      ],
    },
    select: { baseProductId: true, addonProductId: true },
  });

  const partnersByProduct = new Map<string, Set<string>>();
  for (const pairing of pairings) {
    const baseSet = partnersByProduct.get(pairing.baseProductId) ?? new Set();
    baseSet.add(pairing.addonProductId);
    partnersByProduct.set(pairing.baseProductId, baseSet);

    const addonSet = partnersByProduct.get(pairing.addonProductId) ?? new Set();
    addonSet.add(pairing.baseProductId);
    partnersByProduct.set(pairing.addonProductId, addonSet);
  }

  const cartProductIds = new Set(productIds);
  const result = new Map<string, string[]>();
  for (const [merchandiseId, productId] of productIdByMerch) {
    const partnerIds = partnersByProduct.get(productId);
    if (!partnerIds) continue;
    const titles = [...partnerIds]
      .filter((id) => cartProductIds.has(id) && id !== productId)
      .map((id) => titleByProductId.get(id))
      .filter((title): title is string => Boolean(title));
    if (titles.length > 0) result.set(merchandiseId, titles);
  }
  return result;
}
