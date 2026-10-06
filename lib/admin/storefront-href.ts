import { BUILT_IN_PAGE_DEFINITIONS } from "@/lib/content/built-in-pages";
import { localePath, toLocaleFreeHref } from "@/lib/i18n/routing";

export const STOREFRONT_HREF_SEGMENT_LIMIT = 8;

export type StorefrontHrefSegment =
  | "routes"
  | "pages"
  | "collections"
  | "products"
  | "custom";

export type StorefrontHrefHit = {
  id: string;
  segment: StorefrontHrefSegment;
  label: string;
  href: string;
  /** Muted secondary line — path and optional status. */
  detail: string;
  status?: string;
};

export type StorefrontHrefSearchResult = {
  segments: Array<{
    id: StorefrontHrefSegment;
    label: string;
    hits: StorefrontHrefHit[];
  }>;
};

const SEGMENT_LABELS: Record<Exclude<StorefrontHrefSegment, "custom">, string> = {
  routes: "Routes",
  pages: "Pages",
  collections: "Collections",
  products: "Products",
};

export function hrefForPage(slug: string): string {
  return slug === "home" ? "/" : `/${slug}`;
}

export function hrefForProduct(slug: string): string {
  return `/products/${slug}`;
}

export function hrefForCollection(slug: string): string {
  return `/collections/${slug}`;
}

export function looksLikePath(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("/") || /^https?:\/\//i.test(trimmed);
}

export function normalizeHrefQuery(value: string): string {
  return value.trim();
}

export type HrefSearchScope = "all" | "products" | "collections";

export type ParsedHrefSearchQuery = {
  raw: string;
  /** DB contains term; empty = browse first N of the scoped entity. */
  term: string;
  scope: HrefSearchScope;
  browseProducts: boolean;
  browseCollections: boolean;
};

/**
 * Path-aware query parsing so "/products/" and "/collections/foo" drill into
 * catalog segments instead of only matching the top-level route.
 * Locale-prefixed input (`/pt/products/…`) is normalized before scope detection.
 */
export function parseHrefSearchQuery(query: string): ParsedHrefSearchQuery {
  const raw = normalizeHrefQuery(query);
  const free = toLocaleFreeHref(raw);
  const pathForScope = free.startsWith("/") ? free : raw;
  const lower = pathForScope.toLowerCase();

  if (lower === "/products" || lower.startsWith("/products/")) {
    const remainder =
      lower === "/products" || lower === "/products/"
        ? ""
        : pathForScope.slice("/products/".length);
    return {
      raw,
      term: remainder.trim(),
      scope: "products",
      browseProducts: true,
      browseCollections: false,
    };
  }

  if (lower === "/collections" || lower.startsWith("/collections/")) {
    const remainder =
      lower === "/collections" || lower === "/collections/"
        ? ""
        : pathForScope.slice("/collections/".length);
    return {
      raw,
      term: remainder.trim(),
      // Exact "/collections" still keeps the Routes hit; also browse collection entities.
      scope: lower === "/collections" ? "all" : "collections",
      browseProducts: false,
      browseCollections: true,
    };
  }

  // Prefer the locale-free path for label/href filtering when the query was prefixed.
  const term = pathForScope.startsWith("/") ? free : raw;
  return {
    raw,
    term,
    scope: "all",
    browseProducts: false,
    browseCollections: false,
  };
}

/** Extra app routes that are not CMS Page rows but remain valid storefront paths. */
const EXTRA_STATIC_ROUTE_HITS: StorefrontHrefHit[] = [
  {
    id: "route:cookie-settings",
    segment: "routes",
    label: "Cookie settings",
    href: "/cookie-settings",
    detail: "/cookie-settings",
  },
];

/** Built-in storefront routes shown in the Routes segment. */
export function listStaticRouteHits(): StorefrontHrefHit[] {
  const builtIn = BUILT_IN_PAGE_DEFINITIONS.map((page) => {
    const href = hrefForPage(page.slug);
    return {
      id: `route:${page.slug}`,
      segment: "routes" as const,
      label: page.title,
      href,
      detail: href,
    };
  });
  return [...builtIn, ...EXTRA_STATIC_ROUTE_HITS];
}

export function filterHitsByQuery(hits: StorefrontHrefHit[], query: string): StorefrontHrefHit[] {
  const raw = normalizeHrefQuery(query);
  if (!raw) return hits;
  const q = raw.toLowerCase();
  const freeQ = toLocaleFreeHref(raw).toLowerCase();
  return hits.filter((hit) => {
    const href = hit.href.toLowerCase();
    const detail = hit.detail.toLowerCase();
    const label = hit.label.toLowerCase();
    return (
      label.includes(q) ||
      href.includes(q) ||
      detail.includes(q) ||
      (freeQ !== q && (href.includes(freeQ) || detail.includes(freeQ) || label.includes(freeQ)))
    );
  });
}

/** Detail line for the picker when the editor locale is known (`/pt/shop`). */
export function hrefHitDetailForLocale(href: string, locale?: string, status?: string): string {
  const display = locale ? localePath(locale, toLocaleFreeHref(href) || href) : href;
  return formatHrefDetail(display, status);
}

/** Map hits so the detail/path preview reflects the active editor locale. */
export function withLocaleAwareHrefDetails(
  result: StorefrontHrefSearchResult,
  locale?: string,
): StorefrontHrefSearchResult {
  if (!locale) return result;
  return {
    segments: result.segments.map((segment) => ({
      ...segment,
      hits: segment.hits.map((hit) => ({
        ...hit,
        detail: hrefHitDetailForLocale(hit.href, locale, hit.status),
      })),
    })),
  };
}

export function formatHrefDetail(href: string, status?: string): string {
  if (!status || status === "PUBLISHED" || status === "ACTIVE") return href;
  return `${href} · ${status.toLowerCase()}`;
}

export function statusLabelForPage(status: string): string {
  return status;
}

export function statusLabelForProduct(status: string, visibility?: string): string {
  if (status === "ARCHIVED") return "ARCHIVED";
  if (status === "UNLISTED") return "UNLISTED";
  return status === "ACTIVE" && visibility === "PUBLIC" ? "PUBLISHED" : status === "ACTIVE" ? "ACTIVE" : "DRAFT";
}

export function statusLabelForCollection(status: string, visibility?: string): string {
  if (status === "ARCHIVED") return "ARCHIVED";
  return status === "ACTIVE" && visibility === "PUBLIC" ? "PUBLISHED" : status === "ACTIVE" ? "ACTIVE" : "DRAFT";
}

export function buildCustomPathHit(query: string): StorefrontHrefHit | null {
  const raw = normalizeHrefQuery(query);
  if (!looksLikePath(raw)) return null;
  // Persist locale-free paths even when the editor typed `/pt/…`.
  const href = toLocaleFreeHref(raw) || raw;
  return {
    id: `custom:${href}`,
    segment: "custom",
    label: "Use custom path",
    href,
    detail: href,
  };
}

export function assembleHrefSearchResult(parts: {
  routes?: StorefrontHrefHit[];
  pages?: StorefrontHrefHit[];
  collections?: StorefrontHrefHit[];
  products?: StorefrontHrefHit[];
  custom?: StorefrontHrefHit | null;
}): StorefrontHrefSearchResult {
  const segments: StorefrontHrefSearchResult["segments"] = [];

  const push = (id: Exclude<StorefrontHrefSegment, "custom">, hits: StorefrontHrefHit[] | undefined) => {
    if (!hits?.length) return;
    segments.push({ id, label: SEGMENT_LABELS[id], hits });
  };

  push("routes", parts.routes);
  push("pages", parts.pages);
  push("collections", parts.collections);
  push("products", parts.products);

  if (parts.custom) {
    segments.push({
      id: "custom",
      label: "Use custom path",
      hits: [parts.custom],
    });
  }

  return { segments };
}

/** Flat list of hits in display order — for keyboard navigation. */
export function flattenHrefHits(result: StorefrontHrefSearchResult): StorefrontHrefHit[] {
  return result.segments.flatMap((segment) => segment.hits);
}

function hrefKeysMatch(candidate: string, target: string): boolean {
  const a = normalizeHrefQuery(candidate);
  const b = normalizeHrefQuery(target);
  if (!a || !b) return false;
  if (a === b) return true;
  const freeA = toLocaleFreeHref(a);
  const freeB = toLocaleFreeHref(b);
  return Boolean(freeA && freeB && freeA === freeB);
}

export function hasExactHrefMatch(result: StorefrontHrefSearchResult, href: string): boolean {
  return flattenHrefHits(result).some(
    (hit) => hit.segment !== "custom" && hrefKeysMatch(hit.href, href),
  );
}

/** Soft warning copy when a CTA points at a non-live catalog/page target. */
export function hrefTargetWarning(status?: string): string | undefined {
  if (status === "DRAFT") {
    return "This link target is draft — not visible on the storefront until published.";
  }
  if (status === "UNLISTED") {
    return "This link target is unlisted — only reachable by direct link.";
  }
  return undefined;
}

/**
 * Warning or error when an admin href has no live target.
 * Missing internal paths surface as errors (page may have been deleted).
 */
export function hrefTargetIssueFromSearch(options: {
  href: string;
  hasExactHit: boolean;
  exactHitStatus?: string;
}): { tone: "warning" | "error"; message: string } | undefined {
  const href = normalizeHrefQuery(options.href);
  if (!href) return undefined;
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return undefined;

  if (options.hasExactHit) {
    const warning = hrefTargetWarning(options.exactHitStatus);
    return warning ? { tone: "warning", message: warning } : undefined;
  }

  // Locale-prefixed internals (`/pt/shop`) are real destinations when the
  // locale-free path matches a catalog/route hit — callers set hasExactHit.
  if (looksLikePath(href) && (href.startsWith("/") || toLocaleFreeHref(href).startsWith("/"))) {
    return {
      tone: "error",
      message:
        "This path leads nowhere — the page, product, or collection may have been deleted.",
    };
  }

  return undefined;
}

export function findExactHrefHit(
  result: StorefrontHrefSearchResult,
  href: string,
): StorefrontHrefHit | undefined {
  return flattenHrefHits(result).find(
    (hit) => hit.segment !== "custom" && hrefKeysMatch(hit.href, href),
  );
}

/** Normalize committed admin hrefs to the locale-free CMS contract. */
export function normalizeCommittedHref(href: string): string {
  return toLocaleFreeHref(normalizeHrefQuery(href));
}
