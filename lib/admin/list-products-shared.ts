export const ADMIN_PRODUCT_PAGE_SIZE = 30;
export const ADMIN_PRODUCT_MAX_PAGE_SIZE = 60;
export const ADMIN_PRODUCT_CANDIDATE_CAP = 2000;

export const ADMIN_PRODUCT_SORT_OPTIONS = [
  {
    value: "problems",
    label: "Most problems",
    shortLabel: "Problems",
    tone: "danger" as const,
    tooltip: "Open content issues first — missing fields, broken media, validation errors.",
  },
  {
    value: "conflicts",
    label: "Most conflicts",
    shortLabel: "Conflicts",
    tone: "conflict" as const,
    tooltip: "Shopify ↔ Synarava field conflicts first — shared commerce and locale diffs.",
  },
  {
    value: "collection-priority",
    label: "Collection priority",
    shortLabel: "Priority",
    tooltip: "Manual order inside the selected collection (Shopify collection sort).",
  },
  {
    value: "published",
    label: "Latest published",
    shortLabel: "Published",
    tooltip: "Newest publish date first. Drafts without a publish date sink to the bottom.",
  },
  {
    value: "updated",
    label: "Recently updated",
    shortLabel: "Updated",
    tooltip: "Most recently edited products first.",
  },
  {
    value: "name-asc",
    label: "Name A–Z",
    shortLabel: "A–Z",
    tooltip: "Alphabetical by product name.",
  },
  {
    value: "name-desc",
    label: "Name Z–A",
    shortLabel: "Z–A",
    tooltip: "Reverse alphabetical by product name.",
  },
  {
    value: "price-desc",
    label: "Price high–low",
    shortLabel: "Price ↓",
    tooltip: "Highest price first.",
  },
  {
    value: "price-asc",
    label: "Price low–high",
    shortLabel: "Price ↑",
    tooltip: "Lowest price first.",
  },
] as const;

export type AdminProductSortKey = (typeof ADMIN_PRODUCT_SORT_OPTIONS)[number]["value"];

export type AdminProductListFilters = {
  q?: string;
  status?: string;
  categoryId?: string;
  collectionId?: string;
  sort?: AdminProductSortKey;
};

export type AdminProductLocaleSignal = {
  code: string;
  label: string;
  percent: number;
  complete: boolean;
  reviewed: boolean;
  syncStatus: "NOT_APPLICABLE" | "PENDING" | "SYNCED" | "FAILED" | "CONFLICT" | null;
  missing: string[];
};

export type AdminProductListItem = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED" | "UNLISTED";
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  priceCents: number;
  shopifyCategoryId: string | null;
  shopifyCategoryName: string | null;
  shopifyProductId: string | null;
  syncStatus: "UNLINKED" | "PENDING" | "SYNCED" | "FAILED" | "CONFLICT";
  lastSyncedAt: string | null;
  shopifyUpdatedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  issueCount: number;
  issueHref: string | null;
  conflictScore: number;
  locales: AdminProductLocaleSignal[];
  collections: Array<{
    sortOrder: number;
    collection: { id: string; shopifyCollectionId: string | null };
  }>;
};

export type AdminProductListPage = {
  nodes: AdminProductListItem[];
  hasNextPage: boolean;
  endCursor: string | null;
  totalCount: number;
};

export function clampAdminProductPageSize(raw: string | number | null | undefined): number {
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return ADMIN_PRODUCT_PAGE_SIZE;
  return Math.min(Math.trunc(parsed), ADMIN_PRODUCT_MAX_PAGE_SIZE);
}

export function normalizeAdminProductSort(value: unknown): AdminProductSortKey {
  if (typeof value === "string" && ADMIN_PRODUCT_SORT_OPTIONS.some((option) => option.value === value)) {
    return value as AdminProductSortKey;
  }
  return "published";
}

export function listItemStatusLabel(item: Pick<AdminProductListItem, "status" | "visibility">):
  | "PUBLISHED"
  | "DRAFT"
  | "ARCHIVED"
  | "UNLISTED" {
  if (item.status === "ARCHIVED") return "ARCHIVED";
  if (item.status === "UNLISTED") return "UNLISTED";
  return item.status === "ACTIVE" && item.visibility === "PUBLIC" ? "PUBLISHED" : "DRAFT";
}
