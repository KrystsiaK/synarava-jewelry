import "server-only";

import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { characteristicDisplayValue, PRODUCT_CHARACTERISTICS } from "@/lib/products/characteristics";
import { shopifyAdminRequest, ShopifyAdminError, shopifyNumericId } from "@/lib/shopify/admin";
import { shopifyAmountToCents } from "@/lib/shopify/money";
import {
  classifyRemoteReconciliationAction,
  compareVariantCommerce,
  diffCollectionMembership,
  pickShopifyProductImageUrl,
  synaravaVisibilityForShopifyProduct,
  type RemoteCommerceVariant,
  variantCommerceChangeLabel,
  variantCommerceChangeLabels,
} from "@/lib/shopify/reconciliation";
import { env } from "@/lib/env";
import { getS3, getS3Bucket } from "@/lib/s3";
import {
  matchReadyShopifyMedia,
  type StagedProductMedia,
} from "@/lib/shopify/staged-product-media";
import { shopifyProductCategoryInput } from "@/lib/shopify/taxonomy-selection";

type UserError = { field?: string[]; message: string };
type ShopifyMetafield = { namespace: string; key: string; type: string; value: string };
type ShopifyProduct = {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  tags: string[];
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  updatedAt: string;
  totalInventory: number;
  category: { id: string; name: string; fullName: string } | null;
  seo: { title: string | null; description: string | null };
  media: { nodes: Array<{
    id: string;
    alt: string | null;
    mediaContentType: string;
    status: string;
    filename?: string | null;
    preview: { image: { url: string; width: number | null; height: number | null } | null } | null;
    image?: { url: string; width: number | null; height: number | null } | null;
  }> };
  options: Array<{ id: string; name: string; position: number; values: string[] }>;
  collections: { nodes: Array<{ id: string; handle: string; title: string }> };
  resourcePublicationsV2: { nodes: Array<{
    isPublished: boolean;
    publishDate: string | null;
    publication: { id: string; name: string };
  }> };
  featuredMedia?: { id: string; preview?: { image?: { url: string } | null } | null } | null;
  variants: { nodes: Array<{
    id: string;
    title: string;
    sku: string | null;
    barcode: string | null;
    price: string;
    compareAtPrice: string | null;
    inventoryPolicy: "CONTINUE" | "DENY";
    taxable: boolean;
    selectedOptions: Array<{ name: string; value: string }>;
    inventoryQuantity?: number | null;
    inventoryItem?: {
      id: string;
      requiresShipping: boolean;
      tracked: boolean;
      measurement?: {
        weight?: {
          value: number;
          unit: "GRAMS" | "KILOGRAMS" | "OUNCES" | "POUNDS";
        } | null;
      } | null;
    } | null;
  }> };
  metafields: { nodes: ShopifyMetafield[] };
};

type ShopifyReconciliationProduct = {
  id: string;
  title: string;
  handle: string;
  updatedAt: string;
  variants: { nodes: RemoteCommerceVariant[] };
};

const PRODUCT_FIELDS = `
  id title handle descriptionHtml vendor productType tags status updatedAt totalInventory
  category { id name fullName }
  seo { title description }
  media(first: 250) {
    nodes {
      id alt mediaContentType status preview { image { url width height } }
      ... on MediaImage { filename image { url width height } }
    }
  }
  options { id name position values }
  collections(first: 100) { nodes { id handle title } }
  resourcePublicationsV2(first: 100) { nodes { isPublished publishDate publication { id name } } }
  featuredMedia { id preview { image { url } } }
  variants(first: 100) {
    nodes {
      id title sku barcode price compareAtPrice inventoryPolicy taxable inventoryQuantity
      selectedOptions { name value }
      inventoryItem { id requiresShipping tracked measurement { weight { value unit } } }
    }
  }
  metafields(first: 100, namespace: "synarava") { nodes { namespace key type value } }
`;

function userErrors(errors: UserError[]) {
  if (errors.length) throw new ShopifyAdminError(errors.map((error) => error.message).join("; "));
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function tagSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Resolves a Shopify collection reference to the local collection
 * projection, matching identity-first (`shopifyCollectionId`) and falling
 * back to slug/handle for a local-only collection that predates the
 * Shopify link. A local collection already linked to a *different*
 * Shopify collection under the same slug is left untouched — presentation
 * fields (name, subtitle, hero, etc.) are never overwritten here, only
 * identity columns.
 */
async function upsertCollectionIdentity(remote: { id: string; handle: string; title: string }) {
  const existingById = await db.collection.findUnique({ where: { shopifyCollectionId: remote.id } });
  if (existingById) {
    return db.collection.update({
      where: { id: existingById.id },
      data: { shopifyHandle: remote.handle, lastSyncedAt: new Date() },
    });
  }

  const existingBySlug = await db.collection.findUnique({ where: { slug: remote.handle } });
  if (existingBySlug) {
    if (existingBySlug.shopifyCollectionId) return null;
    return db.collection.update({
      where: { id: existingBySlug.id },
      data: { shopifyCollectionId: remote.id, shopifyHandle: remote.handle, lastSyncedAt: new Date() },
    });
  }

  return db.collection.create({
    data: {
      slug: remote.handle,
      name: remote.title,
      shopifyCollectionId: remote.id,
      shopifyHandle: remote.handle,
      lastSyncedAt: new Date(),
    },
  });
}

/**
 * Replaces a product's collection membership to exactly match Shopify's
 * `collections(first: 100)` for that product. Every referenced collection
 * is linked/created via `upsertCollectionIdentity` first so membership
 * never points at a collection Shopify no longer reports.
 */
async function syncProductCollectionMembership(productId: string, remoteCollections: Array<{ id: string; handle: string; title: string }>) {
  const membershipCollectionIds: string[] = [];
  for (const remoteCollection of remoteCollections) {
    const collection = await upsertCollectionIdentity(remoteCollection);
    if (collection) membershipCollectionIds.push(collection.id);
  }

  if (membershipCollectionIds.length > 0) {
    await db.productCollection.deleteMany({
      where: { productId, collectionId: { notIn: membershipCollectionIds } },
    });
  } else {
    await db.productCollection.deleteMany({ where: { productId } });
  }

  for (const [index, collectionId] of membershipCollectionIds.entries()) {
    await db.productCollection.upsert({
      where: { productId_collectionId: { productId, collectionId } },
      update: { sortOrder: index },
      create: { productId, collectionId, sortOrder: index },
    });
  }
}


function metafieldValue(characteristic: {
  valueType: "TEXT" | "NUMBER" | "BOOLEAN";
  textValue: string | null;
  numberValue: Prisma.Decimal | null;
  booleanValue: boolean | null;
}) {
  if (characteristic.valueType === "BOOLEAN") return String(Boolean(characteristic.booleanValue));
  if (characteristic.valueType === "NUMBER") return characteristic.numberValue?.toString() ?? "";
  return characteristic.textValue ?? "";
}

function metafieldType(valueType: "TEXT" | "NUMBER" | "BOOLEAN") {
  if (valueType === "BOOLEAN") return "boolean";
  if (valueType === "NUMBER") return "number_decimal";
  return "single_line_text_field";
}

function weightInGrams(weight: NonNullable<NonNullable<ShopifyProduct["variants"]["nodes"][number]["inventoryItem"]>["measurement"]>["weight"]) {
  if (!weight || weight.value <= 0) return null;
  const multiplier = {
    GRAMS: 1,
    KILOGRAMS: 1000,
    OUNCES: 28.349523125,
    POUNDS: 453.59237,
  }[weight.unit];
  return Math.round(weight.value * multiplier * 10000) / 10000;
}

function snapshotForProduct(remote: ShopifyProduct): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify({
    id: remote.id,
    vendor: remote.vendor,
    productType: remote.productType,
    category: remote.category,
    seo: remote.seo,
    media: remote.media.nodes,
    options: remote.options,
    collections: remote.collections.nodes,
    publications: remote.resourcePublicationsV2.nodes,
    totalInventory: remote.totalInventory,
    variants: remote.variants.nodes.map((variant) => ({
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      barcode: variant.barcode,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      inventoryPolicy: variant.inventoryPolicy,
      inventoryQuantity: variant.inventoryQuantity,
      taxable: variant.taxable,
      selectedOptions: variant.selectedOptions,
      inventoryItem: variant.inventoryItem,
    })),
    updatedAt: remote.updatedAt,
  })) as Prisma.InputJsonValue;
}

async function syncOnlineStorePublication(productId: string, published: boolean) {
  let publicationId = env.SHOPIFY_PUBLICATION_ID;
  if (!publicationId) {
    const data = await shopifyAdminRequest<{ publications: { nodes: Array<{ id: string; name: string }> } }>(
      `query SynaravaPublications { publications(first: 100) { nodes { id name } } }`,
    );
    publicationId = data.publications.nodes.find((item) => /online store/i.test(item.name))?.id;
  }
  if (!publicationId) {
    if (published) throw new ShopifyAdminError("Online Store publication was not found. Set SHOPIFY_PUBLICATION_ID.");
    return;
  }
  const operation = published ? "publishablePublish" : "publishableUnpublish";
  const data = await shopifyAdminRequest<Record<string, { userErrors: UserError[] }>>(
    `mutation SynaravaPublication($id: ID!, $input: [PublicationInput!]!) {
      ${operation}(id: $id, input: $input) { userErrors { field message } }
    }`,
    { id: productId, input: [{ publicationId }] },
  );
  userErrors(data[operation]?.userErrors ?? []);
}

async function getInventoryLocationId() {
  if (env.SHOPIFY_LOCATION_ID) return env.SHOPIFY_LOCATION_ID;
  const data = await shopifyAdminRequest<{ locations: { nodes: Array<{ id: string }> } }>(
    `query SynaravaInventoryLocation { locations(first: 1, query: "active:true") { nodes { id } } }`,
  );
  return data.locations.nodes[0]?.id ?? null;
}

async function fetchShopifyProduct(id: string) {
  const data = await shopifyAdminRequest<{ product: ShopifyProduct | null }>(
    `query SynaravaProduct($id: ID!) { product(id: $id) { ${PRODUCT_FIELDS} } }`,
    { id: shopifyNumericId(id) },
  );
  return data.product;
}

type LocalProductAsset = StagedProductMedia & {
  alt: string;
  mimeType: string;
};

type StagedUploadTarget = {
  url: string | null;
  resourceUrl: string | null;
  parameters: Array<{ name: string; value: string }>;
};

function shopifyMediaStates(product: ShopifyProduct) {
  return product.media.nodes.map((item) => ({
    id: item.id,
    filename: item.filename ?? null,
    status: item.status,
    imageUrl: item.image?.url ?? item.preview?.image?.url ?? null,
  }));
}

async function uploadAssetsToShopifyStaging(assets: LocalProductAsset[]) {
  if (!assets.length) return new Map<string, string>();
  const staged = await shopifyAdminRequest<{
    stagedUploadsCreate: { stagedTargets: StagedUploadTarget[]; userErrors: UserError[] };
  }>(
    `mutation SynaravaStagedProductUploads($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }`,
    {
      input: assets.map((asset) => ({
        filename: asset.filename,
        mimeType: asset.mimeType,
        resource: "PRODUCT_IMAGE",
        httpMethod: "POST",
      })),
    },
  );
  userErrors(staged.stagedUploadsCreate.userErrors);
  if (staged.stagedUploadsCreate.stagedTargets.length !== assets.length) {
    throw new ShopifyAdminError("Shopify did not return every staged media upload target.");
  }

  const uploaded = new Map<string, string>();
  await Promise.all(assets.map(async (asset, index) => {
    const target = staged.stagedUploadsCreate.stagedTargets[index];
    if (!target?.url || !target.resourceUrl) {
      throw new ShopifyAdminError(`Shopify did not return an upload URL for ${asset.filename}.`);
    }
    const object = await getS3().send(new GetObjectCommand({
      Bucket: getS3Bucket(),
      Key: asset.key,
    }));
    if (!object.Body) throw new Error(`Staged media object ${asset.assetId} is missing.`);
    const bytes = await object.Body.transformToByteArray();
    const body = new FormData();
    for (const parameter of target.parameters) body.append(parameter.name, parameter.value);
    body.append("file", new Blob([Uint8Array.from(bytes).buffer], { type: asset.mimeType }), asset.filename);
    const response = await fetch(target.url, { method: "POST", body });
    if (!response.ok) {
      throw new ShopifyAdminError(`Shopify staging upload failed for ${asset.filename} (${response.status}).`);
    }
    uploaded.set(asset.assetId, target.resourceUrl);
  }));
  return uploaded;
}

async function waitForReadyProductMedia(product: ShopifyProduct, stagedAssets: StagedProductMedia[]) {
  if (!stagedAssets.length) return { product, matched: [] };
  let current = product;
  for (const waitMs of [0, 250, 500, 1_000, 1_500, 2_000, 3_000]) {
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    if (waitMs) current = await fetchShopifyProduct(product.id) ?? current;
    const matched = matchReadyShopifyMedia(stagedAssets, shopifyMediaStates(current));
    if (matched) return { product: current, matched };
  }
  return { product: current, matched: null };
}

async function deleteUnreferencedArchivedProductAssets(assetIds?: string[]) {
  const assets = await db.mediaAsset.findMany({
    where: {
      ...(assetIds ? { id: { in: assetIds } } : {}),
      status: "ARCHIVED",
      source: "UPLOAD",
      key: { startsWith: "uploads/products/" },
    },
    select: {
      id: true,
      key: true,
      _count: {
        select: {
          productPrimaryFor: true,
          collectionHeroFor: true,
          collectionCoverFor: true,
          productMedia: true,
        },
      },
    },
  });
  for (const asset of assets) {
    if (Object.values(asset._count).some((count) => count > 0)) continue;
    try {
      await getS3().send(new DeleteObjectCommand({ Bucket: getS3Bucket(), Key: asset.key }));
      await db.mediaAsset.deleteMany({ where: { id: asset.id, status: "ARCHIVED" } });
    } catch (error) {
      console.error("Deferred product staging cleanup failed", {
        assetId: asset.id,
        message: error instanceof Error ? error.message : "Unknown storage error",
      });
    }
  }
}

async function releaseReadyLocalProductMedia(productId: string, remote: ShopifyProduct) {
  const local = await db.product.findUnique({
    where: { id: productId },
    select: {
      primaryAsset: { select: { id: true, key: true, filename: true, source: true } },
      media: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { asset: { select: { id: true, key: true, filename: true, source: true } } },
      },
    },
  });
  if (!local) return false;
  const assets = new Map<string, StagedProductMedia>();
  for (const relation of local.media) {
    const asset = relation.asset;
    if (asset.source === "UPLOAD" && asset.key.startsWith("uploads/products/")) {
      assets.set(asset.id, { assetId: asset.id, key: asset.key, filename: asset.filename });
    }
  }
  if (local.primaryAsset?.source === "UPLOAD" && local.primaryAsset.key.startsWith("uploads/products/")) {
    assets.set(local.primaryAsset.id, {
      assetId: local.primaryAsset.id,
      key: local.primaryAsset.key,
      filename: local.primaryAsset.filename,
    });
  }
  const matched = matchReadyShopifyMedia([...assets.values()], shopifyMediaStates(remote));
  if (!matched?.length) return false;
  const assetIds = matched.map((item) => item.assetId);
  await db.$transaction([
    db.product.update({ where: { id: productId }, data: { primaryAssetId: null } }),
    db.productMedia.deleteMany({ where: { productId, assetId: { in: assetIds } } }),
    db.mediaAsset.updateMany({ where: { id: { in: assetIds } }, data: { status: "ARCHIVED" } }),
  ]);
  await deleteUnreferencedArchivedProductAssets(assetIds);
  return true;
}

/**
 * Writes a product pulled from Shopify (webhook or manual pull) into the
 * local catalog.
 *
 * Matching is identity-first, falling back in order: Shopify product ID,
 * then SKU, then slug/handle — the first match wins and the rest are never
 * checked. A local record whose `shopifyProductId` already points at a
 * *different* Shopify product is an identity conflict (two Shopify products
 * would otherwise collapse onto one local row) and is marked `CONFLICT`
 * without writing any other field.
 *
 * Unless `force` is true, a local product with unsynced local edits
 * (`syncStatus` PENDING/FAILED/CONFLICT) is only overwritten if the
 * incoming Shopify data is strictly newer (`remote.updatedAt` vs.
 * `shopifyUpdatedAt`); if the local edit is newer, the pull is recorded as
 * `LOCAL_CHANGES` and skipped rather than silently discarding studio edits.
 * `force: true` (used by the admin's explicit "pull" action) always takes
 * the remote version regardless of local edits.
 */
async function savePulledProduct(remote: ShopifyProduct, eventId?: string, force = false) {
  const firstVariant = remote.variants.nodes[0];
  const onlineStorePublication = remote.resourcePublicationsV2.nodes.find((item) => /online store/i.test(item.publication.name));
  const remoteSku = firstVariant?.sku?.trim() || `SHOPIFY-${remote.id.split("/").pop()}`;
  const imageUrl = pickShopifyProductImageUrl({
    featuredImageUrl: remote.featuredMedia?.preview?.image?.url,
    media: remote.media.nodes.map((item) => ({
      mediaContentType: item.mediaContentType,
      imageUrl: item.preview?.image?.url,
    })),
  });
  const isPublishedOnline = Boolean(onlineStorePublication?.isPublished);
  const visibility = synaravaVisibilityForShopifyProduct(remote.status, isPublishedOnline);
  const existingById = await db.product.findUnique({ where: { shopifyProductId: remote.id } });
  const existingBySku = existingById ? null : await db.product.findUnique({ where: { sku: remoteSku } });
  const existingBySlug = existingById || existingBySku
    ? null
    : await db.product.findUnique({ where: { slug: remote.handle } });
  const existing = existingById ?? existingBySku ?? existingBySlug;

  if (existing?.shopifyProductId && existing.shopifyProductId !== remote.id) {
    await db.product.update({
      where: { id: existing.id },
      data: { syncStatus: "CONFLICT", syncError: `Shopify identity conflict for ${remote.handle}.` },
    });
    if (eventId) await db.productSyncEvent.update({
      where: { id: eventId },
      data: { productId: existing.id, status: "CONFLICT", error: "Shopify identity conflict.", completedAt: new Date() },
    });
    return { productId: existing.id, status: "CONFLICT" as const };
  }

  if (existingById && !force && ["PENDING", "FAILED", "CONFLICT"].includes(existingById.syncStatus)) {
    const remoteIsNewer = !existingById.shopifyUpdatedAt ||
      new Date(remote.updatedAt).getTime() > existingById.shopifyUpdatedAt.getTime();
    if (remoteIsNewer) {
      await db.product.update({
        where: { id: existingById.id },
        data: {
          syncStatus: "CONFLICT",
          syncError: "Commerce fields changed in both Synarava and Shopify. Choose which version should win.",
        },
      });
      if (eventId) await db.productSyncEvent.update({
        where: { id: eventId },
        data: {
          productId: existingById.id,
          status: "CONFLICT",
          error: "Commerce fields changed on both sides.",
          completedAt: new Date(),
        },
      });
      return { productId: existingById.id, status: "CONFLICT" as const };
    }

    if (eventId) await db.productSyncEvent.update({
      where: { id: eventId },
      data: { productId: existingById.id, status: "IGNORED", completedAt: new Date() },
    });
    return { productId: existingById.id, status: "LOCAL_CHANGES" as const };
  }

  const product = await db.product.upsert({
    where: existing ? { id: existing.id } : { shopifyProductId: remote.id },
    update: {
      shopifyProductId: remote.id,
      shopifyHandle: remote.handle,
      slug: remote.handle,
      sku: remoteSku,
      name: remote.title,
      description: stripHtml(remote.descriptionHtml) || null,
      vendor: remote.vendor || null,
      shopifyCategoryId: remote.category?.id ?? null,
      shopifyCategoryName: remote.category?.fullName ?? remote.category?.name ?? null,
      seoTitle: remote.seo.title || null,
      seoDescription: remote.seo.description || null,
      shopifySnapshot: snapshotForProduct(remote),
      productType: remote.productType || null,
      priceCents: shopifyAmountToCents(firstVariant?.price),
      compareAtCents: firstVariant?.compareAtPrice ? shopifyAmountToCents(firstVariant.compareAtPrice) : null,
      imageUrl,
      status: remote.status,
      visibility,
      publishedAt: visibility === "PUBLIC"
        ? onlineStorePublication?.publishDate ? new Date(onlineStorePublication.publishDate) : existing?.publishedAt ?? new Date()
        : null,
      shopifyUpdatedAt: new Date(remote.updatedAt),
      lastSyncedAt: new Date(),
      syncStatus: "SYNCED",
      syncError: null,
    },
    create: {
      shopifyProductId: remote.id,
      shopifyHandle: remote.handle,
      slug: remote.handle,
      sku: remoteSku,
      name: remote.title,
      description: stripHtml(remote.descriptionHtml) || null,
      vendor: remote.vendor || null,
      shopifyCategoryId: remote.category?.id ?? null,
      shopifyCategoryName: remote.category?.fullName ?? remote.category?.name ?? null,
      seoTitle: remote.seo.title || null,
      seoDescription: remote.seo.description || null,
      shopifySnapshot: snapshotForProduct(remote),
      productType: remote.productType || null,
      currency: "EUR",
      priceCents: shopifyAmountToCents(firstVariant?.price),
      compareAtCents: firstVariant?.compareAtPrice ? shopifyAmountToCents(firstVariant.compareAtPrice) : null,
      imageUrl,
      status: remote.status,
      visibility,
      publishedAt: visibility === "PUBLIC"
        ? onlineStorePublication?.publishDate ? new Date(onlineStorePublication.publishDate) : new Date()
        : null,
      shopifyUpdatedAt: new Date(remote.updatedAt),
      lastSyncedAt: new Date(),
      syncStatus: "SYNCED",
    },
  });

  const pulledVariantIds: string[] = [];
  for (const variant of remote.variants.nodes) {
    const sku = variant.sku?.trim() || `${remoteSku}-${variant.id.split("/").pop()}`;
    const byRemoteId = await db.productVariant.findUnique({ where: { shopifyVariantId: variant.id } });
    const pulledVariant = await db.productVariant.upsert({
      where: byRemoteId ? { id: byRemoteId.id } : { sku },
      update: {
        productId: product.id,
        shopifyVariantId: variant.id,
        shopifyInventoryItemId: variant.inventoryItem?.id ?? null,
        title: variant.title,
        priceCents: shopifyAmountToCents(variant.price),
        compareAtCents: variant.compareAtPrice ? shopifyAmountToCents(variant.compareAtPrice) : null,
        stockOnHand: variant.inventoryQuantity ?? 0,
        barcode: variant.barcode,
        inventoryPolicy: variant.inventoryPolicy,
        taxable: variant.taxable,
        requiresShipping: variant.inventoryItem?.requiresShipping ?? true,
        tracked: variant.inventoryItem?.tracked ?? true,
        weightGrams: weightInGrams(variant.inventoryItem?.measurement?.weight) ?? null,
        selectedOptions: variant.selectedOptions as Prisma.InputJsonValue,
        status: remote.status,
      },
      create: {
        productId: product.id,
        shopifyVariantId: variant.id,
        shopifyInventoryItemId: variant.inventoryItem?.id ?? null,
        sku,
        title: variant.title,
        priceCents: shopifyAmountToCents(variant.price),
        compareAtCents: variant.compareAtPrice ? shopifyAmountToCents(variant.compareAtPrice) : null,
        stockOnHand: variant.inventoryQuantity ?? 0,
        barcode: variant.barcode,
        inventoryPolicy: variant.inventoryPolicy,
        taxable: variant.taxable,
        requiresShipping: variant.inventoryItem?.requiresShipping ?? true,
        tracked: variant.inventoryItem?.tracked ?? true,
        weightGrams: weightInGrams(variant.inventoryItem?.measurement?.weight) ?? null,
        selectedOptions: variant.selectedOptions as Prisma.InputJsonValue,
        status: remote.status,
      },
    });
    pulledVariantIds.push(pulledVariant.id);
  }
  if (pulledVariantIds.length > 0) {
    await db.productVariant.deleteMany({
      where: { productId: product.id, id: { notIn: pulledVariantIds } },
    });
  }

  await db.productTag.deleteMany({ where: { productId: product.id } });
  for (const name of remote.tags) {
    const slug = tagSlug(name);
    if (!slug) continue;
    const tag = await db.tag.upsert({
      where: { slug },
      update: { name },
      create: { slug, name },
      select: { id: true },
    });
    await db.productTag.create({ data: { productId: product.id, tagId: tag.id } });
  }

  await syncProductCollectionMembership(product.id, remote.collections.nodes);

  const definitions = new Map<string, (typeof PRODUCT_CHARACTERISTICS)[number] & { sortOrder: number }>(PRODUCT_CHARACTERISTICS.map((item, index) => [item.key, { ...item, sortOrder: index }]));
  const reachCertificate = remote.metafields.nodes.find((item) => item.key === "reach_certified_certificate")?.value ?? null;
  // Structured characteristics belong to the Synarava CMS layer. Shopify
  // metafields can seed or update them, but an absent metafield must never
  // erase a locally curated value during a commerce pull.
  const primaryWeight = weightInGrams(remote.variants.nodes[0]?.inventoryItem?.measurement?.weight);
  const weightDefinition = definitions.get("unit_weight");
  if (primaryWeight != null && weightDefinition) {
    await db.productCharacteristic.upsert({
      where: { productId_key: { productId: product.id, key: weightDefinition.key } },
      update: { numberValue: primaryWeight, unit: "g" },
      create: {
        productId: product.id,
        key: weightDefinition.key,
        label: weightDefinition.label,
        group: weightDefinition.group,
        valueType: "NUMBER",
        numberValue: primaryWeight,
        unit: "g",
        sortOrder: weightDefinition.sortOrder,
      },
    });
  }
  for (const metafield of remote.metafields.nodes) {
    const definition = definitions.get(metafield.key);
    if (!definition) continue;
    const valueType = definition.type;
    await db.productCharacteristic.upsert({
      where: { productId_key: { productId: product.id, key: definition.key } },
      update: {
        label: definition.label, group: definition.group, valueType,
        textValue: valueType === "TEXT" ? metafield.value : null,
        numberValue: valueType === "NUMBER" ? metafield.value : null,
        booleanValue: valueType === "BOOLEAN" ? metafield.value === "true" : null,
        unit: "unit" in definition ? definition.unit : null, sortOrder: definition.sortOrder,
        certificateUrl: definition.key === "reach_certified" ? reachCertificate : null,
      },
      create: {
        productId: product.id, key: definition.key, label: definition.label,
        group: definition.group, valueType,
        textValue: valueType === "TEXT" ? metafield.value : null,
        numberValue: valueType === "NUMBER" ? metafield.value : null,
        booleanValue: valueType === "BOOLEAN" ? metafield.value === "true" : null,
        unit: "unit" in definition ? definition.unit : null, sortOrder: definition.sortOrder,
        certificateUrl: definition.key === "reach_certified" ? reachCertificate : null,
      },
    });
  }

  const searchable = await db.productCharacteristic.findMany({ where: { productId: product.id, searchable: true } });
  await db.product.update({
    where: { id: product.id },
    data: {
      searchDocument: [remote.title, remoteSku, remote.handle, stripHtml(remote.descriptionHtml), ...searchable.flatMap((item) => [item.label, characteristicDisplayValue({ ...item, numberValue: item.numberValue ? Number(item.numberValue) : null })])].join(" "),
    },
  });
  await releaseReadyLocalProductMedia(product.id, remote);
  await deleteUnreferencedArchivedProductAssets();
  if (eventId) await db.productSyncEvent.update({
    where: { id: eventId },
    data: { productId: product.id, status: "SUCCEEDED", completedAt: new Date() },
  });
  return { productId: product.id, status: "SYNCED" as const };
}

export async function pullShopifyProduct(id: string, eventId?: string, force = false) {
  const remote = await fetchShopifyProduct(id);
  if (!remote) throw new ShopifyAdminError(`Shopify product ${id} was not found.`);
  return savePulledProduct(remote, eventId, force);
}

export type ProductSyncDifference = {
  field: string;
  local: string;
  shopify: string;
};

export type ProductSyncInspection = {
  state: "UNLINKED" | "SYNCED" | "LOCAL_CHANGES" | "REMOTE_CHANGES" | "CONFLICT" | "REMOTE_MISSING";
  remoteUpdatedAt: string | null;
  publications: string[];
  differences: ProductSyncDifference[];
};

export async function inspectProductSyncState(productId: string): Promise<ProductSyncInspection> {
  const local = await db.product.findUniqueOrThrow({
    where: { id: productId },
    include: {
      variants: { orderBy: { createdAt: "asc" } },
      tags: { include: { tag: true } },
      characteristics: { orderBy: [{ group: "asc" }, { sortOrder: "asc" }] },
    },
  });
  if (!local.shopifyProductId) {
    return { state: "UNLINKED", remoteUpdatedAt: null, publications: [], differences: [] };
  }

  const remote = await fetchShopifyProduct(local.shopifyProductId);
  if (!remote) {
    return { state: "REMOTE_MISSING", remoteUpdatedAt: null, publications: [], differences: [] };
  }

  const differences: ProductSyncDifference[] = [];
  const compare = (field: string, localValue: string | number | null | undefined, remoteValue: string | number | null | undefined) => {
    const left = localValue == null ? "" : String(localValue).trim();
    const right = remoteValue == null ? "" : String(remoteValue).trim();
    if (left !== right) differences.push({ field, local: left || "—", shopify: right || "—" });
  };
  const remoteVariant = remote.variants.nodes[0] ?? null;

  compare("Name", local.name, remote.title);
  compare("Handle", local.slug, remote.handle);
  compare("Description", local.description ?? "", stripHtml(remote.descriptionHtml));
  compare("Product category", local.shopifyCategoryId ?? "", remote.category?.id ?? "");
  compare("Product type", local.productType ?? "", remote.productType ?? "");
  compare("Vendor", local.vendor ?? "", remote.vendor ?? "");
  compare("SEO title", local.seoTitle ?? "", remote.seo.title ?? "");
  compare("SEO description", local.seoDescription ?? "", remote.seo.description ?? "");
  compare("Status", local.status, remote.status);
  const publishedPublications = remote.resourcePublicationsV2.nodes
    .filter((item) => item.isPublished)
    .map((item) => item.publication.name)
    .sort();
  const remoteImageUrl = pickShopifyProductImageUrl({
    featuredImageUrl: remote.featuredMedia?.preview?.image?.url,
    media: remote.media.nodes.map((item) => ({
      mediaContentType: item.mediaContentType,
      imageUrl: item.preview?.image?.url,
    })),
  });
  const isPublishedOnline = publishedPublications.some((name) => /online store/i.test(name));
  compare("Synarava storefront visibility", local.visibility, synaravaVisibilityForShopifyProduct(remote.status, isPublishedOnline));
  compare("Primary image", local.imageUrl ?? "", remoteImageUrl ?? "");
  for (const difference of compareVariantCommerce(local.variants, remote.variants.nodes)) {
    const variantSuffix = remote.variants.nodes.length > 1 ? ` (${difference.variant})` : "";
    compare(
      `${variantCommerceChangeLabel(difference.field)}${variantSuffix}`,
      difference.local,
      difference.shopify,
    );
  }
  compare(
    "Tags",
    local.tags.map((item) => item.tag.slug).sort().join(", "),
    remote.tags.map(tagSlug).filter(Boolean).sort().join(", "),
  );

  const remoteMetafields = new Map(remote.metafields.nodes.map((item) => [item.key, item.value]));
  const localCharacteristics = new Map(local.characteristics.map((item) => [item.key, item]));
  const remotePrimaryWeight = weightInGrams(remoteVariant?.inventoryItem?.measurement?.weight);
  for (const definition of PRODUCT_CHARACTERISTICS) {
    const characteristic = localCharacteristics.get(definition.key);
    const remoteValue = definition.key === "unit_weight" && remotePrimaryWeight != null
      ? String(remotePrimaryWeight)
      : remoteMetafields.get(definition.key);
    if (!characteristic && remoteValue == null) continue;
    compare(
      `Characteristic: ${definition.label}`,
      characteristic ? metafieldValue(characteristic) : "",
      remoteValue ?? "",
    );
    const remoteCertificate = remoteMetafields.get(`${definition.key}_certificate`);
    if (characteristic?.certificateUrl || remoteCertificate) {
      compare(
        `Certificate: ${definition.label}`,
        characteristic?.certificateUrl ?? "",
        remoteCertificate ?? "",
      );
    }
  }

  const remoteChanged = differences.length > 0 ||
    !local.shopifyUpdatedAt ||
    new Date(remote.updatedAt).getTime() > local.shopifyUpdatedAt.getTime();
  const localChanged = local.syncStatus === "PENDING" || local.syncStatus === "FAILED" || local.syncStatus === "CONFLICT";
  const state = remoteChanged && localChanged
    ? "CONFLICT"
    : remoteChanged
      ? "REMOTE_CHANGES"
      : localChanged
        ? "LOCAL_CHANGES"
        : "SYNCED";

  return { state, remoteUpdatedAt: remote.updatedAt, publications: publishedPublications, differences };
}

export async function pullShopifyInventory(inventoryItemId: string, eventId?: string) {
  const data = await shopifyAdminRequest<{
    inventoryItem: { inventoryLevels: { nodes: Array<{ location: { id: string }; quantities: Array<{ name: string; quantity: number }> }> } } | null;
  }>(
    `query SynaravaInventoryItem($id: ID!) {
      inventoryItem(id: $id) { inventoryLevels(first: 100) { nodes { location { id } quantities(names: ["available"]) { name quantity } } } }
    }`,
    { id: inventoryItemId },
  );
  if (!data.inventoryItem) throw new ShopifyAdminError(`Inventory item ${inventoryItemId} was not found.`);
  const configuredLocation = env.SHOPIFY_LOCATION_ID;
  const levels = data.inventoryItem.inventoryLevels.nodes;
  const selectedLevel = configuredLocation
    ? levels.find((level) => level.location.id === configuredLocation)
    : levels[0];
  const stockOnHand = selectedLevel?.quantities.find((item) => item.name === "available")?.quantity ?? 0;
  const variant = await db.productVariant.findUnique({ where: { shopifyInventoryItemId: inventoryItemId } });
  if (!variant) {
    if (eventId) await db.productSyncEvent.update({ where: { id: eventId }, data: { status: "IGNORED", completedAt: new Date() } });
    return { ignored: true as const };
  }
  await db.productVariant.update({ where: { id: variant.id }, data: { stockOnHand } });
  await db.product.update({ where: { id: variant.productId }, data: { lastSyncedAt: new Date(), syncStatus: "SYNCED", syncError: null } });
  if (eventId) await db.productSyncEvent.update({ where: { id: eventId }, data: { productId: variant.productId, status: "SUCCEEDED", completedAt: new Date() } });
  return { ignored: false as const, productId: variant.productId, stockOnHand };
}

/**
 * Pushes a local product's title, description, price, SKU, inventory,
 * tags, collection membership, product type, vendor, SEO title/description,
 * and `synarava.*` characteristic metafields to Shopify via the Admin
 * GraphQL API, creating the remote product on first push. Product type,
 * vendor, and SEO are omitted from the input (rather than sent as empty
 * strings) when we have no local value, so a push never overwrites
 * Shopify's own value with a blank default.
 *
 * Collection membership is only pushed for local collections that already
 * carry a `shopifyCollectionId` — a purely local collection has no Shopify
 * counterpart to add the product to, so it is silently excluded rather
 * than treated as an error.
 *
 * The product's image is only forwarded if its URL's origin is our own
 * configured app/S3 origin or Shopify's own CDN — this is a deliberate
 * allowlist, not an oversight: `product.imageUrl` can originate from
 * admin-editable content, and pushing an arbitrary attacker-supplied URL
 * to Shopify's `originalSource` would let Shopify's servers fetch it
 * (SSRF-shaped). A non-matching URL is silently dropped rather than
 * pushed or rejected outright, since a missing image is recoverable and
 * failing the whole sync over it is not worth the disruption.
 */
export async function pushProductToShopify(productId: string) {
  const event = await db.productSyncEvent.create({
    data: { productId, direction: "PUSH", status: "PROCESSING", attemptCount: 1 },
  });
  await db.product.update({ where: { id: productId }, data: { syncStatus: "PENDING", syncError: null } });

  try {
    const product = await db.product.findUniqueOrThrow({
      where: { id: productId },
      include: {
        characteristics: true,
        variants: { orderBy: { createdAt: "asc" } },
        tags: { include: { tag: true } },
        collections: { include: { collection: true } },
        primaryAsset: true,
        media: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { asset: true } },
      },
    });
    // Commerce fields (SKU, price, compare-at) are owned by the variant —
    // Product's own copies exist only as an identity anchor for pull's
    // by-SKU matching, and are never the source of truth once a variant
    // exists.
    const localVariant = product.variants[0];
    const commerceSku = localVariant?.sku ?? product.sku;
    const commercePriceCents = localVariant?.priceCents ?? product.priceCents;
    const commerceCompareAtCents = localVariant?.compareAtCents ?? product.compareAtCents;
    const metafields = product.characteristics.flatMap((item) => {
      const value = metafieldValue(item);
      if (!value) return [];
      return [
        { namespace: "synarava", key: item.key, type: metafieldType(item.valueType), value },
        ...(item.certificateUrl ? [{ namespace: "synarava", key: `${item.key}_certificate`, type: "url", value: item.certificateUrl }] : []),
      ];
    });
    const unitWeight = product.characteristics.find((item) => item.key === "unit_weight")?.numberValue;
    const inventoryItemInput = {
      sku: commerceSku,
      ...(unitWeight && unitWeight.greaterThan(0)
        ? { measurement: { weight: { value: unitWeight.toNumber(), unit: "GRAMS" as const } } }
        : {}),
    };
    const shopifyImageUrl = (source: string | null) => {
      if (!source) return null;
      try {
        const url = new URL(source, env.NEXT_PUBLIC_APP_URL);
        if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return null;
        const allowedOrigins = new Set(
          [env.NEXT_PUBLIC_APP_URL, env.S3_PUBLIC_URL, env.S3_ENDPOINT]
            .filter(Boolean)
            .map((value) => new URL(value!).origin),
        );
        const isShopifyCdn =
          url.protocol === "https:" &&
          (url.hostname === "cdn.shopify.com" || url.hostname.endsWith(".shopifycdn.com"));
        return allowedOrigins.has(url.origin) || isShopifyCdn ? url.toString() : null;
      } catch {
        return null;
      }
    };
    const currentRemote = product.shopifyProductId ? await fetchShopifyProduct(product.shopifyProductId) : null;
    const localAssetsById = new Map<string, LocalProductAsset>();
    for (const item of product.media) {
      localAssetsById.set(item.assetId, {
        assetId: item.assetId,
        filename: item.asset.filename,
        key: item.asset.key,
        mimeType: item.asset.mimeType,
        alt: item.alt || product.name,
      });
    }
    if (product.primaryAsset && !localAssetsById.has(product.primaryAsset.id)) {
      localAssetsById.set(product.primaryAsset.id, {
        assetId: product.primaryAsset.id,
        filename: product.primaryAsset.filename,
        key: product.primaryAsset.key,
        mimeType: product.primaryAsset.mimeType,
        alt: product.name,
      });
    }
    const localAssets = [...localAssetsById.values()].sort((left, right) =>
      left.assetId === product.primaryAssetId ? -1 : right.assetId === product.primaryAssetId ? 1 : 0,
    );
    const remoteByFilename = new Map(
      (currentRemote?.media.nodes ?? []).flatMap((item) =>
        item.filename && item.status !== "FAILED" ? [[item.filename, item] as const] : [],
      ),
    );
    const assetsToStage = localAssets.filter((asset) => !remoteByFilename.has(asset.filename));
    const stagedUrls = await uploadAssetsToShopifyStaging(assetsToStage);
    const seenMediaUrls = new Set<string>();
    const seenMediaIds = new Set<string>();
    const remoteByUrl = new Map(
      (currentRemote?.media.nodes ?? []).flatMap((item) => item.preview?.image?.url ? [[item.preview.image.url, item] as const] : []),
    );
    const files: Array<{ id?: string; originalSource?: string; alt: string; filename?: string; contentType?: "IMAGE" }> = [];
    for (const asset of localAssets) {
      const existing = remoteByFilename.get(asset.filename);
      if (existing) {
        seenMediaIds.add(existing.id);
        files.push({ id: existing.id, alt: asset.alt });
        continue;
      }
      const originalSource = stagedUrls.get(asset.assetId);
      if (!originalSource) throw new ShopifyAdminError(`Shopify staging URL is missing for ${asset.filename}.`);
      files.push({ originalSource, filename: asset.filename, contentType: "IMAGE", alt: asset.alt });
    }
    const directImage = localAssets.length ? null : shopifyImageUrl(product.imageUrl);
    if (directImage) {
      const existing = remoteByUrl.get(directImage);
      if (existing) {
        seenMediaIds.add(existing.id);
        files.push({ id: existing.id, alt: product.name });
      } else {
        seenMediaUrls.add(directImage);
        files.push({ originalSource: directImage, contentType: "IMAGE", alt: product.name });
      }
    }
    for (const remote of currentRemote?.media.nodes ?? []) {
      const url = remote.preview?.image?.url;
      if (seenMediaIds.has(remote.id) || (url && seenMediaUrls.has(url))) continue;
      seenMediaIds.add(remote.id);
      if (url) seenMediaUrls.add(url);
      files.push({ id: remote.id, alt: remote.alt || product.name });
    }
    const input = {
      title: product.name,
      handle: product.slug,
      descriptionHtml: product.description ? `<p>${product.description.replace(/[<>&]/g, "")}</p>` : "",
      ...(product.productType ? { productType: product.productType } : {}),
      ...(product.vendor ? { vendor: product.vendor } : {}),
      ...(product.seoTitle || product.seoDescription ? {
        seo: {
          title: product.seoTitle || undefined,
          description: product.seoDescription || undefined,
        },
      } : {}),
      status: product.status,
      tags: product.tags.map((item) => item.tag.name),
      ...shopifyProductCategoryInput(product.shopifyCategoryId),
      ...(!product.shopifyProductId ? {
        productOptions: [{ name: "Title", position: 1, values: [{ name: "Default Title" }] }],
        variants: [{
          sku: commerceSku,
          price: (commercePriceCents / 100).toFixed(2),
          compareAtPrice: commerceCompareAtCents == null ? null : (commerceCompareAtCents / 100).toFixed(2),
          optionValues: [{ optionName: "Title", name: "Default Title" }],
          inventoryItem: inventoryItemInput,
        }],
      } : {}),
      files,
    };
    const data = await shopifyAdminRequest<{
      productSet: { product: ShopifyProduct | null; userErrors: UserError[] };
    }>(
      `mutation SynaravaProductSet($identifier: ProductSetIdentifiers, $input: ProductSetInput!) {
        productSet(synchronous: true, identifier: $identifier, input: $input) {
          product { ${PRODUCT_FIELDS} }
          userErrors { field message }
        }
      }`,
      { identifier: product.shopifyProductId ? { id: product.shopifyProductId } : null, input },
    );
    userErrors(data.productSet.userErrors);
    if (!data.productSet.product) throw new ShopifyAdminError("Shopify did not return the saved product.");
    const remote = data.productSet.product;
    await syncOnlineStorePublication(remote.id, product.status === "ACTIVE");
    const desiredCollectionIds = product.collections
      .map((item) => item.collection.shopifyCollectionId)
      .filter((id): id is string => Boolean(id));
    const currentCollectionIds = (currentRemote?.collections.nodes ?? []).map((item) => item.id);
    const { toJoin, toLeave } = diffCollectionMembership(desiredCollectionIds, currentCollectionIds);
    for (const collectionId of toJoin) {
      const joinData = await shopifyAdminRequest<{ collectionAddProductsV2: { userErrors: UserError[] } }>(
        `mutation SynaravaCollectionJoin($id: ID!, $productIds: [ID!]!) {
          collectionAddProductsV2(id: $id, productIds: $productIds) { userErrors { field message } }
        }`,
        { id: collectionId, productIds: [remote.id] },
      );
      userErrors(joinData.collectionAddProductsV2.userErrors);
    }
    for (const collectionId of toLeave) {
      const leaveData = await shopifyAdminRequest<{ collectionRemoveProducts: { userErrors: UserError[] } }>(
        `mutation SynaravaCollectionLeave($id: ID!, $productIds: [ID!]!) {
          collectionRemoveProducts(id: $id, productIds: $productIds) { userErrors { field message } }
        }`,
        { id: collectionId, productIds: [remote.id] },
      );
      userErrors(leaveData.collectionRemoveProducts.userErrors);
    }
    if (metafields.length) {
      const metafieldData = await shopifyAdminRequest<{
        metafieldsSet: { userErrors: UserError[] };
      }>(
        `mutation SynaravaMetafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) { userErrors { field message } }
        }`,
        { metafields: metafields.map((item) => ({ ...item, ownerId: remote.id })) },
      );
      userErrors(metafieldData.metafieldsSet.userErrors);
    }
    const desiredKeys = new Set(metafields.map((item) => item.key));
    const staleMetafields = remote.metafields.nodes.filter((item) => !desiredKeys.has(item.key));
    if (staleMetafields.length) {
      const deleted = await shopifyAdminRequest<{
        metafieldsDelete: { userErrors: UserError[] };
      }>(
        `mutation SynaravaMetafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
          metafieldsDelete(metafields: $metafields) { userErrors { field message } }
        }`,
        { metafields: staleMetafields.map((item) => ({ ownerId: remote.id, namespace: "synarava", key: item.key })) },
      );
      userErrors(deleted.metafieldsDelete.userErrors);
    }
    const remoteVariant = remote.variants.nodes[0];
    if (remoteVariant) {
      const variantData = await shopifyAdminRequest<{
        productVariantsBulkUpdate: { productVariants: ShopifyProduct["variants"]["nodes"]; userErrors: UserError[] };
      }>(
        `mutation SynaravaVariantUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants { id title sku price compareAtPrice inventoryItem { id } }
            userErrors { field message }
          }
        }`,
        {
          productId: remote.id,
          variants: [{
            id: remoteVariant.id,
            price: (commercePriceCents / 100).toFixed(2),
            compareAtPrice: commerceCompareAtCents == null ? null : (commerceCompareAtCents / 100).toFixed(2),
            inventoryItem: inventoryItemInput,
          }],
        },
      );
      userErrors(variantData.productVariantsBulkUpdate.userErrors);
      const savedVariant = variantData.productVariantsBulkUpdate.productVariants[0];
      if (savedVariant) {
        if (localVariant) {
          await db.productVariant.update({ where: { id: localVariant.id }, data: { shopifyVariantId: savedVariant.id, shopifyInventoryItemId: savedVariant.inventoryItem?.id ?? null } });
        } else {
          await db.productVariant.create({ data: {
            productId, sku: commerceSku, title: savedVariant.title || "Default Title",
            priceCents: commercePriceCents, compareAtCents: commerceCompareAtCents,
            status: product.status, shopifyVariantId: savedVariant.id,
            shopifyInventoryItemId: savedVariant.inventoryItem?.id ?? null,
          } });
        }
        const inventoryItemId = savedVariant.inventoryItem?.id;
        if (inventoryItemId && localVariant) {
          const locationId = await getInventoryLocationId();
          if (locationId) {
            const activation = await shopifyAdminRequest<{
              inventoryActivate: { userErrors: UserError[] };
            }>(
              `mutation SynaravaInventoryActivate($inventoryItemId: ID!, $locationId: ID!, $idempotencyKey: String!) {
                inventoryActivate(inventoryItemId: $inventoryItemId, locationId: $locationId) @idempotent(key: $idempotencyKey) { userErrors { field message } }
              }`,
              { inventoryItemId, locationId, idempotencyKey: randomUUID() },
            );
            const activationErrors = activation.inventoryActivate.userErrors.filter((error) => !/already|connected|active/i.test(error.message));
            userErrors(activationErrors);
            const inventory = await shopifyAdminRequest<{
              inventorySetQuantities: { userErrors: UserError[] };
            }>(
              `mutation SynaravaInventorySet($input: InventorySetQuantitiesInput!, $idempotencyKey: String!) {
                inventorySetQuantities(input: $input) @idempotent(key: $idempotencyKey) { userErrors { field message } }
              }`,
              { input: {
                name: "available",
                reason: "correction",
                quantities: [{ inventoryItemId, locationId, quantity: localVariant.stockOnHand, changeFromQuantity: null }],
              }, idempotencyKey: randomUUID() },
            );
            userErrors(inventory.inventorySetQuantities.userErrors);
          }
        }
      }
    }
    const settled = await waitForReadyProductMedia(remote, localAssets);
    const remoteImageUrl = pickShopifyProductImageUrl({
      featuredImageUrl: settled.product.featuredMedia?.preview?.image?.url,
      media: settled.product.media.nodes.map((item) => ({
        mediaContentType: item.mediaContentType,
        imageUrl: item.image?.url ?? item.preview?.image?.url,
      })),
    });
    const productUpdate = {
      shopifyProductId: settled.product.id,
      shopifyHandle: settled.product.handle,
      shopifyCategoryId: settled.product.category?.id ?? null,
      shopifyCategoryName: settled.product.category?.fullName ?? settled.product.category?.name ?? null,
      shopifySnapshot: snapshotForProduct(settled.product),
      shopifyUpdatedAt: new Date(settled.product.updatedAt),
      lastSyncedAt: new Date(),
      syncStatus: "SYNCED" as const,
      syncError: null,
      ...(settled.matched ? { imageUrl: remoteImageUrl, primaryAssetId: null } : {}),
    };
    if (settled.matched?.length) {
      const assetIds = settled.matched.map((item) => item.assetId);
      await db.$transaction([
        db.product.update({ where: { id: productId }, data: productUpdate }),
        db.productMedia.deleteMany({ where: { productId, assetId: { in: assetIds } } }),
        db.mediaAsset.updateMany({ where: { id: { in: assetIds } }, data: { status: "ARCHIVED" } }),
      ]);
      await deleteUnreferencedArchivedProductAssets(assetIds);
    } else {
      await db.product.update({ where: { id: productId }, data: productUpdate });
    }
    await deleteUnreferencedArchivedProductAssets();
    await db.productSyncEvent.update({ where: { id: event.id }, data: { shopifyProductId: remote.id, status: "SUCCEEDED", completedAt: new Date() } });
    return { ok: true as const, shopifyProductId: remote.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Shopify sync error.";
    await db.product.update({ where: { id: productId }, data: { syncStatus: "FAILED", syncError: message } });
    await db.productSyncEvent.update({ where: { id: event.id }, data: { status: "FAILED", error: message, completedAt: new Date() } });
    return { ok: false as const, error: message };
  }
}

/**
 * Full bidirectional catalog sync, run from the admin's "Reconcile" action.
 * Three passes, in order:
 *
 * 1. **Pull** — page through every Shopify product (100/page) via
 *    `savePulledProduct`, which applies the same identity-matching and
 *    conflict rules as a webhook pull.
 * 2. **Archive** — any local product with a `shopifyProductId` that was
 *    *not* seen in pass 1 no longer exists in Shopify (deleted remotely),
 *    so it's archived locally rather than left pointing at a dead ID.
 * 3. **Push** — any local product with no Shopify link at all
 *    (`shopifyProductId: null`) and not already `CONFLICT` is pushed to
 *    Shopify, creating it there for the first time.
 *
 * Returns counts, not the individual results — see
 * `previewShopifyReconciliation` for a dry-run breakdown of exactly which
 * products would move which way before committing to this.
 */
export async function reconcileShopifyProducts() {
  const results = { pulled: 0, pushed: 0, archived: 0, conflicts: 0, failed: 0 };
  const seenRemoteIds = new Set<string>();
  let cursor: string | null = null;
  do {
    const data: { products: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: ShopifyProduct[] } } = await shopifyAdminRequest(
      `query SynaravaProducts($after: String) {
        products(first: 100, after: $after, sortKey: UPDATED_AT) {
          pageInfo { hasNextPage endCursor }
          nodes { ${PRODUCT_FIELDS} }
        }
      }`,
      { after: cursor },
    );
    for (const remote of data.products.nodes) {
      seenRemoteIds.add(remote.id);
      const event = await db.productSyncEvent.create({ data: { shopifyProductId: remote.id, direction: "RECONCILE", status: "PROCESSING", attemptCount: 1 } });
      try {
        const result = await savePulledProduct(remote, event.id);
        if (result.status === "CONFLICT") results.conflicts += 1;
        else if (result.status === "SYNCED") results.pulled += 1;
      } catch (error) {
        results.failed += 1;
        await db.productSyncEvent.update({ where: { id: event.id }, data: { status: "FAILED", error: error instanceof Error ? error.message : "Unknown reconciliation error.", completedAt: new Date() } });
      }
    }
    cursor = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (cursor);

  const linkedProducts = await db.product.findMany({
    where: { shopifyProductId: { not: null } },
    select: { id: true, shopifyProductId: true },
  });
  for (const product of linkedProducts) {
    if (product.shopifyProductId && !seenRemoteIds.has(product.shopifyProductId)) {
      await db.product.update({
        where: { id: product.id },
        data: { status: "ARCHIVED", visibility: "PRIVATE", syncStatus: "UNLINKED", syncError: "Product no longer exists in Shopify." },
      });
      results.archived += 1;
    }
  }

  const unlinkedProducts = await db.product.findMany({
    where: { shopifyProductId: null, syncStatus: { not: "CONFLICT" } },
    select: { id: true },
  });
  for (const product of unlinkedProducts) {
    const result = await pushProductToShopify(product.id);
    if (result.ok) results.pushed += 1;
    else results.failed += 1;
  }
  return results;
}

export type ShopifyReconciliationPreview = {
  remote: Array<{
    shopifyProductId: string;
    title: string;
    handle: string;
    sku: string;
    action: "CREATE_LOCAL" | "UPDATE_LOCAL" | "LINK_AND_UPDATE_LOCAL" | "UP_TO_DATE" | "CONFLICT";
    localProductId: string | null;
    localName: string | null;
    changes: string[];
  }>;
  pushToShopify: Array<{ productId: string; name: string; slug: string; sku: string }>;
  archiveLocal: Array<{ productId: string; name: string; shopifyProductId: string }>;
};

export async function previewShopifyReconciliation(): Promise<ShopifyReconciliationPreview> {
  const remoteProducts: ShopifyReconciliationProduct[] = [];
  let cursor: string | null = null;
  do {
    const data: {
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: ShopifyReconciliationProduct[];
      };
    } = await shopifyAdminRequest(
      `query SynaravaReconciliationPreview($after: String) {
        products(first: 100, after: $after, sortKey: UPDATED_AT) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id title handle updatedAt
            variants(first: 100) {
              nodes { id title sku price compareAtPrice inventoryQuantity }
            }
          }
        }
      }`,
      { after: cursor },
    );
    remoteProducts.push(...data.products.nodes);
    cursor = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (cursor);

  const localProducts = await db.product.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
      shopifyProductId: true,
      shopifyUpdatedAt: true,
      syncStatus: true,
      variants: {
        orderBy: { createdAt: "asc" },
        select: {
          shopifyVariantId: true,
          sku: true,
          priceCents: true,
          compareAtCents: true,
          stockOnHand: true,
        },
      },
    },
  });
  const byRemoteId = new Map(
    localProducts.flatMap((product) =>
      product.shopifyProductId ? [[product.shopifyProductId, product] as const] : [],
    ),
  );
  const bySku = new Map(localProducts.map((product) => [product.sku, product]));
  const bySlug = new Map(localProducts.map((product) => [product.slug, product]));
  const seenRemoteIds = new Set(remoteProducts.map((product) => product.id));
  const matchedLocalIds = new Set<string>();

  const remote = remoteProducts.map((product) => {
    const sku = product.variants.nodes[0]?.sku?.trim() || `SHOPIFY-${product.id.split("/").pop()}`;
    const existingById = byRemoteId.get(product.id);
    const existing = existingById ?? bySku.get(sku) ?? bySlug.get(product.handle) ?? null;
    if (existing) matchedLocalIds.add(existing.id);

    let action: ShopifyReconciliationPreview["remote"][number]["action"] = "CREATE_LOCAL";
    const variantDifferences = existingById
      ? compareVariantCommerce(existingById.variants, product.variants.nodes)
      : [];
    const productDetailsChanged = Boolean(
      existingById &&
      (!existingById.shopifyUpdatedAt ||
        new Date(product.updatedAt).getTime() > existingById.shopifyUpdatedAt.getTime()),
    );
    const changes = [
      ...(productDetailsChanged ? ["Product details"] : []),
      ...variantCommerceChangeLabels(variantDifferences),
    ];
    const remoteHasChanges = changes.length > 0;
    const localHasChanges = Boolean(
      existingById && ["PENDING", "FAILED", "CONFLICT"].includes(existingById.syncStatus),
    );

    if (existing?.shopifyProductId && existing.shopifyProductId !== product.id) action = "CONFLICT";
    else if (existingById) action = classifyRemoteReconciliationAction({
      hasUnresolvedConflict: existingById.syncStatus === "CONFLICT",
      localHasChanges,
      remoteHasChanges,
    });
    else if (existing) action = "LINK_AND_UPDATE_LOCAL";

    return {
      shopifyProductId: product.id,
      title: product.title,
      handle: product.handle,
      sku,
      action,
      localProductId: existing?.id ?? null,
      localName: existing?.name ?? null,
      changes,
    };
  });

  const remoteActionByLocalId = new Map(
    remote.flatMap((item) => item.localProductId ? [[item.localProductId, item.action] as const] : []),
  );

  const pushToShopify = localProducts
    .filter(
      (product) => {
        if (product.syncStatus === "CONFLICT") return false;
        if (!product.shopifyProductId) return !matchedLocalIds.has(product.id);
        if (!(["PENDING", "FAILED"] as string[]).includes(product.syncStatus)) return false;
        if (!seenRemoteIds.has(product.shopifyProductId)) return false;
        return remoteActionByLocalId.get(product.id) === "UP_TO_DATE";
      },
    )
    .map(({ id: productId, name, slug, sku }) => ({ productId, name, slug, sku }));

  const archiveLocal = localProducts.flatMap((product) =>
    product.shopifyProductId && !seenRemoteIds.has(product.shopifyProductId)
      ? [{ productId: product.id, name: product.name, shopifyProductId: product.shopifyProductId }]
      : [],
  );

  return { remote, pushToShopify, archiveLocal };
}

export async function ensureProductWebhookSubscriptions(callbackBaseUrl: string) {
  const callbackUrl = `${callbackBaseUrl.replace(/\/$/, "")}/api/shopify/webhooks/products`;
  const topics = ["PRODUCTS_CREATE", "PRODUCTS_UPDATE", "PRODUCTS_DELETE", "INVENTORY_LEVELS_UPDATE"];
  const results: Array<{ topic: string; created: boolean; error?: string }> = [];
  for (const topic of topics) {
    const data = await shopifyAdminRequest<{
      webhookSubscriptionCreate: { webhookSubscription: { id: string } | null; userErrors: UserError[] };
    }>(
      `mutation SynaravaWebhook($topic: WebhookSubscriptionTopic!, $subscription: WebhookSubscriptionInput!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $subscription) {
          webhookSubscription { id }
          userErrors { field message }
        }
      }`,
      { topic, subscription: { callbackUrl, format: "JSON" } },
    );
    const errors = data.webhookSubscriptionCreate.userErrors;
    const alreadyExists = errors.some((error) => /already|taken|exists/i.test(error.message));
    if (errors.length && !alreadyExists) userErrors(errors);
    results.push({ topic, created: Boolean(data.webhookSubscriptionCreate.webhookSubscription), error: alreadyExists ? undefined : errors[0]?.message });
  }
  return results;
}

export async function deleteShopifyProduct(shopifyProductId: string) {
  const data = await shopifyAdminRequest<{
    productDelete: { deletedProductId: string | null; userErrors: UserError[] };
  }>(
    `mutation SynaravaProductDelete($input: ProductDeleteInput!) {
      productDelete(input: $input) { deletedProductId userErrors { field message } }
    }`,
    { input: { id: shopifyProductId } },
  );
  userErrors(data.productDelete.userErrors);
  return data.productDelete.deletedProductId;
}
