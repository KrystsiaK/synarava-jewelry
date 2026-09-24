import { BUILT_IN_PAGE_DEFINITIONS } from "@/lib/content/built-in-pages";

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
 */
export function parseHrefSearchQuery(query: string): ParsedHrefSearchQuery {
  const raw = normalizeHrefQuery(query);
  const lower = raw.toLowerCase();

  if (lower === "/products" || lower.startsWith("/products/")) {
    const remainder = lower === "/products" || lower === "/products/" ? "" : raw.slice("/products/".length);
    return {
      raw,
      term: remainder.trim(),
      scope: "products",
      browseProducts: true,
      browseCollections: false,
    };
  }

  if (lower === "/collections" || lower.startsWith("/collections/")) {
    const remainder = lower === "/collections" || lower === "/collections/" ? "" : raw.slice("/collections/".length);
    return {
      raw,
      term: remainder.trim(),
      // Exact "/collections" still keeps the Routes hit; also browse collection entities.
      scope: lower === "/collections" ? "all" : "collections",
      browseProducts: false,
      browseCollections: true,
    };
  }

  return {
    raw,
    term: raw,
    scope: "all",
    browseProducts: false,
    browseCollections: false,
  };
}

/** Built-in storefront routes shown in the Routes segment. */
export function listStaticRouteHits(): StorefrontHrefHit[] {
  return BUILT_IN_PAGE_DEFINITIONS.map((page) => {
    const href = hrefForPage(page.slug);
    return {
      id: `route:${page.slug}`,
      segment: "routes" as const,
      label: page.title,
      href,
      detail: href,
    };
  });
}

export function filterHitsByQuery(hits: StorefrontHrefHit[], query: string): StorefrontHrefHit[] {
  const q = normalizeHrefQuery(query).toLowerCase();
  if (!q) return hits;
  return hits.filter((hit) => {
    return (
      hit.label.toLowerCase().includes(q) ||
      hit.href.toLowerCase().includes(q) ||
      hit.detail.toLowerCase().includes(q)
    );
  });
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
  const href = normalizeHrefQuery(query);
  if (!looksLikePath(href)) return null;
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

export function hasExactHrefMatch(result: StorefrontHrefSearchResult, href: string): boolean {
  const target = normalizeHrefQuery(href);
  return flattenHrefHits(result).some((hit) => hit.href === target && hit.segment !== "custom");
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

export function findExactHrefHit(
  result: StorefrontHrefSearchResult,
  href: string,
): StorefrontHrefHit | undefined {
  const target = normalizeHrefQuery(href);
  return flattenHrefHits(result).find((hit) => hit.href === target && hit.segment !== "custom");
}
