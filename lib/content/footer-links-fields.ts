/**
 * Footer link columns (service, legal, socials) — label + path, add/remove/reorder.
 * Client-safe. Server I/O lives in footer-links.ts.
 * Navigation column still mirrors header-nav-v1.
 */

export const FOOTER_LINKS_KEY = "footer-links-v1";

export const MAX_FOOTER_LINK_ITEMS = 16;
export const MIN_FOOTER_SERVICE_ITEMS = 0;
export const MIN_FOOTER_LEGAL_ITEMS = 0;
export const MIN_FOOTER_SOCIAL_ITEMS = 0;

export type FooterLinkItem = {
  id: string;
  /** Locale-free storefront path or absolute http(s) URL. */
  href: string;
};

export type FooterLinkColumn = {
  items: FooterLinkItem[];
  /** locale code → item id → label override (empty = shipped default or path). */
  labels: Record<string, Record<string, string>>;
};

export type FooterLinksData = {
  service: FooterLinkColumn;
  legal: FooterLinkColumn;
  socials: FooterLinkColumn;
};

export type FooterLinkColumnId = keyof FooterLinksData;

/** Shipped service column — matches historical hard-coded footer. */
export const DEFAULT_FOOTER_SERVICE_ITEMS: FooterLinkItem[] = [
  { id: "care", href: "/care" },
  { id: "shipping", href: "/shipping" },
  { id: "returns", href: "/returns" },
  { id: "faq", href: "/faq" },
];

export const DEFAULT_FOOTER_SERVICE_LABEL_KEYS: Record<string, string> = {
  care: "footer.careGuide",
  shipping: "footer.shipping",
  returns: "footer.returns",
  faq: "footer.faq",
};

/** Shipped legal row — matches historical hard-coded footer. */
export const DEFAULT_FOOTER_LEGAL_ITEMS: FooterLinkItem[] = [
  { id: "terms", href: "/terms-and-conditions" },
  { id: "privacy", href: "/privacy" },
  { id: "cookies", href: "/cookie-settings" },
  { id: "shipping-policy", href: "/shipping" },
  { id: "return-policy", href: "/returns" },
  { id: "legal-notice", href: "/legal-notice" },
  { id: "livro", href: "https://www.livroreclamacoes.pt/" },
  { id: "dispute", href: "/dispute-resolution" },
];

export const DEFAULT_FOOTER_LEGAL_LABEL_KEYS: Record<string, string> = {
  terms: "footer.termsConditions",
  privacy: "footer.privacyPolicy",
  cookies: "footer.cookieSettings",
  "shipping-policy": "footer.shippingPolicy",
  "return-policy": "footer.returnPolicy",
  "legal-notice": "footer.legalNotice",
  livro: "footer.livroReclamacoes",
  dispute: "footer.disputeResolution",
};

/** Former storefront-copy keys owned by footer-links-v1 once migrated. */
export const LEGACY_FOOTER_SERVICE_COPY_KEYS = [
  "footer.careGuide",
  "footer.shipping",
  "footer.returns",
  "footer.faq",
] as const;

export const LEGACY_FOOTER_LEGAL_COPY_KEYS = [
  "footer.termsConditions",
  "footer.privacyPolicy",
  "footer.cookieSettings",
  "footer.shippingPolicy",
  "footer.returnPolicy",
  "footer.legalNotice",
  "footer.livroReclamacoes",
  "footer.disputeResolution",
] as const;

export type ResolvedFooterLink = {
  id: string;
  href: string;
  label: string;
  external: boolean;
};

function trimHref(href: string): string {
  const trimmed = href.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, "") || trimmed;
  if (trimmed === "/") return "/";
  return trimmed.replace(/\/+$/, "") || "/";
}

export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href.trim());
}

export function normalizeFooterLinkItem(
  raw: { id?: unknown; href?: unknown },
  index: number,
): FooterLinkItem | null {
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `item-${index + 1}`;
  const href = typeof raw.href === "string" ? trimHref(raw.href) : "";
  if (!href) return null;
  return { id, href };
}

function parseColumn(
  value: unknown,
  maxItems: number,
  minItems: number,
): FooterLinkColumn | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const rawItems = Array.isArray(record.items) ? record.items : null;
  if (!rawItems) return null;

  const items: FooterLinkItem[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < rawItems.length && items.length < maxItems; i += 1) {
    const entry = rawItems[i];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const item = normalizeFooterLinkItem(entry as { id?: unknown; href?: unknown }, i);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  if (items.length < minItems) return null;

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

export function parseFooterLinksData(value: unknown): FooterLinksData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const service = parseColumn(record.service, MAX_FOOTER_LINK_ITEMS, MIN_FOOTER_SERVICE_ITEMS);
  const legal = parseColumn(record.legal, MAX_FOOTER_LINK_ITEMS, MIN_FOOTER_LEGAL_ITEMS);
  const socials = parseColumn(record.socials, MAX_FOOTER_LINK_ITEMS, MIN_FOOTER_SOCIAL_ITEMS);
  if (!service || !legal || !socials) return null;
  return { service, legal, socials };
}

export function emptyFooterLinkColumn(items: FooterLinkItem[] = []): FooterLinkColumn {
  return { items: items.map((item) => ({ ...item })), labels: {} };
}

export function defaultFooterLinks(
  labels: {
    service?: Record<string, Record<string, string>>;
    legal?: Record<string, Record<string, string>>;
  } = {},
): FooterLinksData {
  return {
    service: {
      items: DEFAULT_FOOTER_SERVICE_ITEMS.map((item) => ({ ...item })),
      labels: labels.service ?? {},
    },
    legal: {
      items: DEFAULT_FOOTER_LEGAL_ITEMS.map((item) => ({ ...item })),
      labels: labels.legal ?? {},
    },
    socials: emptyFooterLinkColumn(),
  };
}

export function resolveFooterLinkLabel(
  item: FooterLinkItem,
  localeLabels: Record<string, string> | undefined,
  shippedMessages: Record<string, string>,
  defaultLabelKeys: Record<string, string>,
): string {
  const override = localeLabels?.[item.id]?.trim();
  if (override) return override;
  const messageKey = defaultLabelKeys[item.id];
  if (messageKey) {
    const shipped = shippedMessages[messageKey]?.trim();
    if (shipped) return shipped;
  }
  if (isExternalHref(item.href)) {
    try {
      return new URL(item.href).hostname.replace(/^www\./, "");
    } catch {
      return item.href;
    }
  }
  if (item.href === "/") return "Home";
  return item.href.replace(/^\//, "") || item.href;
}

export function resolveFooterLinkColumn(
  column: FooterLinkColumn,
  locale: string,
  shippedMessages: Record<string, string>,
  defaultLabelKeys: Record<string, string>,
): ResolvedFooterLink[] {
  const localeLabels = column.labels[locale];
  return column.items.map((item) => ({
    id: item.id,
    href: item.href,
    external: isExternalHref(item.href),
    label: resolveFooterLinkLabel(item, localeLabels, shippedMessages, defaultLabelKeys),
  }));
}

export function createFooterLinkItemId(prefix = "footer"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function cleanFooterLinkColumn(next: FooterLinkColumn): FooterLinkColumn {
  const items: FooterLinkItem[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < next.items.length; index += 1) {
    if (items.length >= MAX_FOOTER_LINK_ITEMS) break;
    const item = normalizeFooterLinkItem(next.items[index], index);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }

  const validIds = new Set(items.map((item) => item.id));
  const labels: Record<string, Record<string, string>> = {};
  for (const [locale, localeLabels] of Object.entries(next.labels)) {
    const cleaned: Record<string, string> = {};
    for (const [itemId, label] of Object.entries(localeLabels)) {
      if (!validIds.has(itemId)) continue;
      const trimmed = label.trim();
      if (trimmed) cleaned[itemId] = trimmed;
    }
    if (Object.keys(cleaned).length > 0) labels[locale] = cleaned;
  }

  return { items, labels };
}
