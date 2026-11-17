import {
  defineListStateSchema,
  enumField,
  parseListState,
  sentinelField,
  stringField,
  type ListStateParamSource,
} from "@/lib/list-state";

import type { AdminReviewListFilters } from "@/lib/reviews/queries";

export const ADMIN_REVIEW_STATUS_OPTIONS = [
  "ALL",
  "PENDING",
  "PUBLISHED",
  "HIDDEN",
] as const;

export const ADMIN_REVIEW_RATING_OPTIONS = [
  "ALL",
  "1",
  "2",
  "3",
  "4",
  "5",
] as const;

export const ADMIN_REVIEW_LOCALE_OPTIONS = ["ALL", "en", "pt", "ru"] as const;

export const ADMIN_REVIEW_SORT_OPTIONS = [
  "newest",
  "oldest",
  "rating_desc",
  "rating_asc",
] as const;

export type AdminReviewStatusFilter = (typeof ADMIN_REVIEW_STATUS_OPTIONS)[number];
export type AdminReviewRatingFilter = (typeof ADMIN_REVIEW_RATING_OPTIONS)[number];
export type AdminReviewLocaleFilter = (typeof ADMIN_REVIEW_LOCALE_OPTIONS)[number];
export type AdminReviewSortKey = (typeof ADMIN_REVIEW_SORT_OPTIONS)[number];

export const adminReviewsListSchema = defineListStateSchema({
  q: stringField({ key: "q" }),
  status: enumField({
    key: "status",
    defaultValue: "ALL" as AdminReviewStatusFilter,
    allowed: ADMIN_REVIEW_STATUS_OPTIONS,
  }),
  product: sentinelField({ key: "product", defaultValue: "ALL" }),
  rating: enumField({
    key: "rating",
    defaultValue: "ALL" as AdminReviewRatingFilter,
    allowed: ADMIN_REVIEW_RATING_OPTIONS,
  }),
  locale: enumField({
    key: "locale",
    defaultValue: "ALL" as AdminReviewLocaleFilter,
    allowed: ADMIN_REVIEW_LOCALE_OPTIONS,
  }),
  from: stringField({ key: "from" }),
  to: stringField({ key: "to" }),
  sort: enumField({
    key: "sort",
    defaultValue: "newest" as AdminReviewSortKey,
    allowed: ADMIN_REVIEW_SORT_OPTIONS,
  }),
  page: stringField({ key: "page", defaultValue: "1" }),
});

export type AdminReviewsListState = {
  q: string;
  status: AdminReviewStatusFilter;
  product: string;
  rating: AdminReviewRatingFilter;
  locale: AdminReviewLocaleFilter;
  from: string;
  to: string;
  sort: AdminReviewSortKey;
  page: string;
};

export const ADMIN_REVIEWS_LIST_ID = "admin-reviews";
export const ADMIN_REVIEWS_LIST_STORAGE_VERSION = 1;

export function parseAdminReviewsListState(
  source: ListStateParamSource,
): AdminReviewsListState {
  return parseListState(adminReviewsListSchema, source);
}

export function toAdminReviewListFilters(
  state: AdminReviewsListState,
): AdminReviewListFilters {
  const pageNum = Number.parseInt(state.page, 10);
  return {
    q: state.q.trim() ? state.q.trim() : undefined,
    status: state.status === "ALL" ? undefined : state.status,
    productId: state.product === "ALL" ? undefined : state.product,
    rating: state.rating === "ALL" ? undefined : Number(state.rating),
    locale: state.locale === "ALL" ? undefined : state.locale,
    dateFrom: state.from.trim() || undefined,
    dateTo: state.to.trim() || undefined,
    sort: state.sort,
    page: Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1,
    pageSize: 25,
  };
}
