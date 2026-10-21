import { ACCOUNT_PAGE_AREAS } from "@/lib/content/account-page-fields";
import { COMMERCE_COPY_GROUPS } from "@/lib/content/commerce-copy-fields";

/** Attention signal for a nav node (Shopify sync conflicts). */
export type AdminNavSignal = "sync";

export type AdminNavChildConfig = {
  id: string;
  href: string;
  label: string;
};

export type AdminNavBadgeConfig = {
  kind: "sync";
  count: number;
};

/**
 * Declarative admin sidebar item.
 * Set `children` only for sections that expand in-place (Pages, Shared).
 * Catalog and other list CRUDs stay flat — do not pass product/collection children.
 */
export type AdminNavItemConfig = {
  id: string;
  href: string;
  label: string;
  code?: string;
  exact?: boolean;
  children?: AdminNavChildConfig[];
  /** Visible children before “Show more”. Default 8. */
  childPreviewLimit?: number;
  badge?: AdminNavBadgeConfig;
  /** When true and collapsed with children, show muted child count. */
  showChildCount?: boolean;
};

export type AdminNavPageRef = {
  slug: string;
  title: string;
};

/** Per-section unresolved Shopify divergence counts for sidebar conflict badges. */
export type AdminNavSyncCounts = {
  products: number;
  collections: number;
  pages: number;
  settings: number;
  total: number;
};

export type AdminNavSyncEntityType =
  | "PRODUCT"
  | "COLLECTION"
  | "PAGE"
  | "STOREFRONT_COPY";

export type BuildAdminNavItemsInput = {
  pages?: AdminNavPageRef[];
  /** @deprecated Prefer `syncCounts.total` — kept for callers that only know the hub total. */
  syncCount?: number;
  syncCounts?: Partial<AdminNavSyncCounts>;
};

const EMPTY_SYNC_COUNTS: AdminNavSyncCounts = {
  products: 0,
  collections: 0,
  pages: 0,
  settings: 0,
  total: 0,
};

export function adminNavSyncSectionForEntity(
  rootEntityType: AdminNavSyncEntityType,
): keyof Omit<AdminNavSyncCounts, "total"> {
  if (rootEntityType === "PRODUCT") return "products";
  if (rootEntityType === "COLLECTION") return "collections";
  if (rootEntityType === "PAGE") return "pages";
  return "settings";
}

/** Tally unresolved divergences into sidebar section buckets. */
export function countAdminNavSyncBySection(
  differences: ReadonlyArray<{ rootEntityType: AdminNavSyncEntityType }>,
): AdminNavSyncCounts {
  const counts: AdminNavSyncCounts = { ...EMPTY_SYNC_COUNTS };
  for (const difference of differences) {
    counts.total += 1;
    counts[adminNavSyncSectionForEntity(difference.rootEntityType)] += 1;
  }
  return counts;
}

/** Map a reconcile difference onto the most specific sidebar href. */
export function syncDifferenceToNavHref(
  difference: { rootEntityType: AdminNavSyncEntityType; rootEntityId: string },
  pageSlugById: ReadonlyMap<string, string>,
): string {
  if (difference.rootEntityType === "PRODUCT") return "/admin/products";
  if (difference.rootEntityType === "COLLECTION") return "/admin/collections";
  if (difference.rootEntityType === "STOREFRONT_COPY") return "/admin/settings";
  const slug = pageSlugById.get(difference.rootEntityId);
  return slug ? `/admin/pages/${slug}` : "/admin/pages";
}

function syncBadge(count: number | undefined): AdminNavBadgeConfig | undefined {
  if (!count || count <= 0) return undefined;
  return { kind: "sync", count };
}

const DEFAULT_CHILD_PREVIEW = 8;

export function splitAdminHref(href: string): { pathname: string; hash: string } {
  const [pathname = href, hash = ""] = href.split("#");
  return { pathname, hash };
}

/** True when `candidate` refers to the same place as `target` (path + optional hash). */
export function adminHrefMatches(candidate: string, target: string): boolean {
  const c = splitAdminHref(candidate);
  const t = splitAdminHref(target);
  if (c.pathname !== t.pathname) return false;
  if (!t.hash) return true;
  if (!c.hash) return true;
  return c.hash === t.hash;
}

/** True when `href` is under this nav item’s path (for active / expand). */
export function adminHrefUnder(itemHref: string, currentPathname: string, exact?: boolean): boolean {
  const { pathname } = splitAdminHref(itemHref);
  if (exact) return currentPathname === pathname;
  if (pathname === "/admin") return currentPathname === "/admin";
  return currentPathname === pathname || currentPathname.startsWith(`${pathname}/`);
}

export function resolveAdminNavSignal(
  href: string,
  syncHrefs: ReadonlySet<string>,
): AdminNavSignal | undefined {
  for (const syncHref of syncHrefs) {
    if (adminHrefMatches(href, syncHref) || adminHrefMatches(syncHref, href)) {
      return "sync";
    }
  }
  return undefined;
}

/** Parent inherits signal if any child or the parent path itself is flagged. */
export function resolveAdminNavItemSignal(
  item: AdminNavItemConfig,
  syncHrefs: ReadonlySet<string>,
): AdminNavSignal | undefined {
  if (resolveAdminNavSignal(item.href, syncHrefs)) return "sync";
  for (const child of item.children ?? []) {
    if (resolveAdminNavSignal(child.href, syncHrefs)) return "sync";
  }
  return undefined;
}

export function buildAccountPageNavChildren(): AdminNavChildConfig[] {
  return ACCOUNT_PAGE_AREAS.map((area) => ({
    id: `account-${area.id}`,
    href: `/admin/customer-account#account-${area.id}`,
    label: area.label,
  }));
}

export function buildCommerceCopyNavChildren(): AdminNavChildConfig[] {
  return COMMERCE_COPY_GROUPS.map((group) => ({
    id: `commerce-${group.id}`,
    href: `/admin/commerce#commerce-${group.id}`,
    label: group.title,
  }));
}

export function buildStorefrontCopyNavChildren(): AdminNavChildConfig[] {
  return [
    { id: "settings-header", href: "/admin/settings#shared-header", label: "Header" },
    { id: "settings-footer", href: "/admin/settings#shared-footer", label: "Footer" },
    { id: "settings-home", href: "/admin/settings#shared-home", label: "Home" },
    { id: "settings-cookies", href: "/admin/settings#shared-cookies", label: "Cookies" },
    { id: "settings-contact", href: "/admin/settings#shared-contact", label: "Contact" },
    { id: "settings-reviews", href: "/admin/settings#shared-reviews", label: "Reviews" },
    { id: "settings-taxonomy", href: "/admin/settings#shared-taxonomy", label: "Taxonomy" },
    { id: "settings-sku-policy", href: "/admin/settings#shared-sku-policy", label: "SKU policy" },
  ];
}

export function buildPagesNavChildren(pages: AdminNavPageRef[]): AdminNavChildConfig[] {
  return pages.map((page) => ({
    id: `page-${page.slug}`,
    href: `/admin/pages/${page.slug}`,
    label: page.title.trim() || page.slug,
  }));
}

/**
 * Canonical admin sidebar configuration.
 * Catalog stays a leaf; Pages + Shared expand inline.
 *
 * Conflict (sync) badges sit on the section that owns the divergence —
 * Catalog / Collections / Pages / Shared — plus Translations as the
 * review hub (total). Left markers carry sync attention.
 */
export function buildAdminNavItems({
  pages = [],
  syncCount = 0,
  syncCounts,
}: BuildAdminNavItemsInput = {}): AdminNavItemConfig[] {
  const pageChildren = buildPagesNavChildren(pages);
  const sync: AdminNavSyncCounts = {
    ...EMPTY_SYNC_COUNTS,
    ...syncCounts,
    total: syncCounts?.total ?? syncCount ?? 0,
  };

  return [
    { id: "overview", href: "/admin", exact: true, label: "Overview", code: "CTRL" },
    {
      id: "pages",
      href: "/admin/pages",
      label: "Pages",
      code: "PGS",
      children: pageChildren,
      childPreviewLimit: DEFAULT_CHILD_PREVIEW,
      showChildCount: true,
      badge: syncBadge(sync.pages),
    },
    {
      id: "settings",
      href: "/admin/settings",
      label: "Shared",
      code: "SHR",
      children: buildStorefrontCopyNavChildren(),
      childPreviewLimit: 8,
      badge: syncBadge(sync.settings),
    },
    {
      id: "commerce",
      href: "/admin/commerce",
      label: "Cart & account",
      code: "BAG",
      children: buildCommerceCopyNavChildren(),
      childPreviewLimit: 8,
    },
    {
      id: "customer-account",
      href: "/admin/customer-account",
      label: "Customer account",
      code: "CUS",
      children: buildAccountPageNavChildren(),
      childPreviewLimit: 8,
    },
    { id: "meta", href: "/admin/meta", label: "Meta", code: "META" },
    { id: "videos", href: "/admin/videos", label: "Videos", code: "VID" },
    {
      id: "products",
      href: "/admin/products",
      label: "Catalog",
      code: "CAT",
      badge: syncBadge(sync.products),
    },
    {
      id: "collections",
      href: "/admin/collections",
      label: "Collections",
      code: "COL",
      badge: syncBadge(sync.collections),
    },
    {
      id: "translations",
      href: "/admin/translations",
      label: "Translations",
      code: "I18N",
      badge: syncBadge(sync.total),
    },
    { id: "infrastructure", href: "/admin/infrastructure", label: "Infrastructure", code: "INF" },
    {
      id: "mission-control",
      href: "/admin/mission-control",
      label: "Mission Control",
      code: "MC",
    },
    { id: "account", href: "/admin/account", label: "Account", code: "ACC" },

  ];
}

export function pageSlugFromAdminHref(href: string | null | undefined): string | null {
  if (!href) return null;
  const path = splitAdminHref(href).pathname;
  const match = path.match(/\/admin\/pages\/([^/?#]+)/);
  if (match?.[1] && match[1] !== "new") return match[1];
  if (path.includes("/home")) return "home";
  if (path.includes("/about")) return "about";
  return null;
}
