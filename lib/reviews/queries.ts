import "server-only";

import type { Prisma, ProductReviewStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { toProductReviewsData } from "@/lib/reviews/map-public";
import { EMPTY_PRODUCT_REVIEWS, type ProductReviewsData } from "@/lib/reviews/public";
import { normalizeReviewEmail } from "@/lib/reviews/author";

export async function getPublishedProductReviewsBySlug(
  slug: string,
): Promise<ProductReviewsData> {
  const product = await db.product.findUnique({
    where: { slug },
    select: {
      id: true,
      reviews: {
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          rating: true,
          title: true,
          body: true,
          authorName: true,
          status: true,
          verifiedPurchase: true,
          createdAt: true,
        },
      },
    },
  });
  if (!product) return EMPTY_PRODUCT_REVIEWS;
  return toProductReviewsData(product.reviews);
}

export async function countPendingProductReviews(): Promise<number> {
  return db.productReview.count({ where: { status: "PENDING" } });
}

export type AdminReviewListFilters = {
  q?: string;
  status?: ProductReviewStatus;
  productId?: string;
  rating?: number;
  locale?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: "newest" | "oldest" | "rating_desc" | "rating_asc";
  page?: number;
  pageSize?: number;
};

export type AdminReviewListItem = {
  id: string;
  productId: string;
  productSlug: string;
  productName: string;
  locale: string;
  rating: number;
  title: string;
  body: string;
  authorName: string;
  authorEmail: string;
  status: ProductReviewStatus;
  verifiedPurchase: boolean;
  createdAt: string;
  moderatedAt: string | null;
  moderatedBy: string | null;
};

export type AdminReviewListPage = {
  items: AdminReviewListItem[];
  total: number;
  page: number;
  pageSize: number;
};

function buildWhere(filters: AdminReviewListFilters): Prisma.ProductReviewWhereInput {
  const where: Prisma.ProductReviewWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.productId) where.productId = filters.productId;
  if (filters.rating) where.rating = filters.rating;
  if (filters.locale) where.locale = filters.locale;
  if (filters.dateFrom || filters.dateTo) {
    const from = filters.dateFrom ? new Date(filters.dateFrom) : null;
    const to = filters.dateTo ? new Date(filters.dateTo) : null;
    const fromOk = from !== null && !Number.isNaN(from.getTime());
    const toOk = to !== null && !Number.isNaN(to.getTime());
    if (fromOk || toOk) {
      where.createdAt = {};
      if (fromOk) where.createdAt.gte = from;
      if (toOk && to) {
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }
  }
  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { body: { contains: q, mode: "insensitive" } },
      { authorName: { contains: q, mode: "insensitive" } },
      { authorEmail: { contains: q.toLowerCase(), mode: "insensitive" } },
      { product: { name: { contains: q, mode: "insensitive" } } },
      { product: { slug: { contains: q, mode: "insensitive" } } },
    ];
  }
  return where;
}

function buildOrderBy(
  sort: AdminReviewListFilters["sort"],
): Prisma.ProductReviewOrderByWithRelationInput {
  if (sort === "oldest") return { createdAt: "asc" };
  if (sort === "rating_desc") return { rating: "desc" };
  if (sort === "rating_asc") return { rating: "asc" };
  return { createdAt: "desc" };
}

export async function listAdminProductReviews(
  filters: AdminReviewListFilters = {},
): Promise<AdminReviewListPage> {
  const pageSize = Math.min(Math.max(filters.pageSize ?? 25, 1), 100);
  const page = Math.max(filters.page ?? 1, 1);
  const where = buildWhere(filters);
  const [total, rows] = await Promise.all([
    db.productReview.count({ where }),
    db.productReview.findMany({
      where,
      orderBy: buildOrderBy(filters.sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        product: { select: { id: true, slug: true, name: true } },
      },
    }),
  ]);

  return {
    total,
    page,
    pageSize,
    items: rows.map((row) => ({
      id: row.id,
      productId: row.productId,
      productSlug: row.product.slug,
      productName: row.product.name,
      locale: row.locale,
      rating: row.rating,
      title: row.title,
      body: row.body,
      authorName: row.authorName,
      authorEmail: row.authorEmail,
      status: row.status,
      verifiedPurchase: row.verifiedPurchase,
      createdAt: row.createdAt.toISOString(),
      moderatedAt: row.moderatedAt?.toISOString() ?? null,
      moderatedBy: row.moderatedBy,
    })),
  };
}

export async function getCustomerLocalReviews(email: string | null | undefined) {
  if (!email?.trim()) return [];
  const authorEmail = normalizeReviewEmail(email);
  return db.productReview.findMany({
    where: { authorEmail },
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { id: true, slug: true, name: true } },
    },
  });
}
