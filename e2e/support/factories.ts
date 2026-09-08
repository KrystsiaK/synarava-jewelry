import { PrismaClient, type Prisma } from "@prisma/client";

import { readEnvValue } from "./env";

// Force env files to be parsed into process.env before PrismaClient reads
// DATABASE_URL — Playwright's test process gets none of the env loading
// `next dev`/`next build` do for us.
readEnvValue("DATABASE_URL");

export const db = new PrismaClient();

/**
 * Every record created through this module is named `e2e-<runId>-...`.
 * `cleanupTestData` deletes by that prefix, and specs should never assert
 * absolute counts in a shared, parallel-run database — only the presence or
 * absence of their own prefixed records.
 */
export function testDataPrefix(runId: string): string {
  return `e2e-${runId}`;
}

function uniqueSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

export type CreateTestProductInput = Partial<
  Pick<
    Prisma.ProductCreateInput,
    | "name"
    | "priceCents"
    | "status"
    | "visibility"
    | "imageUrl"
    | "details"
    | "publishedAt"
  >
> & { slugSuffix?: string };

export async function createTestProduct(runId: string, input: CreateTestProductInput = {}) {
  const prefix = testDataPrefix(runId);
  const suffix = input.slugSuffix ?? uniqueSuffix();
  return db.product.create({
    data: {
      slug: `${prefix}-product-${suffix}`,
      sku: `${prefix}-SKU-${suffix}`.toUpperCase(),
      name: input.name ?? `E2E Test Product ${suffix}`,
      priceCents: input.priceCents ?? 4500,
      status: input.status ?? "DRAFT",
      visibility: input.visibility ?? "PRIVATE",
      imageUrl: input.imageUrl ?? null,
      details: input.details,
      publishedAt: input.publishedAt ?? null,
    },
  });
}

export async function createTestProductVariant(
  productId: string,
  overrides: Partial<Pick<Prisma.ProductVariantCreateInput, "sku" | "priceCents" | "stockOnHand" | "status">> = {},
) {
  const suffix = uniqueSuffix();
  return db.productVariant.create({
    data: {
      product: { connect: { id: productId } },
      sku: overrides.sku ?? `VARIANT-${suffix}`.toUpperCase(),
      title: "Default Title",
      priceCents: overrides.priceCents ?? 4500,
      stockOnHand: overrides.stockOnHand ?? 1,
      status: overrides.status ?? "DRAFT",
    },
  });
}

export type CreateTestCollectionInput = Partial<
  Pick<
    Prisma.CollectionCreateInput,
    "name" | "status" | "visibility" | "isPrimaryNav" | "navSortOrder" | "heroImageUrl"
  >
> & { slugSuffix?: string };

export async function createTestCollection(runId: string, input: CreateTestCollectionInput = {}) {
  const prefix = testDataPrefix(runId);
  const suffix = input.slugSuffix ?? uniqueSuffix();
  return db.collection.create({
    data: {
      slug: `${prefix}-collection-${suffix}`,
      name: input.name ?? `E2E Test Collection ${suffix}`,
      status: input.status ?? "DRAFT",
      visibility: input.visibility ?? "PRIVATE",
      isPrimaryNav: input.isPrimaryNav ?? false,
      navSortOrder: input.navSortOrder ?? 0,
      heroImageUrl: input.heroImageUrl ?? null,
    },
  });
}

export async function assignProductToCollection(productId: string, collectionId: string) {
  return db.productCollection.create({
    data: { productId, collectionId },
  });
}

export type CreateTestPageInput = Partial<
  Pick<Prisma.PageCreateInput, "title" | "status" | "visibility" | "content">
> & { slugSuffix?: string };

export async function createTestPage(runId: string, input: CreateTestPageInput = {}) {
  const prefix = testDataPrefix(runId);
  const suffix = input.slugSuffix ?? uniqueSuffix();
  return db.page.create({
    data: {
      slug: `${prefix}-page-${suffix}`,
      title: input.title ?? `E2E Test Page ${suffix}`,
      template: "STATIC_PAGE",
      status: input.status ?? "DRAFT",
      visibility: input.visibility ?? "PRIVATE",
      content: input.content,
    },
  });
}

/** Deletes every record created under this run's prefix. Call in afterAll. */
export async function cleanupTestData(runId: string) {
  const prefix = testDataPrefix(runId);
  await db.product.deleteMany({ where: { slug: { startsWith: prefix } } });
  await db.collection.deleteMany({ where: { slug: { startsWith: prefix } } });
  await db.page.deleteMany({ where: { slug: { startsWith: prefix } } });
}
