/**
 * Collection commerce windows — Shopify-shaped JSON for dual-store compare.
 * V1 fields: id, title, handle, descriptionHtml, seo.
 * Same canonicalize as products (detect = deep-diff after normalize).
 */

import {
  canonicalizeShopifyProjection,
  diffShopifyProjections,
} from "@/lib/shopify/shopify-projection-diff";

export type CollectionCommerceWindow = {
  id?: string | null;
  title?: string | null;
  handle?: string | null;
  descriptionHtml?: string | null;
  seo?: { title?: string | null; description?: string | null } | null;
};

export type CollectionLocalCommercePatch = {
  id?: string | null;
  title?: string | null;
  handle?: string | null;
  /** Plain-text admin description — mapped to descriptionHtml carefully. */
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function stripCollectionHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/** Escape + wrap plain description the same way linked Push sends to Shopify. */
export function plainDescriptionToHtml(description: string | null | undefined): string {
  const plain = (description ?? "").trim();
  if (!plain) return "";
  return `<p>${plain.replace(/[<>&]/g, "")}</p>`;
}

function setPath(root: unknown, path: string, value: unknown): unknown {
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  if (parts.length === 0) return value;
  const clone: Record<string, unknown> = isPlainObject(root) ? { ...root } : {};
  let cursor: Record<string, unknown> = clone;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i]!;
    const next = cursor[key];
    const child: Record<string, unknown> = isPlainObject(next) ? { ...next } : {};
    cursor[key] = child;
    cursor = child;
  }
  cursor[parts[parts.length - 1]!] = value;
  return clone;
}

function getPath(root: unknown, path: string): unknown {
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let cursor: unknown = root;
  for (const key of parts) {
    if (!isPlainObject(cursor)) return undefined;
    cursor = cursor[key];
  }
  return cursor;
}

/** Normalize once — before save into windows and before compare. */
export function normalizeCollectionCommerceWindow(value: unknown): unknown {
  return canonicalizeShopifyProjection(value);
}

/**
 * Write local editor fields into the compare SoT (Shopify-shaped paths).
 * Preserves existing descriptionHtml when its stripped text matches local description
 * (avoids false conflicts from wrap vs Shopify rich HTML).
 */
export function writeThroughLocalCollectionToProjection(
  snapshot: unknown,
  patch: CollectionLocalCommercePatch,
): unknown {
  let next: unknown = snapshot ?? {};

  if (patch.id != null) next = setPath(next, "id", patch.id);
  if (patch.title != null) next = setPath(next, "title", patch.title);
  if (patch.handle != null) next = setPath(next, "handle", patch.handle);

  if (patch.description !== undefined) {
    const plain = (patch.description ?? "").trim();
    const existingHtml = String(getPath(next, "descriptionHtml") ?? "");
    if (!plain) {
      next = setPath(next, "descriptionHtml", "");
    } else if (stripCollectionHtml(existingHtml) === plain) {
      // keep Shopify HTML shape
    } else {
      next = setPath(next, "descriptionHtml", plainDescriptionToHtml(plain));
    }
  }

  if (patch.seoTitle !== undefined) {
    next = setPath(next, "seo.title", patch.seoTitle ?? null);
  }
  if (patch.seoDescription !== undefined) {
    next = setPath(next, "seo.description", patch.seoDescription ?? null);
  }

  return normalizeCollectionCommerceWindow(next);
}

/** Build OUR window from Collection columns (+ optional Shopify base). */
export function buildCollectionWindowFromColumns(input: {
  shopifyCollectionId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  shopifySnapshot?: unknown;
}): unknown {
  return writeThroughLocalCollectionToProjection(input.shopifySnapshot ?? {}, {
    id: input.shopifyCollectionId ?? undefined,
    title: input.name,
    handle: input.slug,
    description: input.description,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
  });
}

/** Adopt a Shopify GraphQL collection node into a compare window. */
export function collectionWindowFromShopifyRemote(remote: {
  id: string;
  title: string;
  handle: string;
  descriptionHtml?: string | null;
  seo?: { title?: string | null; description?: string | null } | null;
}): unknown {
  return normalizeCollectionCommerceWindow({
    id: remote.id,
    title: remote.title,
    handle: remote.handle,
    descriptionHtml: remote.descriptionHtml ?? "",
    seo: {
      title: remote.seo?.title ?? null,
      description: remote.seo?.description ?? null,
    },
  });
}

export function collectionCommerceInputFromWindow(window: unknown): {
  title: string;
  handle: string;
  descriptionHtml: string;
  seo: { title?: string; description?: string };
} {
  const record = isPlainObject(window) ? window : {};
  const seo = isPlainObject(record.seo) ? record.seo : {};
  return {
    title: String(record.title ?? "").trim() || "Untitled",
    handle: String(record.handle ?? "").trim(),
    descriptionHtml: String(record.descriptionHtml ?? ""),
    seo: {
      title: typeof seo.title === "string" && seo.title.trim() ? seo.title : undefined,
      description: typeof seo.description === "string" && seo.description.trim()
        ? seo.description
        : undefined,
    },
  };
}

export function diffCollectionCommerceWindows(left: unknown, right: unknown) {
  return diffShopifyProjections(left, right);
}
