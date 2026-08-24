import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { characteristicDisplayValue, PRODUCT_CHARACTERISTICS } from "@/lib/products/characteristics";
import { shopifyAdminRequest, ShopifyAdminError, shopifyNumericId } from "@/lib/shopify/admin";
import { env } from "@/lib/env";

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
    preview: { image: { url: string; width: number | null; height: number | null } | null } | null;
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

const PRODUCT_FIELDS = `
  id title handle descriptionHtml vendor productType tags status updatedAt totalInventory
  category { id name fullName }
  seo { title description }
  media(first: 100) {
    nodes { id alt mediaContentType preview { image { url width height } } }
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

function cents(value: string | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
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

async function savePulledProduct(remote: ShopifyProduct, eventId?: string, force = false) {
  const firstVariant = remote.variants.nodes[0];
  const onlineStorePublication = remote.resourcePublicationsV2.nodes.find((item) => /online store/i.test(item.publication.name));
  const publishedToOnlineStore = Boolean(onlineStorePublication?.isPublished);
  const remoteSku = firstVariant?.sku?.trim() || `SHOPIFY-${remote.id.split("/").pop()}`;
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
      productType: "ARTIFACT",
      priceCents: cents(firstVariant?.price),
      compareAtCents: firstVariant?.compareAtPrice ? cents(firstVariant.compareAtPrice) : null,
      imageUrl: remote.featuredMedia?.preview?.image?.url ?? null,
      status: remote.status,
      visibility: remote.status === "ACTIVE" && publishedToOnlineStore ? "PUBLIC" : "PRIVATE",
      publishedAt: remote.status === "ACTIVE" && publishedToOnlineStore
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
      currency: "EUR",
      priceCents: cents(firstVariant?.price),
      compareAtCents: firstVariant?.compareAtPrice ? cents(firstVariant.compareAtPrice) : null,
      imageUrl: remote.featuredMedia?.preview?.image?.url ?? null,
      status: remote.status,
      visibility: remote.status === "ACTIVE" && publishedToOnlineStore ? "PUBLIC" : "PRIVATE",
      publishedAt: remote.status === "ACTIVE" && publishedToOnlineStore
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
        priceCents: cents(variant.price),
        compareAtCents: variant.compareAtPrice ? cents(variant.compareAtPrice) : null,
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
        priceCents: cents(variant.price),
        compareAtCents: variant.compareAtPrice ? cents(variant.compareAtPrice) : null,
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
  const localVariant = local.variants[0] ?? null;
  const remoteVariant = remote.variants.nodes[0] ?? null;

  compare("Name", local.name, remote.title);
  compare("Handle", local.slug, remote.handle);
  compare("Description", local.description ?? "", stripHtml(remote.descriptionHtml));
  compare("Status", local.status, remote.status);
  const publishedPublications = remote.resourcePublicationsV2.nodes
    .filter((item) => item.isPublished)
    .map((item) => item.publication.name)
    .sort();
  const publishedToOnlineStore = publishedPublications.some((name) => /online store/i.test(name));
  compare("Online Store publication", local.visibility === "PUBLIC" ? "Published" : "Not published", publishedToOnlineStore ? "Published" : "Not published");
  compare("Primary image", local.imageUrl ?? "", remote.featuredMedia?.preview?.image?.url ?? "");
  compare("SKU", localVariant?.sku ?? local.sku, remoteVariant?.sku ?? "");
  compare("Price", localVariant?.priceCents ?? local.priceCents, cents(remoteVariant?.price));
  compare("Compare-at price", localVariant?.compareAtCents ?? "", remoteVariant?.compareAtPrice ? cents(remoteVariant.compareAtPrice) : "");
  compare("Available quantity", localVariant?.stockOnHand ?? 0, remoteVariant?.inventoryQuantity ?? 0);
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

  const remoteChanged = !local.shopifyUpdatedAt || new Date(remote.updatedAt).getTime() > local.shopifyUpdatedAt.getTime();
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

export async function pushProductToShopify(productId: string) {
  const event = await db.productSyncEvent.create({
    data: { productId, direction: "PUSH", status: "PROCESSING", attemptCount: 1 },
  });
  await db.product.update({ where: { id: productId }, data: { syncStatus: "PENDING", syncError: null } });

  try {
    const product = await db.product.findUniqueOrThrow({
      where: { id: productId },
      include: { characteristics: true, variants: { orderBy: { createdAt: "asc" } }, tags: { include: { tag: true } } },
    });
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
      sku: product.sku,
      ...(unitWeight && unitWeight.greaterThan(0)
        ? { measurement: { weight: { value: unitWeight.toNumber(), unit: "GRAMS" as const } } }
        : {}),
    };
    const shopifyImageUrl = product.imageUrl?.startsWith("http")
      ? product.imageUrl
      : product.imageUrl && env.NEXT_PUBLIC_APP_URL
        ? new URL(product.imageUrl, env.NEXT_PUBLIC_APP_URL).toString()
        : null;
    const currentRemote = product.shopifyProductId ? await fetchShopifyProduct(product.shopifyProductId) : null;
    const files = shopifyImageUrl
      ? currentRemote?.featuredMedia?.preview?.image?.url === shopifyImageUrl
        ? [{ id: currentRemote.featuredMedia.id, alt: product.name }]
        : [{ originalSource: shopifyImageUrl, alt: product.name }]
      : [];
    const input = {
      title: product.name,
      handle: product.slug,
      descriptionHtml: product.description ? `<p>${product.description.replace(/[<>&]/g, "")}</p>` : "",
      productType: product.productType.toLowerCase(),
      status: product.status,
      tags: product.tags.map((item) => item.tag.name),
      ...(!product.shopifyProductId ? {
        productOptions: [{ name: "Title", position: 1, values: [{ name: "Default Title" }] }],
        variants: [{
          sku: product.sku,
          price: (product.priceCents / 100).toFixed(2),
          compareAtPrice: product.compareAtCents == null ? null : (product.compareAtCents / 100).toFixed(2),
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
    const localVariant = product.variants[0];
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
            price: (product.priceCents / 100).toFixed(2),
            compareAtPrice: product.compareAtCents == null ? null : (product.compareAtCents / 100).toFixed(2),
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
            productId, sku: product.sku, title: savedVariant.title || "Default Title",
            priceCents: product.priceCents, compareAtCents: product.compareAtCents,
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
    await db.product.update({ where: { id: productId }, data: {
      shopifyProductId: remote.id, shopifyHandle: remote.handle,
      shopifyUpdatedAt: new Date(remote.updatedAt), lastSyncedAt: new Date(),
      syncStatus: "SYNCED", syncError: null,
    } });
    await db.productSyncEvent.update({ where: { id: event.id }, data: { shopifyProductId: remote.id, status: "SUCCEEDED", completedAt: new Date() } });
    return { ok: true as const, shopifyProductId: remote.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Shopify sync error.";
    await db.product.update({ where: { id: productId }, data: { syncStatus: "FAILED", syncError: message } });
    await db.productSyncEvent.update({ where: { id: event.id }, data: { status: "FAILED", error: message, completedAt: new Date() } });
    return { ok: false as const, error: message };
  }
}

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
  }>;
  pushToShopify: Array<{ productId: string; name: string; slug: string; sku: string }>;
  archiveLocal: Array<{ productId: string; name: string; shopifyProductId: string }>;
};

export async function previewShopifyReconciliation(): Promise<ShopifyReconciliationPreview> {
  const remoteProducts: ShopifyProduct[] = [];
  let cursor: string | null = null;
  do {
    const data: {
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: ShopifyProduct[];
      };
    } = await shopifyAdminRequest(
      `query SynaravaReconciliationPreview($after: String) {
        products(first: 100, after: $after, sortKey: UPDATED_AT) {
          pageInfo { hasNextPage endCursor }
          nodes { id title handle updatedAt variants(first: 1) { nodes { id title sku price compareAtPrice } } }
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
    const remoteIsNewer = Boolean(
      existingById &&
      (!existingById.shopifyUpdatedAt || new Date(product.updatedAt).getTime() > existingById.shopifyUpdatedAt.getTime()),
    );
    const localHasChanges = Boolean(
      existingById && ["PENDING", "FAILED", "CONFLICT"].includes(existingById.syncStatus),
    );

    if (existing?.shopifyProductId && existing.shopifyProductId !== product.id) action = "CONFLICT";
    else if (existingById && localHasChanges && remoteIsNewer) action = "CONFLICT";
    else if (existingById && remoteIsNewer) action = "UPDATE_LOCAL";
    else if (existingById) action = "UP_TO_DATE";
    else if (existing) action = "LINK_AND_UPDATE_LOCAL";

    return {
      shopifyProductId: product.id,
      title: product.title,
      handle: product.handle,
      sku,
      action,
      localProductId: existing?.id ?? null,
      localName: existing?.name ?? null,
    };
  });

  const pushToShopify = localProducts
    .filter(
      (product) => {
        if (product.syncStatus === "CONFLICT") return false;
        if (!product.shopifyProductId) return !matchedLocalIds.has(product.id);
        if (!(["PENDING", "FAILED"] as string[]).includes(product.syncStatus)) return false;
        const remoteProduct = remoteProducts.find((remote) => remote.id === product.shopifyProductId);
        if (!remoteProduct) return false;
        return Boolean(
          product.shopifyUpdatedAt &&
          product.shopifyUpdatedAt.getTime() >= new Date(remoteProduct.updatedAt).getTime(),
        );
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
