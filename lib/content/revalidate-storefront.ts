import "server-only";

import { revalidatePath } from "next/cache";

import { getRegisteredRouteSegments } from "@/lib/i18n/registered-route-segments";

/**
 * Revalidates a concrete storefront path (e.g. "/shop", "/products/oak-ring")
 * for every registered locale. Storefront pages live under app/[locale]/, so a
 * bare revalidatePath("/shop") call is a no-op — there is no route at that path.
 * Segment list comes from the registry snapshot (ADR-0007), not a hardcoded list.
 */
export function revalidateStorefrontPath(path: string) {
  for (const code of getRegisteredRouteSegments()) {
    revalidatePath(path === "/" ? `/${code}` : `/${code}${path}`);
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
