/**
 * Header main-link menu (label + path). Shared structure/hrefs; labels per locale.
 * Client-safe — server I/O lives in header-nav.ts.
 */

export const HEADER_NAV_KEY = "header-nav-v1";

/** Soft cap so the desktop header stays readable. */
export const MAX_HEADER_NAV_ITEMS = 8;
export const MIN_HEADER_NAV_ITEMS = 1;

export type HeaderNavItem = {
  id: string;
  /** Locale-free storefront path (shared across languages). */
  href: string;
};

export type HeaderNavData = {
  items: HeaderNavItem[];
  /** locale code → item id → label override (empty = use shipped default). */
  labels: Record<string, Record<string, string>>;
};

/** Shipped default menu — matches the historical hard-coded site header. */
export const DEFAULT_HEADER_NAV_ITEMS: HeaderNavItem[] = [
  { id: "home", href: "/" },
  { id: "shop", href: "/shop" },
  { id: "collections", href: "/collections" },
  { id: "about", href: "/about" },
];

/**
 * Default item ids map onto `messages/*.json` keys for empty-label fallback.
 * Custom rows (any other id) fall back to the path itself.
 */
export const DEFAULT_HEADER_NAV_LABEL_KEYS: Record<string, string> = {
  home: "nav.home",
  shop: "nav.shop",
  collections: "nav.collections",
  about: "nav.about",
};

/** Former storefront-copy keys for main links — cleared once header-nav owns them. */
export const LEGACY_HEADER_NAV_COPY_KEYS = [
  "nav.home",
  "nav.shop",
  "nav.collections",
  "nav.about",
] as const;

export type ResolvedHeaderNavItem = {
  id: string;
  href: string;
  label: string;
  /** Path used for aria-current matching (same as href). */
  match: string;
};

function trimPath(href: string): string {
  const trimmed = href.trim();
  if (!trimmed) return "";
  if (trimmed === "/") return "/";
  // Strip trailing slash except for root; keep query/hash out of admin paths.
  return trimmed.replace(/\/+$/, "") || "/";
}

export function normalizeHeaderNavItem(raw: { id?: unknown; href?: unknown }, index: number): HeaderNavItem | null {
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `item-${index + 1}`;
  const href = typeof raw.href === "string" ? trimPath(raw.href) : "";
  if (!href) return null;
  return { id, href };
}

export function parseHeaderNavData(value: unknown): HeaderNavData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const rawItems = Array.isArray(record.items) ? record.items : null;
  if (!rawItems) return null;

  const items: HeaderNavItem[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < rawItems.length && items.length < MAX_HEADER_NAV_ITEMS; i += 1) {
    const entry = rawItems[i];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const item = normalizeHeaderNavItem(entry as { id?: unknown; href?: unknown }, i);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  if (items.length < MIN_HEADER_NAV_ITEMS) return null;

  const labels: Record<string, Record<string, string>> = {};
  const rawLabels = record.labels;
  if (rawLabels && typeof rawLabels === "object" && !Array.isArray(rawLabels)) {
    for (const [locale, localeLabels] of Object.entries(rawLabels as Record<string, unknown>)) {
      if (!localeLabels || typeof localeLabels !== "object" || Array.isArray(localeLabels)) continue;
      const next: Record<string, string> = {};
      for (const [itemId, label] of Object.entries(localeLabels as Record<string, unknown>)) {
        if (typeof label !== "string") continue;
        const trimmed = label.trim();
        if (trimmed) next[itemId] = trimmed;
      }
      if (Object.keys(next).length > 0) labels[locale] = next;
    }
  }

  return { items, labels };
}

export function resolveHeaderNavLabel(
  item: HeaderNavItem,
  localeLabels: Record<string, string> | undefined,
  shippedMessages: Record<string, string>,
): string {
  const override = localeLabels?.[item.id]?.trim();
  if (override) return override;
  const messageKey = DEFAULT_HEADER_NAV_LABEL_KEYS[item.id];
  if (messageKey) {
    const shipped = shippedMessages[messageKey]?.trim();
    if (shipped) return shipped;
  }
  if (item.href === "/") return "Home";
  return item.href.replace(/^\//, "") || item.href;
}

export function resolveHeaderNav(
  data: HeaderNavData,
  locale: string,
  shippedMessages: Record<string, string>,
): ResolvedHeaderNavItem[] {
  const localeLabels = data.labels[locale];
  return data.items.map((item) => ({
    id: item.id,
    href: item.href,
    match: item.href,
    label: resolveHeaderNavLabel(item, localeLabels, shippedMessages),
  }));
}

export function createHeaderNavItemId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `nav-${crypto.randomUUID()}`;
  }
  return `nav-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
