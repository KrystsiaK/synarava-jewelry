import "server-only";

import { db } from "@/lib/db";
import { findLocalizedHandleRedirect } from "@/lib/content/handle-redirects";
import { localeLifecycleState } from "@/lib/i18n/storefront-locale-status";
import { localePath, stripLocalePrefix } from "@/lib/i18n/routing";
import type { StorefrontLocaleRecord } from "@/lib/i18n/storefront-locale-registry";

export type LocaleRequestDisposition =
  | { kind: "allow" }
  | { kind: "not-found" }
  | { kind: "redirect"; pathname: string; status: 301 };

/**
 * Decide how a request for a registered locale segment should be handled.
 * Draft (never live) → 404. Published → allow. Retired/Deleted → permanent
 * 301 to the default-language equivalent (ADR-0007 A3).
 */
export function dispositionForLocaleSegment(
  locale: Pick<StorefrontLocaleRecord, "status" | "deletedAt" | "isDefault">,
): "allow" | "not-found" | "redirect" {
  if (locale.isDefault) return "allow";
  const state = localeLifecycleState(locale);
  if (state === "published") return "allow";
  if (state === "retired" || state === "deleted") return "redirect";
  return "not-found";
}

async function resolveProductSourceSlug(locale: string, handle: string): Promise<string | null> {
  const byTranslation = await db.productTranslation.findFirst({
    where: {
      locale,
      OR: [{ localizedHandle: handle }, { product: { slug: handle } }],
    },
    select: { product: { select: { slug: true } } },
  });
  if (byTranslation?.product.slug) return byTranslation.product.slug;

  const redirect = await findLocalizedHandleRedirect("PRODUCT", locale, handle);
  if (redirect?.toHandle) {
    const viaRedirect = await db.product.findFirst({
      where: {
        OR: [
          { slug: redirect.toHandle },
          { translations: { some: { locale, localizedHandle: redirect.toHandle } } },
        ],
      },
      select: { slug: true },
    });
    if (viaRedirect?.slug) return viaRedirect.slug;
  }

  const bySlug = await db.product.findUnique({ where: { slug: handle }, select: { slug: true } });
  return bySlug?.slug ?? null;
}

async function resolveCollectionSourceSlug(locale: string, handle: string): Promise<string | null> {
  const byTranslation = await db.collectionTranslation.findFirst({
    where: {
      locale,
      OR: [{ localizedHandle: handle }, { collection: { slug: handle } }],
    },
    select: { collection: { select: { slug: true } } },
  });
  if (byTranslation?.collection.slug) return byTranslation.collection.slug;

  const redirect = await findLocalizedHandleRedirect("COLLECTION", locale, handle);
  if (redirect?.toHandle) {
    const viaRedirect = await db.collection.findFirst({
      where: {
        OR: [
          { slug: redirect.toHandle },
          { translations: { some: { locale, localizedHandle: redirect.toHandle } } },
        ],
      },
      select: { slug: true },
    });
    if (viaRedirect?.slug) return viaRedirect.slug;
  }

  const bySlug = await db.collection.findUnique({ where: { slug: handle }, select: { slug: true } });
  return bySlug?.slug ?? null;
}

async function resolvePageSourceSlug(locale: string, handle: string): Promise<string | null> {
  const byTranslation = await db.pageTranslation.findFirst({
    where: {
      locale,
      OR: [{ localizedHandle: handle }, { page: { slug: handle } }],
    },
    select: { page: { select: { slug: true } } },
  });
  if (byTranslation?.page.slug) return byTranslation.page.slug;

  const redirect = await findLocalizedHandleRedirect("PAGE", locale, handle);
  if (redirect?.toHandle) {
    const viaRedirect = await db.page.findFirst({
      where: {
        OR: [
          { slug: redirect.toHandle },
          { translations: { some: { locale, localizedHandle: redirect.toHandle } } },
        ],
      },
      select: { slug: true },
    });
    if (viaRedirect?.slug) return viaRedirect.slug;
  }

  const bySlug = await db.page.findUnique({ where: { slug: handle }, select: { slug: true } });
  return bySlug?.slug ?? null;
}

/**
 * Map a retired/deleted locale URL onto the default-language equivalent.
 * Falls back to the default home when no product/collection/page match exists.
 */
export async function buildDefaultLocaleRedirectPath(
  fromLocale: string,
  pathname: string,
  defaultSegment: string,
): Promise<string> {
  const rest = stripLocalePrefix(pathname);
  const productMatch = rest.match(/^\/products\/([^/]+)\/?$/);
  if (productMatch?.[1]) {
    const slug = await resolveProductSourceSlug(fromLocale, productMatch[1]);
    return slug ? localePath(defaultSegment, `/products/${slug}`) : localePath(defaultSegment, "/");
  }

  const collectionMatch = rest.match(/^\/collections\/([^/]+)\/?$/);
  if (collectionMatch?.[1]) {
    const slug = await resolveCollectionSourceSlug(fromLocale, collectionMatch[1]);
    return slug ? localePath(defaultSegment, `/collections/${slug}`) : localePath(defaultSegment, "/");
  }

  // Built-in paths (shop, about, …) and page slugs: swap locale; remap page handles when needed.
  const pageMatch = rest.match(/^\/([^/]+)\/?$/);
  if (pageMatch?.[1] && !["products", "collections", "shop", "cart", "checkout", "profile", "login", "register"].includes(pageMatch[1])) {
    const slug = await resolvePageSourceSlug(fromLocale, pageMatch[1]);
    if (slug) return localePath(defaultSegment, `/${slug}`);
  }

  return localePath(defaultSegment, rest === "" ? "/" : rest);
}

export async function resolveLocaleRequestDisposition(input: {
  localeSegment: string;
  pathname: string;
  locales: StorefrontLocaleRecord[];
}): Promise<LocaleRequestDisposition> {
  const locale = input.locales.find((entry) => entry.routeSegment === input.localeSegment);
  if (!locale) return { kind: "not-found" };

  const disposition = dispositionForLocaleSegment(locale);
  if (disposition === "allow") return { kind: "allow" };
  if (disposition === "not-found") return { kind: "not-found" };

  const defaultSegment =
    input.locales.find((entry) => entry.isDefault && !entry.deletedAt)?.routeSegment
    ?? input.locales.find((entry) => entry.status === "PUBLISHED")?.routeSegment
    ?? "en";

  const targetPath = await buildDefaultLocaleRedirectPath(
    locale.code,
    input.pathname,
    defaultSegment,
  );
  return { kind: "redirect", pathname: targetPath, status: 301 };
}
