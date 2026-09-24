import { STOREFRONT_COPY_GROUPS } from "@/lib/content/storefront-copy-fields";

/** Attention signal for a nav node (open problems and/or Shopify sync conflicts). */
export type AdminNavSignal = "issue" | "sync" | "both";

export type AdminNavChildConfig = {
  id: string;
  href: string;
  label: string;
};

export type AdminNavBadgeConfig = {
  kind: "issues" | "sync";
  count: number;
};

/**
 * Declarative admin sidebar item.
 * Set `children` only for sections that expand in-place (Pages, Header & Footer).
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

export type BuildAdminNavItemsInput = {
  pages?: AdminNavPageRef[];
  issueCount?: number;
  syncCount?: number;
};

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
  issueHrefs: ReadonlySet<string>,
  syncHrefs: ReadonlySet<string>,
): AdminNavSignal | undefined {
  let hasIssue = false;
  let hasSync = false;
  for (const issueHref of issueHrefs) {
    if (adminHrefMatches(href, issueHref) || adminHrefMatches(issueHref, href)) {
      hasIssue = true;
      break;
    }
  }
  for (const syncHref of syncHrefs) {
    if (adminHrefMatches(href, syncHref) || adminHrefMatches(syncHref, href)) {
      hasSync = true;
      break;
    }
  }
  if (hasIssue && hasSync) return "both";
  if (hasIssue) return "issue";
  if (hasSync) return "sync";
  return undefined;
}

/** Parent inherits signal if any child or the parent path itself is flagged. */
export function resolveAdminNavItemSignal(
  item: AdminNavItemConfig,
  issueHrefs: ReadonlySet<string>,
  syncHrefs: ReadonlySet<string>,
): AdminNavSignal | undefined {
  const own = resolveAdminNavSignal(item.href, issueHrefs, syncHrefs);
  if (own === "both") return "both";

  let hasIssue = own === "issue";
  let hasSync = own === "sync";

  for (const child of item.children ?? []) {
    const childSignal = resolveAdminNavSignal(child.href, issueHrefs, syncHrefs);
    if (childSignal === "issue" || childSignal === "both") hasIssue = true;
    if (childSignal === "sync" || childSignal === "both") hasSync = true;
    if (hasIssue && hasSync) return "both";
  }

  if (hasIssue && hasSync) return "both";
  if (hasIssue) return "issue";
  if (hasSync) return "sync";
  return undefined;
}

export function buildStorefrontCopyNavChildren(): AdminNavChildConfig[] {
  return [
    {
      id: "settings-header-main",
      href: "/admin/settings#copy-header-main",
      label: "Header — main links",
    },
    ...STOREFRONT_COPY_GROUPS.map((group) => ({
      id: `settings-${group.id}`,
      href: `/admin/settings#copy-${group.id}`,
      label: group.title,
    })),
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
 * Catalog stays a leaf; Pages + Header & Footer expand inline.
 */
export function buildAdminNavItems({
  pages = [],
  issueCount = 0,
  syncCount = 0,
}: BuildAdminNavItemsInput = {}): AdminNavItemConfig[] {
  const pageChildren = buildPagesNavChildren(pages);

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
    },
    {
      id: "settings",
      href: "/admin/settings",
      label: "Header & Footer",
      code: "HF",
      children: buildStorefrontCopyNavChildren(),
      childPreviewLimit: 12,
    },
    { id: "meta", href: "/admin/meta", label: "Meta", code: "META" },
    { id: "videos", href: "/admin/videos", label: "Videos", code: "VID" },
    { id: "products", href: "/admin/products", label: "Catalog", code: "CAT" },
    {
      id: "issues",
      href: "/admin/issues",
      label: "Problems",
      code: "QA",
      badge: issueCount > 0 ? { kind: "issues", count: issueCount } : undefined,
    },
    { id: "collections", href: "/admin/collections", label: "Collections", code: "COL" },
    {
      id: "translations",
      href: "/admin/translations",
      label: "Localization",
      code: "I18N",
      badge: syncCount > 0 ? { kind: "sync", count: syncCount } : undefined,
    },
    { id: "account", href: "/admin/account", label: "Account", code: "ACC" },
  ];
}

/** Map an open admin issue onto the most specific sidebar href. */
export function issueToNavHref(issue: {
  entityType: string;
  targetHref?: string | null;
}): string {
  if (issue.entityType === "PRODUCT") return "/admin/products";
  if (issue.entityType === "COLLECTION") return "/admin/collections";
  if (issue.entityType === "PAGE") {
    const slug = pageSlugFromAdminHref(issue.targetHref);
    return slug ? `/admin/pages/${slug}` : "/admin/pages";
  }
  if (issue.entityType === "CATEGORY") return "/admin/categories";
  if (issue.entityType === "TAG") return "/admin/tags";
  return "/admin/issues";
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
