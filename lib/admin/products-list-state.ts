import {
  defineListStateSchema,
  enumField,
  parseListState,
  sentinelField,
  stringField,
  type ListStateParamSource,
} from "@/lib/list-state";

import {
  ADMIN_PRODUCT_SORT_OPTIONS,
  type AdminProductListFilters,
  type AdminProductSortKey,
} from "@/lib/admin/list-products-shared";

export const ADMIN_PRODUCT_STATUS_OPTIONS = [
  "ALL",
  "PUBLISHED",
  "DRAFT",
  "UNLISTED",
  "ARCHIVED",
] as const;

export type AdminProductStatusFilter = (typeof ADMIN_PRODUCT_STATUS_OPTIONS)[number];

const SORT_VALUES = ADMIN_PRODUCT_SORT_OPTIONS.map((option) => option.value) as [
  AdminProductSortKey,
  ...AdminProductSortKey[],
];

/**
 * Admin products list schema. Adding a filter = one entry here.
 * Pagination `cursor` is intentionally absent (never URL-restored / never stored).
 */
export const adminProductsListSchema = defineListStateSchema({
  q: stringField({ key: "q" }),
  status: enumField({
    key: "status",
    defaultValue: "ALL" as AdminProductStatusFilter,
    allowed: ADMIN_PRODUCT_STATUS_OPTIONS,
  }),
  category: sentinelField({ key: "category", defaultValue: "ALL" }),
  collection: sentinelField({ key: "collection", defaultValue: "ALL" }),
  sort: enumField({
    key: "sort",
    defaultValue: "published" as AdminProductSortKey,
    allowed: SORT_VALUES,
  }),
});

export type AdminProductsListState = {
  q: string;
  status: AdminProductStatusFilter;
  category: string;
  collection: string;
  sort: AdminProductSortKey;
};

export const ADMIN_PRODUCTS_LIST_ID = "admin-products";
export const ADMIN_PRODUCTS_LIST_STORAGE_VERSION = 1;

export function parseAdminProductsListState(
  source: ListStateParamSource,
): AdminProductsListState {
  return parseListState(adminProductsListSchema, source);
}

/** Map list-state → `listAdminProductsPage` / API filter bag (no cursor). */
export function toAdminProductListFilters(
  state: AdminProductsListState,
): AdminProductListFilters {
  return {
    q: state.q.trim() ? state.q.trim() : undefined,
    status: state.status === "ALL" ? undefined : state.status,
    categoryId: state.category === "ALL" ? undefined : state.category,
    collectionId: state.collection === "ALL" ? undefined : state.collection,
    sort: state.sort,
  };
}
