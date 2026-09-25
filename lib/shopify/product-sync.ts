import "server-only";

import { fetchInventoryLevels, selectStockOnHand, type ShopifyInventoryLevel } from "@/lib/shopify/inventory-levels";

import { createHash, randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { characteristicDisplayValue, PRODUCT_CHARACTERISTICS } from "@/lib/products/characteristics";
import { shopifyAdminRequest, ShopifyAdminError, shopifyNumericId } from "@/lib/shopify/admin";
import { shopifyAmountToCents } from "@/lib/shopify/money";
import {
  compareVariantCommerce,
  diffCollectionMembership,
  pickShopifyProductImageUrl,
  refreshShopifyProductAfterPush,
  synaravaVisibilityForShopifyProduct,
  type RemoteProductStatus,
  variantCommerceChangeLabel,
} from "@/lib/shopify/reconciliation";
import {
  findManagedCollectionSourceId,
  hasCollectionIdentityConflict,
  type ShopifyCollectionSource,
} from "@/lib/shopify/collection-membership";
import {
  addProductToShopifyCollection,
  removeProductFromShopifyCollection,
} from "@/lib/shopify/collection-sync";
import { env } from "@/lib/env";
import { getS3, getS3Bucket } from "@/lib/s3";
import {
  matchReadyShopifyMedia,
  SHOPIFY_PRODUCT_MEDIA_FRAGMENT,
  shopifyMediaFilename,
  type StagedProductMedia,
} from "@/lib/shopify/staged-product-media";
import { shopifyProductCategoryInput } from "@/lib/shopify/taxonomy-selection";
import {
  characteristicKeyForShopifyCategoryMetafield,
  displayNamesFromCategoryReference,
  extractSimpleTextCharacteristicSeeds,
  isShopifyCategoryMetafieldType,
} from "@/lib/shopify/category-attribute-values";
import {
  decideProductTranslationPull,
  fetchProductTranslation,
  registerProductTranslation,
  type ShopifyProductTranslationSnapshot,
} from "@/lib/shopify/translations";
import { getPublishedStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";

type UserError = { field?: string[]; message: string };
type ShopifyMetafield = {
  namespace: string;
  key: string;
  type: string;
  value: string;
  definition: { name: string; access: { storefront: "PUBLIC_READ" | "NONE" | null } } | null;
  resolvedValues?: string[];
};
type ShopifyPageInfo = { hasNextPage: boolean; endCursor: string | null };
type ShopifyProduct = {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  tags: string[];
  status: RemoteProductStatus;
  updatedAt: string;
  totalInventory: number;
  category: { id: string; name: string; fullName: string } | null;
  seo: { title: string | null; description: string | null };
  media: { nodes: Array<{
    id: string;
    alt: string | null;
    mediaContentType: string;
    status: string;
    originalSource?: { url: string | null } | null;
    preview: { image: { url: string; width: number | null; height: number | null } | null } | null;
    image?: { url: string; width: number | null; height: number | null } | null;
  }> };
  options: Array<{ id: string; name: string; position: number; values: string[] }>;
  collections: { pageInfo: ShopifyPageInfo; nodes: Array<{
    id: string;
    handle: string;
    title: string;
    sources: ShopifyCollectionSource[];
  }> };
  resourcePublicationsV2: { pageInfo: ShopifyPageInfo; nodes: Array<{
    isPublished: boolean;
    publishDate: string | null;
    publication: { id: string; name: string };
  }> };
  featuredMedia?: { id: string; preview?: { image?: { url: string } | null } | null } | null;
  variants: { pageInfo: ShopifyPageInfo; nodes: Array<{
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
      countryCodeOfOrigin: string | null;
      harmonizedSystemCode: string | null;
      unitCost?: { amount: string; currencyCode: string } | null;
      inventoryLevels?: ShopifyInventoryLevel[];
      measurement?: {
        weight?: {
          value: number;
          unit: "GRAMS" | "KILOGRAMS" | "OUNCES" | "POUNDS";
        } | null;
      } | null;
    } | null;
  }> };
  metafields: { pageInfo: ShopifyPageInfo; nodes: ShopifyMetafield[] };
};

const COLLECTION_FIELDS = `
  id handle title
  sources {
    __typename id title
    ... on CollectionConditionsSource { targetType }
  }
`;

const VARIANT_FIELDS = `
  id title sku barcode price compareAtPrice inventoryPolicy taxable inventoryQuantity
  selectedOptions { name value }
  inventoryItem {
    id requiresShipping tracked countryCodeOfOrigin harmonizedSystemCode
    unitCost { amount currencyCode }
    measurement { weight { value unit } }
  }
`;

const PRODUCT_FIELDS = `
  id title handle descriptionHtml vendor productType tags status updatedAt totalInventory
  category { id name fullName }
  seo { title description }
  ${SHOPIFY_PRODUCT_MEDIA_FRAGMENT}
  options { id name position values }
  collections(first: 100) {
    pageInfo { hasNextPage endCursor }
    nodes { ${COLLECTION_FIELDS} }
  }
  resourcePublicationsV2(first: 100) { pageInfo { hasNextPage endCursor } nodes { isPublished publishDate publication { id name } } }
  featuredMedia { id preview { image { url } } }
  variants(first: 100) {
    pageInfo { hasNextPage endCursor }
    nodes { ${VARIANT_FIELDS} }
  }
  metafields(first: 100) { pageInfo { hasNextPage endCursor } nodes { namespace key type value definition { name access { storefront } } } }
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
async function upsertCollectionIdentity(remote: {
  id: string;
  handle: string;
  title: string;
  sources: ShopifyCollectionSource[];
}) {
  const existingById = await db.collection.findUnique({ where: { shopifyCollectionId: remote.id } });
  if (existingById) {
    const shopifyManualSourceId = findManagedCollectionSourceId(
      remote.sources,
      existingById.shopifyManualSourceId,
    );
    return db.collection.update({
      where: { id: existingById.id },
      data: { shopifyHandle: remote.handle, shopifyManualSourceId, lastSyncedAt: new Date() },
    });
  }

  const existingBySlug = await db.collection.findUnique({ where: { slug: remote.handle } });
  if (existingBySlug) {
    if (hasCollectionIdentityConflict(existingBySlug.shopifyCollectionId, remote.id)) {
      throw new ShopifyAdminError(
        `Collection handle "${remote.handle}" is already linked to ${existingBySlug.shopifyCollectionId}; refusing to replace it with ${remote.id}.`,
      );
    }
    const shopifyManualSourceId = findManagedCollectionSourceId(
      remote.sources,
      existingBySlug.shopifyManualSourceId,
    );
    return db.collection.update({
      where: { id: existingBySlug.id },
      data: { shopifyCollectionId: remote.id, shopifyHandle: remote.handle, shopifyManualSourceId, lastSyncedAt: new Date() },
    });
  }

  return db.collection.create({
    data: {
      slug: remote.handle,
      name: remote.title,
      shopifyCollectionId: remote.id,
      shopifyManualSourceId: findManagedCollectionSourceId(remote.sources),
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
 *
 * Only ever creates missing rows — an existing membership's `sortOrder`
 * (the product's collection-priority position, moved via
 * reorderCollectionProductAction) is never touched here. It used to be
 * overwritten with this product's own collection-list index on every pull,
 * silently resetting priority ordering back to ~0 on every Shopify sync.
 */
async function syncProductCollectionMembership(productId: string, remoteCollections: ShopifyProduct["collections"]["nodes"]) {
  const membershipCollectionIds: string[] = [];
  for (const remoteCollection of remoteCollections) {
    const collection = await upsertCollectionIdentity(remoteCollection);
    if (collection) membershipCollectionIds.push(collection.id);
  }

  if (membershipCollectionIds.length > 0) {
    await db.productCollection.deleteMany({
      where: { productId, collectionId: { notIn: membershipCollectionIds } },
    });
    await db.productCollection.createMany({
      data: membershipCollectionIds.map((collectionId) => ({ productId, collectionId })),
      skipDuplicates: true,
    });
  } else {
    await db.productCollection.deleteMany({ where: { productId } });
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
    title: remote.title,
    handle: remote.handle,
    descriptionHtml: remote.descriptionHtml,
    tags: remote.tags,
    status: remote.status,
    vendor: remote.vendor,
    productType: remote.productType,
    category: remote.category,
    seo: remote.seo,
    media: remote.media.nodes,
    options: remote.options,
    metafields: remote.metafields.nodes,
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

async function fetchRemainingProductConnection<T>(
  id: string,
  connection: "variants" | "metafields" | "collections" | "resourcePublicationsV2",
  fields: string,
  firstPage: { nodes: T[]; pageInfo: ShopifyPageInfo },
): Promise<T[]> {
  const nodes = [...firstPage.nodes];
  let pageInfo = firstPage.pageInfo;
  while (pageInfo.hasNextPage) {
    if (!pageInfo.endCursor) throw new ShopifyAdminError(`Shopify omitted the ${connection} pagination cursor.`);
    const data = await shopifyAdminRequest<{
      product: Record<string, { nodes: T[]; pageInfo: ShopifyPageInfo }> | null;
    }>(
      `query SynaravaProductConnection($id: ID!, $after: String!) {
        product(id: $id) {
          ${connection}(first: 100, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes { ${fields} }
          }
        }
      }`,
      { id, after: pageInfo.endCursor },
    );
    const page = data.product?.[connection];
    if (!page) throw new ShopifyAdminError(`Shopify did not return the ${connection} page.`);
    nodes.push(...page.nodes);
    pageInfo = page.pageInfo;
  }
  return nodes;
}

type CategoryMetafieldReference = {
  name?: string | null;
  displayName?: string | null;
  fields?: Array<{ key?: string | null; value?: string | null }> | null;
};

/**
 * Resolves Shopify category metafield selections to display names.
 * Category attributes may be `product_taxonomy_value_reference` *or*
 * `metaobject_reference` (Admin Color/Fabric pickers write metaobjects).
 * https://shopify.dev/docs/apps/build/metafields/list-of-data-types
 */
async function fetchCategoryMetafieldDisplayValues(productId: string, key: string): Promise<string[]> {
  const names: string[] = [];
  let after: string | null = null;
  do {
    const data: {
      product: {
        metafield: {
          reference: CategoryMetafieldReference | null;
          references: {
            nodes: CategoryMetafieldReference[];
            pageInfo: ShopifyPageInfo;
          } | null;
        } | null;
      } | null;
    } = await shopifyAdminRequest(
      `query SynaravaCategoryMetafield($id: ID!, $key: String!, $after: String) {
        product(id: $id) {
          metafield(namespace: "shopify", key: $key) {
            reference {
              ... on TaxonomyValue { name }
              ... on Metaobject {
                displayName
                fields { key value }
              }
            }
            references(first: 100, after: $after) {
              pageInfo { hasNextPage endCursor }
              nodes {
                ... on TaxonomyValue { name }
                ... on Metaobject {
                  displayName
                  fields { key value }
                }
              }
            }
          }
        }
      }`,
      { id: productId, key, after },
    );
    const metafield = data.product?.metafield;
    if (!metafield) break;
    if (metafield.reference) names.push(...displayNamesFromCategoryReference(metafield.reference));
    for (const node of metafield.references?.nodes ?? []) {
      names.push(...displayNamesFromCategoryReference(node));
    }
    const pageInfo = metafield.references?.pageInfo;
    if (pageInfo?.hasNextPage && !pageInfo.endCursor) {
      throw new ShopifyAdminError(`Shopify omitted the category values cursor for ${key}.`);
    }
    after = pageInfo?.hasNextPage ? pageInfo.endCursor : null;
  } while (after);
  return [...new Set(names)];
}

export async function fetchShopifyProduct(id: string) {
  const shopifyId = shopifyNumericId(id);
  const data = await shopifyAdminRequest<{ product: ShopifyProduct | null }>(
    `query SynaravaProduct($id: ID!) { product(id: $id) { ${PRODUCT_FIELDS} } }`,
    { id: shopifyId },
  );
  const product = data.product;
  if (!product) return null;
  const [variants, metafields, collections, publications] = await Promise.all([
    fetchRemainingProductConnection(shopifyId, "variants", VARIANT_FIELDS, product.variants),
    fetchRemainingProductConnection(shopifyId, "metafields", "namespace key type value definition { name access { storefront } }", product.metafields),
    fetchRemainingProductConnection(shopifyId, "collections", COLLECTION_FIELDS, product.collections),
    fetchRemainingProductConnection(shopifyId, "resourcePublicationsV2", "isPublished publishDate publication { id name }", product.resourcePublicationsV2),
  ]);
  product.variants.nodes = variants;
  product.metafields.nodes = metafields;
  product.collections.nodes = collections;
  product.resourcePublicationsV2.nodes = publications;
  for (const metafield of product.metafields.nodes) {
    if (metafield.namespace !== "shopify" || !isShopifyCategoryMetafieldType(metafield.type)) continue;
    metafield.resolvedValues = await fetchCategoryMetafieldDisplayValues(shopifyId, metafield.key);
  }
  for (const variant of product.variants.nodes) {
    if (!variant.inventoryItem?.tracked) continue;
    variant.inventoryItem.inventoryLevels = await fetchInventoryLevels(variant.inventoryItem.id);
  }
  return product;
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
    filename: shopifyMediaFilename({
      originalSourceUrl: item.originalSource?.url,
      imageUrl: item.image?.url ?? item.preview?.image?.url,
    }),
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
 * `LOCAL_CHANGES` and skipped rather than silently discarding admin edits.
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
      publishedAt: visibility !== "PRIVATE"
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
      publishedAt: visibility !== "PRIVATE"
        ? onlineStorePublication?.publishDate ? new Date(onlineStorePublication.publishDate) : new Date()
        : null,
      shopifyUpdatedAt: new Date(remote.updatedAt),
      lastSyncedAt: new Date(),
      syncStatus: "SYNCED",
    },
  });

  // One aggregate status across every published translation locale — worst
  // case wins (UNAVAILABLE > CONFLICT > LOCAL_CHANGES > SYNCED) — since
  // callers only need a
  // per-product signal, not a per-locale breakdown.
  const TRANSLATION_STATUS_RANK = { SYNCED: 0, LOCAL_CHANGES: 1, CONFLICT: 2, UNAVAILABLE: 3 } as const;
  let translationStatus: keyof typeof TRANSLATION_STATUS_RANK = "SYNCED";

  const translationLocales = (await getPublishedStorefrontLocales()).filter((locale) => !locale.isDefault);
  for (const translationLocale of translationLocales) {
    const localTranslation = await db.productTranslation.findUnique({
      where: { productId_locale: { productId: product.id, locale: translationLocale.code } },
    });
    let remoteTranslation: ShopifyProductTranslationSnapshot | null = null;
    let translationAvailable = true;
    try {
      remoteTranslation = await fetchProductTranslation(remote.id, translationLocale.shopifyLocale);
    } catch {
      // Missing read_translations access must not make commerce synchronization
      // fail. Surface it in the result so the admin can fix Shopify permissions.
      translationAvailable = false;
      if (TRANSLATION_STATUS_RANK.UNAVAILABLE > TRANSLATION_STATUS_RANK[translationStatus]) translationStatus = "UNAVAILABLE";
    }
    if (!translationAvailable) continue;

    const localShopifyCopy = localTranslation ? {
      handle: localTranslation.localizedHandle ?? "",
      title: localTranslation.title,
      descriptionHtml: localTranslation.description ?? "",
      seoTitle: localTranslation.seoTitle ?? "",
      seoDescription: localTranslation.seoDescription ?? "",
    } : null;
    const decision = decideProductTranslationPull({
      local: localShopifyCopy,
      localSyncStatus: localTranslation?.syncStatus ?? "NOT_APPLICABLE",
      localLastSyncedAt: localTranslation?.lastSyncedAt ?? null,
      remote: remoteTranslation,
      force,
    });

    if (decision === "CONFLICT" && localTranslation) {
      if (TRANSLATION_STATUS_RANK.CONFLICT > TRANSLATION_STATUS_RANK[translationStatus]) translationStatus = "CONFLICT";
      await db.productTranslation.update({
        where: { id: localTranslation.id },
        data: {
          syncStatus: "CONFLICT",
          syncError: `${translationLocale.name} copy changed in both Synarava and Shopify. Choose Pull or Push to resolve it.`,
        },
      });
    } else if (decision === "KEEP_LOCAL") {
      if (TRANSLATION_STATUS_RANK.LOCAL_CHANGES > TRANSLATION_STATUS_RANK[translationStatus]) translationStatus = "LOCAL_CHANGES";
    } else if (decision === "APPLY_REMOTE" || decision === "UNCHANGED") {
      if (remoteTranslation || localTranslation) {
        const mergedCopy = {
          localizedHandle: remoteTranslation?.handle || null,
          title: remoteTranslation?.title ?? "",
          shortDescription: localTranslation?.shortDescription ?? null,
          description: remoteTranslation ? stripHtml(remoteTranslation.descriptionHtml) || null : null,
          materialLine: localTranslation?.materialLine ?? null,
          symbolismLabel: localTranslation?.symbolismLabel ?? null,
          symbolismTitle: localTranslation?.symbolismTitle ?? null,
          symbolismBody: localTranslation?.symbolismBody ?? null,
          symbolismBody2: localTranslation?.symbolismBody2 ?? null,
          details: localTranslation?.details ?? undefined,
          seoTitle: remoteTranslation?.seoTitle || null,
          seoDescription: remoteTranslation?.seoDescription || null,
        };
        const contentHash = createHash("sha256").update(JSON.stringify({
          title: mergedCopy.title,
          shortDescription: mergedCopy.shortDescription,
          description: mergedCopy.description,
          materialLine: mergedCopy.materialLine,
          symbolismLabel: mergedCopy.symbolismLabel,
          symbolismTitle: mergedCopy.symbolismTitle,
          symbolismBody: mergedCopy.symbolismBody,
          symbolismBody2: mergedCopy.symbolismBody2,
          seoTitle: mergedCopy.seoTitle,
          seoDescription: mergedCopy.seoDescription,
        })).digest("hex");
        const reviewed = Boolean(
          remoteTranslation?.title
          && mergedCopy.description
          && mergedCopy.shortDescription
          && localTranslation?.reviewStatus === "REVIEWED"
          && !remoteTranslation.outdated,
        );
        await db.productTranslation.upsert({
          where: { productId_locale: { productId: product.id, locale: translationLocale.code } },
          update: {
            ...mergedCopy,
            reviewStatus: reviewed ? "REVIEWED" : "DRAFT",
            reviewedAt: reviewed ? localTranslation?.reviewedAt ?? new Date() : null,
            syncStatus: "SYNCED",
            syncError: null,
            contentHash,
            lastSyncedAt: remoteTranslation?.updatedAt ? new Date(remoteTranslation.updatedAt) : new Date(),
          },
          create: {
            productId: product.id,
            locale: translationLocale.code,
            ...mergedCopy,
            reviewStatus: "DRAFT",
            syncStatus: "SYNCED",
            contentHash,
            lastSyncedAt: remoteTranslation?.updatedAt ? new Date(remoteTranslation.updatedAt) : new Date(),
          },
        });
      }
    }
  }

  const pulledVariantIds: string[] = [];
  for (const variant of remote.variants.nodes) {
    const sku = variant.sku?.trim() || `${remoteSku}-${variant.id.split("/").pop()}`;
    // Same Shopify-compatible stock contract as the inventory_levels/update webhook
    // (REV-05) — otherwise a multi-location product's stock flips depending on
    // whether it was last touched by a full pull or the webhook.
    const stockOnHand = selectStockOnHand(variant.inventoryItem?.inventoryLevels ?? [], env.SHOPIFY_LOCATION_ID);
    const byRemoteId = await db.productVariant.findUnique({ where: { shopifyVariantId: variant.id } });
    const pulledVariant = await db.productVariant.upsert({
      where: byRemoteId ? { id: byRemoteId.id } : { sku },
      update: {
        productId: product.id,
        shopifyVariantId: variant.id,
        shopifyInventoryItemId: variant.inventoryItem?.id ?? null,
        sku,
        title: variant.title,
        priceCents: shopifyAmountToCents(variant.price),
        compareAtCents: variant.compareAtPrice ? shopifyAmountToCents(variant.compareAtPrice) : null,
        costCents: variant.inventoryItem?.unitCost?.amount
          ? shopifyAmountToCents(variant.inventoryItem.unitCost.amount)
          : null,
        stockOnHand,
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
        costCents: variant.inventoryItem?.unitCost?.amount
          ? shopifyAmountToCents(variant.inventoryItem.unitCost.amount)
          : null,
        stockOnHand,
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
  const reachCertificate = remote.metafields.nodes.find((item) => item.namespace === "synarava" && item.key === "reach_certified_certificate")?.value ?? null;
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
  // Seed empty Synarava passport fields from Shopify category attribute
  // selections (shopify.* taxonomy / metaobject refs) and plain merchant
  // text metafields (e.g. custom.material). synarava.* metafields below still
  // win when present. Never erase a locally curated value.
  const synaravaKeys = new Set(
    remote.metafields.nodes
      .filter((item) => item.namespace === "synarava")
      .map((item) => item.key),
  );
  const existingCharacteristics = await db.productCharacteristic.findMany({
    where: { productId: product.id },
    select: { key: true, textValue: true, numberValue: true, booleanValue: true },
  });
  const existingByKey = new Map(existingCharacteristics.map((item) => [item.key, item]));

  async function seedEmptyTextCharacteristic(characteristicKey: string, textValue: string) {
    if (synaravaKeys.has(characteristicKey)) return;
    const definition = definitions.get(characteristicKey);
    if (!definition || definition.type !== "TEXT") return;
    const existing = existingByKey.get(characteristicKey);
    const hasLocalValue = Boolean(
      existing?.textValue?.trim()
      || existing?.numberValue != null
      || existing?.booleanValue != null,
    );
    if (hasLocalValue) return;
    await db.productCharacteristic.upsert({
      where: { productId_key: { productId: product.id, key: definition.key } },
      update: {
        label: definition.label,
        group: definition.group,
        valueType: "TEXT",
        textValue,
        numberValue: null,
        booleanValue: null,
        unit: null,
        sortOrder: definition.sortOrder,
      },
      create: {
        productId: product.id,
        key: definition.key,
        label: definition.label,
        group: definition.group,
        valueType: "TEXT",
        textValue,
        sortOrder: definition.sortOrder,
      },
    });
    existingByKey.set(characteristicKey, { key: characteristicKey, textValue, numberValue: null, booleanValue: null });
  }

  for (const metafield of remote.metafields.nodes) {
    if (metafield.namespace !== "shopify" || !isShopifyCategoryMetafieldType(metafield.type)) continue;
    const values = metafield.resolvedValues?.filter((entry) => entry.trim()) ?? [];
    if (!values.length) continue;
    const characteristicKey = characteristicKeyForShopifyCategoryMetafield(
      metafield.key,
      metafield.definition?.name,
    );
    if (!characteristicKey) continue;
    await seedEmptyTextCharacteristic(characteristicKey, values.join(", "));
  }

  for (const seed of extractSimpleTextCharacteristicSeeds(remote.metafields.nodes)) {
    await seedEmptyTextCharacteristic(seed.characteristicKey, seed.textValue);
  }

  const originCode = firstVariant?.inventoryItem?.countryCodeOfOrigin?.trim();
  if (originCode) {
    await seedEmptyTextCharacteristic("origin", originCode);
  }

  for (const metafield of remote.metafields.nodes) {
    if (metafield.namespace !== "synarava") continue;
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
  return { productId: product.id, status: "SYNCED" as const, translationStatus };
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

  const remoteMetafields = new Map(remote.metafields.nodes
    .filter((item) => item.namespace === "synarava")
    .map((item) => [item.key, item.value]));
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
  const stockOnHand = selectStockOnHand(data.inventoryItem.inventoryLevels.nodes, env.SHOPIFY_LOCATION_ID);
  const variant = await db.productVariant.findUnique({ where: { shopifyInventoryItemId: inventoryItemId } });
  if (!variant) {
    if (eventId) await db.productSyncEvent.update({ where: { id: eventId }, data: { status: "IGNORED", completedAt: new Date() } });
    return { ignored: true as const };
  }
  // Inventory-only: touches stockOnHand alone. It must not mark the product SYNCED —
  // that would erase a still-pending commerce/editorial change or an unresolved
  // CONFLICT that has nothing to do with this webhook (REV-04).
  await db.productVariant.update({ where: { id: variant.id }, data: { stockOnHand } });
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
 * carry a `shopifyCollectionId`. Shopify 2026-07 changes go through a
 * Synarava-owned product source on `collectionUpdate`; Shopify-authored
 * conditions remain untouched. Purely local collections are excluded.
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
export async function pushProductToShopify(productId: string, forceTranslation = false) {
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
        translations: true,
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
    const commerceTaxable = localVariant?.taxable ?? true;
    const commerceCostCents = localVariant?.costCents ?? null;
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
      ...(commerceCostCents != null ? { cost: (commerceCostCents / 100).toFixed(2) } : {}),
      ...(unitWeight && unitWeight.greaterThan(0)
        ? { measurement: { weight: { value: unitWeight.toNumber(), unit: "GRAMS" as const } } }
        : {}),
    };
    const shopifyImageUrl = (source: string | null) => {
      if (!source) return null;
      try {
        const url = new URL(source, env.APP_URL);
        if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return null;
        const allowedOrigins = new Set(
          [env.APP_URL, env.S3_PUBLIC_URL, env.S3_ENDPOINT]
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
      (currentRemote?.media.nodes ?? []).flatMap((item) => {
        const filename = shopifyMediaFilename({
          originalSourceUrl: item.originalSource?.url,
          imageUrl: item.image?.url ?? item.preview?.image?.url,
        });
        return filename && item.status !== "FAILED"
          ? [[filename, item] as const]
          : [];
      }),
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
          taxable: commerceTaxable,
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
    await syncOnlineStorePublication(
      remote.id,
      product.status === "ACTIVE" || product.status === "UNLISTED",
    );
    const desiredCollections = product.collections.flatMap((item) =>
      item.collection.shopifyCollectionId
        ? [{
            id: item.collection.id,
            shopifyCollectionId: item.collection.shopifyCollectionId,
            shopifyManualSourceId: item.collection.shopifyManualSourceId,
          }]
        : [],
    );
    const desiredCollectionIds = desiredCollections.map((collection) => collection.shopifyCollectionId);
    const currentCollectionIds = (currentRemote?.collections.nodes ?? []).map((item) => item.id);
    const { toJoin, toLeave } = diffCollectionMembership(desiredCollectionIds, currentCollectionIds);
    for (const collection of desiredCollections.filter((item) => toJoin.includes(item.shopifyCollectionId))) {
      await addProductToShopifyCollection(collection, remote.id);
    }
    const leavingCollections = toLeave.length
      ? await db.collection.findMany({
          where: {
            shopifyCollectionId: { in: toLeave },
            shopifyManualSourceId: { not: null },
          },
          select: {
            shopifyCollectionId: true,
            shopifyManualSourceId: true,
          },
        })
      : [];
    for (const collection of leavingCollections) {
      if (!collection.shopifyCollectionId || !collection.shopifyManualSourceId) continue;
      await removeProductFromShopifyCollection({
        shopifyCollectionId: collection.shopifyCollectionId,
        shopifyManualSourceId: collection.shopifyManualSourceId,
      }, remote.id);
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
    const managedKeys = new Set<string>(PRODUCT_CHARACTERISTICS.flatMap((item) =>
      "certificate" in item ? [item.key, `${item.key}_certificate`] : [item.key],
    ));
    const staleMetafields = remote.metafields.nodes.filter((item) =>
      item.namespace === "synarava" && managedKeys.has(item.key) && !desiredKeys.has(item.key),
    );
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
            taxable: commerceTaxable,
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
            costCents: commerceCostCents, taxable: commerceTaxable,
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
    const mediaSettled = await waitForReadyProductMedia(remote, localAssets);
    const settled = {
      ...mediaSettled,
      product: await refreshShopifyProductAfterPush(mediaSettled.product, fetchShopifyProduct),
    };
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

    const translationErrors: string[] = [];
    const pushTranslationLocales = (await getPublishedStorefrontLocales()).filter((locale) => !locale.isDefault);
    for (const translationLocale of pushTranslationLocales) {
      const translation = product.translations.find((item) => item.locale === translationLocale.code);
      if (
        translation?.reviewStatus === "REVIEWED"
        && translation.title.trim()
        && translation.description?.trim()
        && translation.syncStatus !== "SYNCED"
      ) {
        try {
          const localCopy = {
            handle: translation.localizedHandle ?? "",
            title: translation.title,
            descriptionHtml: translation.description
              ? `<p>${translation.description.replace(/[<>&]/g, "")}</p>`
              : "",
            seoTitle: translation.seoTitle ?? "",
            seoDescription: translation.seoDescription ?? "",
          };
          const remoteTranslation = await fetchProductTranslation(remote.id, translationLocale.shopifyLocale);
          const decision = decideProductTranslationPull({
            local: localCopy,
            localSyncStatus: translation.syncStatus,
            localLastSyncedAt: translation.lastSyncedAt,
            remote: remoteTranslation,
            force: forceTranslation,
          });
          if (decision === "CONFLICT") {
            const message = `${translationLocale.name} copy also changed in Shopify. Pull or explicitly force Push to choose a winner.`;
            translationErrors.push(message);
            await db.productTranslation.update({
              where: { id: translation.id },
              data: { syncStatus: "CONFLICT", syncError: message },
            });
          } else if (decision === "UNCHANGED") {
            await db.productTranslation.update({
              where: { id: translation.id },
              data: { syncStatus: "SYNCED", syncError: null, lastSyncedAt: new Date() },
            });
          } else {
            await registerProductTranslation(remote.id, localCopy, translationLocale.shopifyLocale);
            await db.productTranslation.update({
              where: { id: translation.id },
              data: { syncStatus: "SYNCED", syncError: null, lastSyncedAt: new Date() },
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : `${translationLocale.name} translation sync failed.`;
          translationErrors.push(message);
          await db.productTranslation.update({
            where: { id: translation.id },
            data: { syncStatus: "FAILED", syncError: message },
          });
        }
      }
    }
    const translationError = translationErrors.length > 0 ? translationErrors.join(" ") : undefined;
    await db.productSyncEvent.update({ where: { id: event.id }, data: { shopifyProductId: remote.id, status: "SUCCEEDED", completedAt: new Date() } });
    return { ok: true as const, shopifyProductId: remote.id, translationError };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Shopify sync error.";
    await db.product.update({ where: { id: productId }, data: { syncStatus: "FAILED", syncError: message } });
    await db.productSyncEvent.update({ where: { id: event.id }, data: { status: "FAILED", error: message, completedAt: new Date() } });
    return { ok: false as const, error: message };
  }
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
