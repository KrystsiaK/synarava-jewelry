import {
  mergeCustomMetafieldsIntoList,
} from "@/lib/shopify/product-metafields-shared";

/**
 * Object-level Shopify projection compare.
 *
 * Detection compares full Shopify-shaped JSON (denylist of technical noise only),
 * not a hand-maintained allowlist of commerce fields.
 */

export type ShopifyProjectionDiff = {
  path: string;
  field: string;
  local: string;
  shopify: string;
};

const TECHNICAL_KEYS = new Set([
  "pageInfo",
  "hasNextPage",
  "endCursor",
  "updatedAt",
  "__typename",
]);

const SHOPIFY_CDN_HOST_RE = /(^|\.)cdn\.shopify\.com$/i;

/** Human labels for known projection paths (Catalog Conflicts UI + scoped apply). */
const PATH_LABELS: Array<{ match: RegExp; label: string }> = [
  { match: /^title$/, label: "Name" },
  { match: /^handle$/, label: "Handle" },
  { match: /^descriptionHtml$/, label: "Description" },
  { match: /^category(\.id)?$/, label: "Product category" },
  { match: /^productType$/, label: "Product type" },
  { match: /^vendor$/, label: "Vendor" },
  { match: /^seo\.title$/, label: "SEO title" },
  { match: /^seo\.description$/, label: "SEO description" },
  { match: /^status$/, label: "Status" },
  { match: /^tags$/, label: "Tags" },
  { match: /^variants\[\d+\]\.sku$/, label: "Variant SKU" },
  { match: /^variants\[\d+\]\.price$/, label: "Price" },
  { match: /^variants\[\d+\]\.compareAtPrice$/, label: "Compare-at price" },
  { match: /^variants\[\d+\]\.taxable$/, label: "Charge tax" },
  { match: /^variants\[\d+\]\.inventoryQuantity$/, label: "Available quantity" },
  { match: /^variants\[\d+\]\.barcode$/, label: "Barcode" },
  { match: /^variants\[\d+\]\.inventoryPolicy$/, label: "Inventory policy" },
  { match: /^variants\[\d+\]\.inventoryItem\.unitCost/, label: "Cost" },
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeShopifyCdnUrl(value: string): string {
  try {
    const url = new URL(value);
    if (!SHOPIFY_CDN_HOST_RE.test(url.hostname)) return value;
    return `${url.origin}${url.pathname}`;
  } catch {
    return value;
  }
}

function shouldOmitKey(key: string, parentPath: string): boolean {
  if (TECHNICAL_KEYS.has(key)) return true;
  if (key === "status" && /(^|\.)media(\[\d+\])?$/.test(parentPath)) return true;
  // Ephemeral signed upload URL — not commerce identity; churns and dumps into conflict UI.
  // https://shopify.dev/docs/api/admin-graphql/latest/objects/mediaimage
  if (key === "originalSource" && /(^|\.)media(\[\d+\])?$/.test(parentPath)) return true;
  if (key === "definition" && /(^|\.)metafields(\[\d+\])?$/.test(parentPath)) return true;
  return false;
}

function sortKeyForArrayItem(item: unknown): string {
  if (!isPlainObject(item)) return JSON.stringify(item);
  if (typeof item.id === "string") return `id:${item.id}`;
  if (typeof item.sku === "string" && item.sku.trim()) return `sku:${item.sku.trim()}`;
  if (typeof item.namespace === "string" && typeof item.key === "string") {
    return `mf:${item.namespace}:${item.key}`;
  }
  if (typeof item.handle === "string") return `handle:${item.handle}`;
  return JSON.stringify(item);
}

/**
 * Strip technical noise and normalize volatile values so equality is commerce-meaningful.
 */
export function canonicalizeShopifyProjection(value: unknown, path = ""): unknown {
  if (value == null) return null;
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) return normalizeShopifyCdnUrl(value);
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    const mapped = value.map((item, index) =>
      canonicalizeShopifyProjection(item, `${path}[${index}]`),
    );
    // Set-like lists: stable order by identity so add/remove diffs are clean.
    if (path.endsWith("tags") && mapped.every((item) => typeof item === "string")) {
      return [...mapped].toSorted((a, b) => String(a).localeCompare(String(b)));
    }
    if (
      path.endsWith("variants")
      || path.endsWith("metafields")
      || path.endsWith("collections")
      || path.endsWith("media")
      || path.endsWith("publications")
    ) {
      return [...mapped].toSorted((a, b) => sortKeyForArrayItem(a).localeCompare(sortKeyForArrayItem(b)));
    }
    return mapped;
  }
  if (!isPlainObject(value)) return value;

  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).toSorted()) {
    if (shouldOmitKey(key, path)) continue;
    const childPath = path ? `${path}.${key}` : key;
    out[key] = canonicalizeShopifyProjection(value[key], childPath);
  }
  return out;
}

function displayValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || "—";
  }
  if (typeof value === "number") return String(value);
  return JSON.stringify(value);
}

/** Short label for a media node — never dump originalSource / full GraphQL JSON into conflict UI. */
function mediaItemSummary(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || "—";
  }
  if (!isPlainObject(value)) return displayValue(value);

  const preview = isPlainObject(value.preview) ? value.preview : null;
  const previewImage = preview && isPlainObject(preview.image) ? preview.image : null;
  const image = isPlainObject(value.image) ? value.image : null;
  const url =
    (previewImage && typeof previewImage.url === "string" ? previewImage.url : null)
    || (image && typeof image.url === "string" ? image.url : null)
    || (typeof value.url === "string" ? value.url : null);

  if (url) {
    try {
      const name = decodeURIComponent(new URL(url).pathname.split("/").pop() || url);
      return name || url;
    } catch {
      return url;
    }
  }
  if (typeof value.alt === "string" && value.alt.trim()) return value.alt.trim();
  if (typeof value.id === "string") return value.id;
  return "Image present";
}

function displayValueForPath(path: string, value: unknown): string {
  if (/^media\[\d+\]$/.test(path) || path === "media") {
    if (Array.isArray(value)) {
      if (value.length === 0) return "— (no images)";
      return value.map((item) => mediaItemSummary(item)).join(", ");
    }
    return mediaItemSummary(value);
  }
  if (/\.originalSource(\.|$)/.test(path)) return "— (upload source omitted)";
  return displayValue(value);
}

export function labelForShopifyProjectionPath(path: string): string {
  for (const entry of PATH_LABELS) {
    if (entry.match.test(path)) return entry.label;
  }
  if (path === "media" || path.startsWith("media.")) return "Media gallery";
  const mediaMatch = path.match(/^media\[(\d+)\]/);
  if (mediaMatch) {
    return `Media gallery (image ${Number(mediaMatch[1]) + 1})`;
  }
  // variants[0].sku → Variant SKU; generic fallback keeps path readable
  const variantMatch = path.match(/^variants\[(\d+)\]\.(.+)$/);
  if (variantMatch) {
    const rest = variantMatch[2];
    for (const entry of PATH_LABELS) {
      if (entry.match.test(`variants[0].${rest}`)) {
        return `${entry.label} (variant ${Number(variantMatch[1]) + 1})`;
      }
    }
  }
  return path;
}

function walkDiff(
  local: unknown,
  shopify: unknown,
  path: string,
  out: ShopifyProjectionDiff[],
): void {
  if (Object.is(local, shopify)) return;

  const localIsObj = isPlainObject(local);
  const shopifyIsObj = isPlainObject(shopify);
  const localIsArr = Array.isArray(local);
  const shopifyIsArr = Array.isArray(shopify);

  if (localIsObj && shopifyIsObj) {
    const keys = new Set([...Object.keys(local), ...Object.keys(shopify)]);
    for (const key of [...keys].toSorted()) {
      const child = path ? `${path}.${key}` : key;
      walkDiff(local[key], shopify[key], child, out);
    }
    return;
  }

  if (localIsArr && shopifyIsArr) {
    const max = Math.max(local.length, shopify.length);
    for (let i = 0; i < max; i += 1) {
      walkDiff(local[i], shopify[i], `${path}[${i}]`, out);
    }
    return;
  }

  out.push({
    path,
    field: labelForShopifyProjectionPath(path),
    local: displayValueForPath(path, local),
    shopify: displayValueForPath(path, shopify),
  });
}

/** Deep-diff two already-canonicalized (or raw — will canonicalize) projections. */
export function diffShopifyProjections(
  localProjection: unknown,
  shopifyProjection: unknown,
): ShopifyProjectionDiff[] {
  const left = canonicalizeShopifyProjection(localProjection);
  const right = canonicalizeShopifyProjection(shopifyProjection);
  const differences: ShopifyProjectionDiff[] = [];
  walkDiff(left, right, "", differences);
  return differences;
}

function parsePathSegments(path: string): Array<string | number> {
  const segments: Array<string | number> = [];
  const re = /([^[.\]]+)|\[(\d+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(path)) !== null) {
    if (match[1] != null) segments.push(match[1]);
    else segments.push(Number(match[2]));
  }
  return segments;
}

export function getProjectionPath(root: unknown, path: string): unknown {
  let cursor: unknown = root;
  for (const segment of parsePathSegments(path)) {
    if (cursor == null) return undefined;
    if (typeof segment === "number") {
      if (!Array.isArray(cursor)) return undefined;
      cursor = cursor[segment];
      continue;
    }
    if (!isPlainObject(cursor)) return undefined;
    cursor = cursor[segment];
  }
  return cursor;
}

/** Immutable set at a JSON path (`variants[0].taxable`). */
export function setProjectionPath(root: unknown, path: string, value: unknown): unknown {
  const segments = parsePathSegments(path);
  if (segments.length === 0) return value;

  const cloneLevel = (node: unknown, index: number): unknown => {
    const segment = segments[index];
    const isLast = index === segments.length - 1;
    if (typeof segment === "number") {
      const list = Array.isArray(node) ? [...node] : [];
      while (list.length <= segment) list.push(null);
      list[segment] = isLast ? value : cloneLevel(list[segment], index + 1);
      return list;
    }
    const obj = isPlainObject(node) ? { ...node } : {};
    obj[segment] = isLast ? value : cloneLevel(obj[segment], index + 1);
    return obj;
  };

  return cloneLevel(root, 0);
}

export function centsToShopifyAmount(cents: number): string {
  return (Math.round(cents) / 100).toFixed(2);
}

export type LocalCommerceProjectionPatch = {
  title?: string;
  handle?: string;
  vendor?: string | null;
  productType?: string | null;
  /** Shopify tag strings (same shape as Admin GraphQL `tags`). */
  tags?: string[];
  /** Merchant-owned product metafield values (excludes synarava / shopify / global). */
  customMetafields?: Array<{ namespace: string; key: string; type: string; value: string }>;
  /** Shopify-shaped media nodes (gallery write-through from ProductMedia). */
  media?: unknown[];
  variant?: {
    shopifyVariantId?: string | null;
    sku?: string;
    priceCents?: number;
    taxable?: boolean;
    inventoryQuantity?: number;
  };
};

/**
 * Write local editor commerce into the compare SoT (same Shopify-shaped paths).
 * Call on every local commerce save — detection is B/L/R on the projection, not Prisma columns.
 * Write-through updates L only; B stays until pull/push/resolve agrees.
 */
export function writeThroughLocalCommerceToProjection(
  snapshot: unknown,
  patch: LocalCommerceProjectionPatch,
): unknown {
  let next: unknown = snapshot ?? {};

  if (patch.title != null) next = setProjectionPath(next, "title", patch.title);
  if (patch.handle != null) next = setProjectionPath(next, "handle", patch.handle);
  if (patch.vendor !== undefined) next = setProjectionPath(next, "vendor", patch.vendor ?? "");
  if (patch.productType !== undefined) {
    next = setProjectionPath(next, "productType", patch.productType ?? "");
  }
  if (patch.tags !== undefined) {
    next = setProjectionPath(next, "tags", patch.tags);
  }

  if (patch.variant) {
    const variants = getProjectionPath(next, "variants");
    let index = 0;
    if (Array.isArray(variants) && patch.variant.shopifyVariantId) {
      const found = variants.findIndex(
        (item) => isPlainObject(item) && item.id === patch.variant!.shopifyVariantId,
      );
      if (found >= 0) index = found;
    }
    if (patch.variant.sku != null) {
      next = setProjectionPath(next, `variants[${index}].sku`, patch.variant.sku);
    }
    if (patch.variant.priceCents != null) {
      next = setProjectionPath(
        next,
        `variants[${index}].price`,
        centsToShopifyAmount(patch.variant.priceCents),
      );
    }
    if (patch.variant.taxable != null) {
      next = setProjectionPath(next, `variants[${index}].taxable`, patch.variant.taxable);
    }
    if (patch.variant.inventoryQuantity != null) {
      next = setProjectionPath(
        next,
        `variants[${index}].inventoryQuantity`,
        patch.variant.inventoryQuantity,
      );
    }
  }

  if (patch.customMetafields) {
    const existing = getProjectionPath(next, "metafields");
    next = setProjectionPath(
      next,
      "metafields",
      mergeCustomMetafieldsIntoList(existing, patch.customMetafields),
    );
  }

  if (patch.media !== undefined) {
    next = setProjectionPath(next, "media", patch.media);
  }

  return canonicalizeShopifyProjection(next);
}
