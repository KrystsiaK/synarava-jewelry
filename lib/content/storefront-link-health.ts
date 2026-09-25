import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";
import {
  hrefForCollection,
  hrefForPage,
  hrefForProduct,
  listStaticRouteHits,
  normalizeHrefQuery,
} from "@/lib/admin/storefront-href";
import {
  EXTRA_LIVE_STOREFRONT_PATHS,
  classifyHrefWithoutLookup,
  isStorefrontVisibleHealth,
  type StorefrontHrefHealth,
} from "@/lib/content/storefront-href-health-fields";

export {
  isStorefrontVisibleHealth,
  type StorefrontHrefHealth,
} from "@/lib/content/storefront-href-health-fields";

// Re-export admin issue helper so storefront callers can share the copy.
export { hrefTargetIssueFromSearch as hrefTargetIssue } from "@/lib/admin/storefront-href";

type CatalogIndex = {
  routes: Set<string>;
  pages: Map<string, string>;
  products: Map<string, { status: string; visibility: string }>;
  collections: Map<string, { status: string; visibility: string }>;
};

const loadCatalogIndex = cache(async (): Promise<CatalogIndex> => {
  const routes = new Set(listStaticRouteHits().map((hit) => hit.href));
  for (const path of EXTRA_LIVE_STOREFRONT_PATHS) routes.add(path);

  const [pages, products, collections] = await Promise.all([
    db.page.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: { slug: true, status: true },
    }),
    db.product.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: { slug: true, status: true, visibility: true },
    }),
    db.collection.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: { slug: true, status: true, visibility: true },
    }),
  ]);

  return {
    routes,
    pages: new Map(pages.map((page) => [hrefForPage(page.slug), page.status])),
    products: new Map(
      products.map((product) => [
        hrefForProduct(product.slug),
        { status: product.status, visibility: product.visibility },
      ]),
    ),
    collections: new Map(
      collections.map((collection) => [
        hrefForCollection(collection.slug),
        { status: collection.status, visibility: collection.visibility },
      ]),
    ),
  };
});

function normalizeInternalPath(href: string): string {
  const trimmed = normalizeHrefQuery(href);
  if (!trimmed || trimmed === "/") return trimmed;
  return trimmed.replace(/\/+$/, "") || "/";
}

function healthFromIndex(href: string, index: CatalogIndex): StorefrontHrefHealth {
  const quick = classifyHrefWithoutLookup(href);
  if (quick) return quick;

  const path = normalizeInternalPath(href);
  if (!path.startsWith("/")) return "missing";

  if (index.routes.has(path)) return "live";

  const pageStatus = index.pages.get(path);
  if (pageStatus) {
    if (pageStatus === "DRAFT") return "draft";
    return "live";
  }

  const product = index.products.get(path);
  if (product) {
    if (product.status === "DRAFT") return "draft";
    if (product.status === "UNLISTED" || product.visibility !== "PUBLIC") return "unlisted";
    return "live";
  }

  const collection = index.collections.get(path);
  if (collection) {
    if (collection.status === "DRAFT") return "draft";
    if (collection.visibility !== "PUBLIC") return "unlisted";
    return "live";
  }

  return "missing";
}

export async function classifyStorefrontHref(href: string): Promise<StorefrontHrefHealth> {
  const index = await loadCatalogIndex();
  return healthFromIndex(href, index);
}

export async function classifyStorefrontHrefs(
  hrefs: Iterable<string>,
): Promise<Map<string, StorefrontHrefHealth>> {
  const index = await loadCatalogIndex();
  const result = new Map<string, StorefrontHrefHealth>();
  for (const href of hrefs) {
    result.set(href, healthFromIndex(href, index));
  }
  return result;
}

/** Drop missing/draft/empty targets from a list of `{ href }` items for storefront view. */
export async function filterLiveLinkItems<T extends { href: string }>(items: T[]): Promise<T[]> {
  if (items.length === 0) return items;
  const health = await classifyStorefrontHrefs(items.map((item) => item.href));
  return items.filter((item) => isStorefrontVisibleHealth(health.get(item.href) ?? "missing"));
}

/** Filter header-nav items so deleted destinations disappear from the storefront. */
export async function filterLiveHeaderNav<T extends { items: Array<{ href: string }> }>(
  data: T,
): Promise<T> {
  const items = await filterLiveLinkItems(data.items);
  return { ...data, items };
}

/** Filter all footer link columns for storefront visibility. */
export async function filterLiveFooterLinks<
  T extends {
    service: { items: Array<{ href: string }> };
    legal: { items: Array<{ href: string }> };
    socials: { items: Array<{ href: string }> };
  },
>(data: T): Promise<T> {
  const [serviceItems, legalItems, socialItems] = await Promise.all([
    filterLiveLinkItems(data.service.items),
    filterLiveLinkItems(data.legal.items),
    filterLiveLinkItems(data.socials.items),
  ]);
  return {
    ...data,
    service: { ...data.service, items: serviceItems },
    legal: { ...data.legal, items: legalItems },
    socials: { ...data.socials, items: socialItems },
  };
}
