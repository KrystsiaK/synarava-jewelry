import "server-only";

import { db } from "@/lib/db";
import {
  STOREFRONT_HREF_SEGMENT_LIMIT,
  assembleHrefSearchResult,
  buildCustomPathHit,
  filterHitsByQuery,
  formatHrefDetail,
  hasExactHrefMatch,
  hrefForCollection,
  hrefForPage,
  hrefForProduct,
  listStaticRouteHits,
  normalizeHrefQuery,
  parseHrefSearchQuery,
  statusLabelForCollection,
  statusLabelForPage,
  statusLabelForProduct,
  type StorefrontHrefHit,
  type StorefrontHrefSearchResult,
} from "@/lib/admin/storefront-href";

export type { StorefrontHrefHit, StorefrontHrefSearchResult } from "@/lib/admin/storefront-href";
export {
  hrefForCollection,
  hrefForPage,
  hrefForProduct,
  listStaticRouteHits,
  parseHrefSearchQuery,
} from "@/lib/admin/storefront-href";

function containsFilter(term: string) {
  return { contains: term, mode: "insensitive" as const };
}

export async function searchStorefrontHrefs(query: string): Promise<StorefrontHrefSearchResult> {
  const q = normalizeHrefQuery(query);
  const parsed = parseHrefSearchQuery(q);
  const routes = filterHitsByQuery(listStaticRouteHits(), q).slice(0, STOREFRONT_HREF_SEGMENT_LIMIT);

  if (!q) {
    return assembleHrefSearchResult({ routes });
  }

  const searchPages = parsed.scope === "all" && Boolean(parsed.term);
  const searchCollections =
    parsed.browseCollections || (parsed.scope === "all" && Boolean(parsed.term));
  const searchProducts =
    parsed.browseProducts || (parsed.scope === "all" && Boolean(parsed.term));

  const pagePromise = searchPages
    ? db.page.findMany({
        where: {
          status: { not: "ARCHIVED" },
          OR: [{ title: containsFilter(parsed.term) }, { slug: containsFilter(parsed.term) }],
        },
        select: { id: true, slug: true, title: true, status: true },
        orderBy: [{ title: "asc" }],
        take: STOREFRONT_HREF_SEGMENT_LIMIT,
      })
    : Promise.resolve([]);

  const collectionPromise = searchCollections
    ? db.collection.findMany({
        where: {
          status: { not: "ARCHIVED" },
          ...(parsed.term
            ? { OR: [{ name: containsFilter(parsed.term) }, { slug: containsFilter(parsed.term) }] }
            : {}),
        },
        select: { id: true, slug: true, name: true, status: true, visibility: true },
        orderBy: [{ name: "asc" }],
        take: STOREFRONT_HREF_SEGMENT_LIMIT,
      })
    : Promise.resolve([]);

  const productPromise = searchProducts
    ? db.product.findMany({
        where: {
          status: { not: "ARCHIVED" },
          ...(parsed.term
            ? {
                OR: [
                  { name: containsFilter(parsed.term) },
                  { slug: containsFilter(parsed.term) },
                  { sku: containsFilter(parsed.term) },
                ],
              }
            : {}),
        },
        select: { id: true, slug: true, name: true, status: true, visibility: true },
        orderBy: [{ name: "asc" }],
        take: STOREFRONT_HREF_SEGMENT_LIMIT,
      })
    : Promise.resolve([]);

  const [pages, collections, products] = await Promise.all([
    pagePromise,
    collectionPromise,
    productPromise,
  ]);

  const pageHits: StorefrontHrefHit[] = pages.map((page) => {
    const href = hrefForPage(page.slug);
    const status = statusLabelForPage(page.status);
    return {
      id: `page:${page.id}`,
      segment: "pages",
      label: page.title,
      href,
      status,
      detail: formatHrefDetail(href, status),
    };
  });

  const collectionHits: StorefrontHrefHit[] = collections.map((collection) => {
    const href = hrefForCollection(collection.slug);
    const status = statusLabelForCollection(collection.status, collection.visibility);
    return {
      id: `collection:${collection.id}`,
      segment: "collections",
      label: collection.name,
      href,
      status,
      detail: formatHrefDetail(href, status),
    };
  });

  const productHits: StorefrontHrefHit[] = products.map((product) => {
    const href = hrefForProduct(product.slug);
    const status = statusLabelForProduct(product.status, product.visibility);
    return {
      id: `product:${product.id}`,
      segment: "products",
      label: product.name,
      href,
      status,
      detail: formatHrefDetail(href, status),
    };
  });

  const assembledWithoutCustom = assembleHrefSearchResult({
    routes,
    pages: pageHits,
    collections: collectionHits,
    products: productHits,
  });

  const custom =
    !hasExactHrefMatch(assembledWithoutCustom, q) ? buildCustomPathHit(q) : null;

  return assembleHrefSearchResult({
    routes,
    pages: pageHits,
    collections: collectionHits,
    products: productHits,
    custom,
  });
}
