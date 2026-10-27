import "server-only";

import { revalidatePath } from "next/cache";

import { getRegisteredRouteSegments } from "@/lib/i18n/registered-route-segments";

/**
 * Revalidates a concrete storefront path (e.g. "/shop", "/products/oak-ring")
 * for every registered locale. Storefront pages live under app/[locale]/, so a
 * bare revalidatePath("/shop") call is a no-op — there is no route at that path.
 * Segment list comes from the registry snapshot (ADR-0007), not a hardcoded list.
 *
 * Pass type "layout" for locale roots (`"/"`) when the app root layout must
 * refresh too (e.g. header cart badge in `app/layout.tsx`).
 */
export function revalidateStorefrontPath(path: string, type?: "page" | "layout") {
  for (const code of getRegisteredRouteSegments()) {
    const localePath = path === "/" ? `/${code}` : `/${code}${path}`;
    if (type) {
      revalidatePath(localePath, type);
    } else {
      revalidatePath(localePath);
    }
  }
  if (path === "/" && type === "layout") {
    revalidatePath("/", "layout");
  }
}

/**
 * Revalidates a dynamic storefront page template (e.g. "/products/[slug]")
 * for every registered locale, invalidating every rendered instance of that
 * template regardless of the dynamic segment's value.
 */
export function revalidateStorefrontTemplate(pattern: string) {
  for (const code of getRegisteredRouteSegments()) {
    revalidatePath(`/${code}${pattern}`, "page");
  }
}

/** Common admin/storefront cache refresh after catalog writes. */
export function revalidateStorefront() {
  revalidateStorefrontPath("/");
  revalidateStorefrontPath("/shop");
  revalidateStorefrontPath("/collections");
  revalidateStorefrontTemplate("/collections/[slug]");
  revalidateStorefrontTemplate("/products/[slug]");
  revalidateStorefrontPath("/about");
}
