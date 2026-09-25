import "server-only";

import type { Prisma } from "@prisma/client";

import { productCollectionPosition } from "@/lib/catalog/collection-order";
import { db } from "@/lib/db";
import { getAdminTranslationLocales } from "@/lib/i18n/admin-translation-locales";
import { productLocaleReadiness } from "@/lib/products/localization";
import type { CatalogConflictProductSignal } from "@/lib/shopify/catalog-conflict-signals";
import { getCatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals-server";
import {
  ADMIN_PRODUCT_CANDIDATE_CAP,
  clampAdminProductPageSize,
  listItemStatusLabel,
  normalizeAdminProductSort,
  type AdminProductListFilters,
  type AdminProductListItem,
  type AdminProductListPage,
  type AdminProductLocaleSignal,
  type AdminProductSortKey,
} from "@/lib/admin/list-products-shared";

export {
  ADMIN_PRODUCT_PAGE_SIZE,
  ADMIN_PRODUCT_MAX_PAGE_SIZE,
  ADMIN_PRODUCT_CANDIDATE_CAP,
  ADMIN_PRODUCT_SORT_OPTIONS,
  clampAdminProductPageSize,
  listItemStatusLabel,
  normalizeAdminProductSort,
  type AdminProductListFilters,
  type AdminProductListItem,
  type AdminProductListPage,
  type AdminProductLocaleSignal,
  type AdminProductSortKey,
} from "@/lib/admin/list-products-shared";

type CursorPayload = { fp: string; id: string };

function fingerprint(filters: AdminProductListFilters): string {
  const entries = Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== "" && value !== "ALL")
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

export function encodeAdminProductCursor(filters: AdminProductListFilters, lastId: string): string {
  const payload: CursorPayload = { fp: fingerprint(filters), id: lastId };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeAdminProductCursor(
  raw: string | null | undefined,
  filters: AdminProductListFilters,
): string | null {
  if (!raw) return null;
  try {
    const payload = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<CursorPayload>;
    if (typeof payload.id !== "string" || payload.fp !== fingerprint(filters)) return null;
    return payload.id;
  } catch {
    return null;
  }
}

function conflictScore(signal: CatalogConflictProductSignal | undefined): number {
  if (!signal) return 0;
  const localeCount = signal.locales.reduce((sum, entry) => sum + entry.count, 0);
  return localeCount + (signal.shared || signal.presence ? 1 : 0);
}

function buildWhere(filters: AdminProductListFilters): Prisma.ProductWhereInput {
  const clauses: Prisma.ProductWhereInput[] = [];
  const q = filters.q?.trim();
  if (q) {
    clauses.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { seriesLabel: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (filters.categoryId && filters.categoryId !== "ALL") {
    clauses.push({ shopifyCategoryId: filters.categoryId });
  }
  if (filters.collectionId && filters.collectionId !== "ALL") {
    clauses.push({ collections: { some: { collectionId: filters.collectionId } } });
  }

  const status = filters.status && filters.status !== "ALL" ? filters.status : null;
  if (status === "PUBLISHED") {
    clauses.push({ status: "ACTIVE", visibility: "PUBLIC" });
  } else if (status === "DRAFT") {
    clauses.push({
      OR: [
        { status: "DRAFT" },
        { status: "ACTIVE", visibility: { in: ["PRIVATE", "UNLISTED"] } },
      ],
    });
  } else if (status === "UNLISTED") {
    clauses.push({ status: "UNLISTED" });
  } else if (status === "ARCHIVED") {
    clauses.push({ status: "ARCHIVED" });
  }

  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { AND: clauses };
}

const LIST_SELECT = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  status: true,
  visibility: true,
  priceCents: true,
  shopifyCategoryId: true,
  shopifyCategoryName: true,
  shopifyProductId: true,
  syncStatus: true,
  lastSyncedAt: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  shortDescription: true,
  description: true,
  materialLine: true,
  symbolismLabel: true,
  symbolismTitle: true,
  symbolismBody: true,
  symbolismBody2: true,
  details: true,
  seoTitle: true,
  seoDescription: true,
  translations: {
    select: {
      locale: true,
      title: true,
      shortDescription: true,
      description: true,
      materialLine: true,
      symbolismLabel: true,
      symbolismTitle: true,
      symbolismBody: true,
      symbolismBody2: true,
      details: true,
      seoTitle: true,
      seoDescription: true,
      reviewStatus: true,
      syncStatus: true,
    },
  },
  collections: {
    select: {
      sortOrder: true,
      collection: { select: { id: true, shopifyCollectionId: true } },
    },
  },
  variants: {
    orderBy: { createdAt: "asc" as const },
    take: 1,
    select: { priceCents: true },
  },
} satisfies Prisma.ProductSelect;

type ListRow = Prisma.ProductGetPayload<{ select: typeof LIST_SELECT }>;

function toListItem(
  row: ListRow,
  issueCount: number,
  issueHref: string | null,
  score: number,
  localeLabels: Map<string, string>,
): AdminProductListItem {
  const locales: AdminProductLocaleSignal[] = [];
  for (const [code, label] of localeLabels) {
    const readiness = productLocaleReadiness(row, code as Parameters<typeof productLocaleReadiness>[1]);
    const translation = row.translations.find((item) => item.locale === code);
    locales.push({
      code,
      label,
      percent: readiness.percent,
      complete: readiness.complete,
      reviewed: readiness.reviewed,
      syncStatus: code === "en" ? null : (translation?.syncStatus ?? "NOT_APPLICABLE"),
      missing: readiness.missing,
    });
  }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    status: row.status,
    visibility: row.visibility,
    priceCents: row.variants[0]?.priceCents ?? row.priceCents,
    shopifyCategoryId: row.shopifyCategoryId,
    shopifyCategoryName: row.shopifyCategoryName,
    shopifyProductId: row.shopifyProductId,
    syncStatus: row.syncStatus,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    issueCount,
    issueHref,
    conflictScore: score,
    locales,
    collections: row.collections,
  };
}

function compareRows(
  left: AdminProductListItem,
  right: AdminProductListItem,
  sort: AdminProductSortKey,
  collectionId?: string,
): number {
  let primary = 0;
  switch (sort) {
    case "problems":
      primary = right.issueCount - left.issueCount;
      break;
    case "conflicts":
      primary = right.conflictScore - left.conflictScore;
      break;
    case "collection-priority":
      primary = collectionId
        ? productCollectionPosition(left, collectionId) - productCollectionPosition(right, collectionId)
        : 0;
      break;
    case "published": {
      const leftTime = left.publishedAt ? new Date(left.publishedAt).getTime() : -Infinity;
      const rightTime = right.publishedAt ? new Date(right.publishedAt).getTime() : -Infinity;
      primary = rightTime - leftTime;
      break;
    }
    case "updated":
      primary = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      break;
    case "name-asc":
      primary = left.name.localeCompare(right.name);
      break;
    case "name-desc":
      primary = right.name.localeCompare(left.name);
      break;
    case "price-asc":
      primary = left.priceCents - right.priceCents;
      break;
    case "price-desc":
      primary = right.priceCents - left.priceCents;
      break;
  }
  return primary !== 0 ? primary : left.id.localeCompare(right.id);
}

/**
 * Filtered, sorted, cursor-paginated admin product list.
 * Candidate cap + in-memory sort (same idea as the storefront catalog) so
 * problem/conflict scores stay correct without denormalized rank columns.
 */
export async function listAdminProductsPage(params: {
  filters?: AdminProductListFilters;
  cursor?: string | null;
  limit?: number;
  adminUsername?: string;
}): Promise<AdminProductListPage> {
  const sort = normalizeAdminProductSort(params.filters?.sort);
  const filters: AdminProductListFilters = { ...params.filters, sort };
  const limit = clampAdminProductPageSize(params.limit);

  const [rows, issueGroups, translationLocales, conflictSignals] = await Promise.all([
    db.product.findMany({
      where: buildWhere(filters),
      select: LIST_SELECT,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: ADMIN_PRODUCT_CANDIDATE_CAP,
    }),
    db.adminIssue.groupBy({
      by: ["entityId"],
      where: { status: "OPEN", entityType: "PRODUCT" },
      _count: { _all: true },
    }),
    getAdminTranslationLocales(),
    getCatalogConflictSignals(params.adminUsername).catch(() => null),
  ]);

  const signals = conflictSignals ?? { products: {} as Record<string, CatalogConflictProductSignal> };

  const issueCountById = new Map(issueGroups.map((group) => [group.entityId, group._count._all]));
  const issueHrefById = new Map<string, string>();
  if (issueGroups.length > 0) {
    const openIssues = await db.adminIssue.findMany({
      where: {
        status: "OPEN",
        entityType: "PRODUCT",
        entityId: { in: issueGroups.map((group) => group.entityId) },
      },
      select: { entityId: true, targetHref: true },
      orderBy: { updatedAt: "desc" },
    });
    for (const issue of openIssues) {
      if (!issueHrefById.has(issue.entityId)) issueHrefById.set(issue.entityId, issue.targetHref);
    }
  }

  const localeLabels = new Map<string, string>([["en", "English"]]);
  for (const locale of translationLocales) {
    localeLabels.set(locale.code, locale.label);
  }

  let nodes = rows.map((row) =>
    toListItem(
      row,
      issueCountById.get(row.id) ?? 0,
      issueHrefById.get(row.id) ?? null,
      conflictScore(signals.products[row.id]),
      localeLabels,
    ),
  );

  if (filters.status && filters.status !== "ALL") {
    nodes = nodes.filter((item) => listItemStatusLabel(item) === filters.status);
  }

  nodes.sort((left, right) => compareRows(left, right, sort, filters.collectionId));

  const cursorId = decodeAdminProductCursor(params.cursor, filters);
  const afterIndex = cursorId ? nodes.findIndex((node) => node.id === cursorId) : -1;
  const startIndex = afterIndex + 1;
  const window = nodes.slice(startIndex, startIndex + limit + 1);
  const hasNextPage = window.length > limit;
  const page = window.slice(0, limit);

  return {
    nodes: page,
    hasNextPage,
    endCursor: hasNextPage ? encodeAdminProductCursor(filters, page[page.length - 1].id) : null,
    totalCount: nodes.length,
  };
}

/** Lightweight catalog chrome for the products list page (no product rows). */
export async function getAdminCatalogListMeta() {
  const [categoryRows, tags, collections] = await Promise.all([
    db.product.findMany({
      where: { shopifyCategoryId: { not: null } },
      select: { shopifyCategoryId: true, shopifyCategoryName: true },
      distinct: ["shopifyCategoryId"],
      orderBy: { shopifyCategoryName: "asc" },
    }),
    db.tag.findMany({ orderBy: { name: "asc" } }),
    db.collection.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        isStorefrontDefault: true,
        shopifyCollectionId: true,
        status: true,
        visibility: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    categories: categoryRows.map((row) => ({
      slug: row.shopifyCategoryId!,
      name: row.shopifyCategoryName ?? row.shopifyCategoryId!,
    })),
    tags,
    collections,
  };
}
