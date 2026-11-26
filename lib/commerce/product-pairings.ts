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
  sortOrder?: number;
}) {
  await assertPairingAllowed(input.baseProductId, input.addonProductId);
  return db.productPairing.create({
    data: {
      baseProductId: input.baseProductId,
      addonProductId: input.addonProductId,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export async function updateProductPairing(
  pairingId: string,
  data: { sortOrder?: number },
) {
  const previous = await db.productPairing.findUnique({
    where: { id: pairingId },
    select: { id: true },
  });
  if (!previous) throw new ProductPairingError("Pairing not found.");

  return db.productPairing.update({
    where: { id: pairingId },
    data: {
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
    },
  });
}

export async function addProductPairingImage(
  pairingId: string,
  imageAssetId: string,
) {
  const pairing = await db.productPairing.findUnique({
    where: { id: pairingId },
    select: { id: true },
  });
  if (!pairing) throw new ProductPairingError("Pairing not found.");

  const maxSort = await db.productPairingImage.aggregate({
    where: { pairingId },
    _max: { sortOrder: true },
  });

  return db.productPairingImage.create({
    data: {
      pairingId,
      imageAssetId,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });
}

export async function deleteProductPairingImage(imageRowId: string) {
  const previous = await db.productPairingImage.findUnique({
    where: { id: imageRowId },
    select: {
      id: true,
      imageAssetId: true,
      imageAsset: { select: { id: true, key: true } },
    },
  });
  if (!previous) throw new ProductPairingError("Pairing photo not found.");

  await db.productPairingImage.delete({ where: { id: imageRowId } });
  await maybeDeleteOrphanPairingAsset(
    previous.imageAssetId,
    previous.imageAsset?.key ?? null,
  );
}

export async function reorderProductPairingImage(
  pairingId: string,
  imageRowId: string,
  direction: "up" | "down",
) {
  const rows = await db.productPairingImage.findMany({
    where: { pairingId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, sortOrder: true },
  });
  const index = rows.findIndex((row) => row.id === imageRowId);
  if (index < 0) throw new ProductPairingError("Pairing photo not found.");
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= rows.length) return rows;

  const left = rows[index];
  const right = rows[swapWith];
  await db.$transaction([
    db.productPairingImage.update({
      where: { id: left.id },
      data: { sortOrder: right.sortOrder },
    }),
    db.productPairingImage.update({
      where: { id: right.id },
      data: { sortOrder: left.sortOrder },
    }),
  ]);
  return db.productPairingImage.findMany({
    where: { pairingId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function deleteProductPairing(pairingId: string) {
  const previous = await db.productPairing.findUnique({
    where: { id: pairingId },
    select: {
      id: true,
      images: {
        select: {
          imageAssetId: true,
          imageAsset: { select: { key: true } },
        },
      },
    },
  });
  if (!previous) throw new ProductPairingError("Pairing not found.");

  const assets = previous.images.map((row) => ({
    assetId: row.imageAssetId,
    key: row.imageAsset?.key ?? null,
  }));

  await db.productPairing.delete({ where: { id: pairingId } });
  await deleteOrphanPairingAssets(assets);
}

export async function maybeDeleteOrphanPairingAsset(
  assetId: string,
  storageKey: string | null,
) {
  const stillUsed = await db.productPairingImage.count({
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

/** Collect pair photos before cascading product delete, then drop orphans. */
export async function cleanupPairingAssetsForDeletedProduct(productId: string) {
  const rows = await db.productPairing.findMany({
    where: {
      OR: [{ baseProductId: productId }, { addonProductId: productId }],
    },
    select: {
      images: {
        select: {
          imageAssetId: true,
          imageAsset: { select: { key: true } },
        },
      },
    },
  });
  return rows.flatMap((row) =>
    row.images.map((image) => ({
      assetId: image.imageAssetId,
      key: image.imageAsset?.key ?? null,
    })),
  );
}

export async function deleteOrphanPairingAssets(
  assets: Array<{ assetId: string; key: string | null }>,
) {
  const seen = new Set<string>();
  for (const asset of assets) {
    if (seen.has(asset.assetId)) continue;
    seen.add(asset.assetId);
    await maybeDeleteOrphanPairingAsset(asset.assetId, asset.key);
  }
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
      baseProduct: {
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          visibility: true,
          variants: { select: { shopifyVariantId: true }, take: 5 },
        },
      },
      addonProduct: {
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          visibility: true,
          variants: { select: { shopifyVariantId: true }, take: 5 },
        },
      },
      images: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          sortOrder: true,
          imageAssetId: true,
          imageAsset: { select: { id: true, key: true } },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * Map cart merchandiseId → partner merchandiseIds also in the cart that share
 * a ProductPairing. Titles come from cart lines later — never Product.name.
 */
export async function listWornTogetherMerchandiseIdsByMerchandiseIds(
  merchandiseIds: string[],
): Promise<Map<string, string[]>> {
  if (merchandiseIds.length === 0) return new Map();

  const variants = await db.productVariant.findMany({
    where: { shopifyVariantId: { in: merchandiseIds } },
    select: {
      shopifyVariantId: true,
      productId: true,
    },
  });

  const productIdByMerch = new Map<string, string>();
  const merchIdsByProduct = new Map<string, string[]>();
  for (const variant of variants) {
    if (!variant.shopifyVariantId) continue;
    productIdByMerch.set(variant.shopifyVariantId, variant.productId);
    const list = merchIdsByProduct.get(variant.productId) ?? [];
    list.push(variant.shopifyVariantId);
    merchIdsByProduct.set(variant.productId, list);
  }

  const productIds = [...merchIdsByProduct.keys()];
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
    const partnerMerchIds = [...partnerIds]
      .filter((id) => cartProductIds.has(id) && id !== productId)
      .flatMap((id) => merchIdsByProduct.get(id) ?? [])
      .filter((id) => id !== merchandiseId);
    if (partnerMerchIds.length > 0) {
      result.set(merchandiseId, [...new Set(partnerMerchIds)]);
    }
  }
  return result;
}
