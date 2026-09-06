import "server-only";

import { revalidatePath } from "next/cache";

import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";

/**
 * Revalidates a concrete storefront path (e.g. "/shop", "/products/oak-ring")
 * for every locale. Storefront pages live under app/[locale]/, so a bare
 * revalidatePath("/shop") call is a no-op — there is no route at that path.
 */
export function revalidateStorefrontPath(path: string) {
  for (const { code } of SUPPORTED_LOCALES) {
    revalidatePath(path === "/" ? `/${code}` : `/${code}${path}`);
  }
}

/**
 * Revalidates a dynamic storefront page template (e.g. "/products/[slug]")
 * for every locale, invalidating every rendered instance of that template
 * regardless of the dynamic segment's value.
 */
export function revalidateStorefrontTemplate(pattern: string) {
  for (const { code } of SUPPORTED_LOCALES) {
    revalidatePath(`/${code}${pattern}`, "page");
  }
}
