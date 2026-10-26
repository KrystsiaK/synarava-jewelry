/**
 * Collection commerce windows — Shopify-shaped JSON for dual-store compare.
 * V1 fields: id, title, handle, descriptionHtml, seo.
 * Same canonicalize as products (detect = deep-diff after normalize).
 * OUR window is derived via `deriveCollectionWindow` / `ourCollectionWindowFromRow` (ADR-0009).
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

/** Adopt a Shopify GraphQL collection node into a compare window. */
export function collectionWindowFromShopifyRemote(remote: {
  id: string;
  title: string;
  handle: string;
  descriptionHtml?: string | null;
  seo?: { title?: string | null; description?: string | null } | null;
}): unknown {
  return canonicalizeShopifyProjection({
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

/** Thin alias — Apply modules must not import diffShopifyProjections directly. */
export function diffCollectionCommerceWindows(left: unknown, right: unknown) {
  return diffShopifyProjections(left, right);
}

