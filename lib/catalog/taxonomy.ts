/**
 * A department is a Shopify-backed `Collection` marked `isPrimaryNav` —
 * see `getStorefrontNavigation()` in `lib/content/catalog.ts`. This alias
 * keeps the semantic name at call sites even though the value is now a
 * free-form collection slug rather than a fixed enum.
 */
export type ShopDepartmentSlug = string;

/**
 * The camelCase i18n key suffix for a department slug — translation keys
 * can't contain hyphens, so "jewelry-making" is looked up as
 * `shop.jewelryMaking` rather than `shop.jewelry-making`.
 */
export function shopDepartmentTranslationKey(slug: ShopDepartmentSlug) {
  return slug === "jewelry-making" ? "jewelryMaking" : slug;
}

/**
 * Only the four original departments have translated nav labels
 * (`shop.jewelry`, `shop.pets`, `shop.kids`, `shop.jewelryMaking`).
 * A primary-nav collection added later through the admin falls back to
 * its own `name` at call sites instead of a missing translation key.
 */
const TRANSLATED_DEPARTMENT_SLUGS = new Set(["jewelry", "pets", "kids", "jewelry-making"]);

export function hasDepartmentTranslation(slug: string | null | undefined) {
  return Boolean(slug) && TRANSLATED_DEPARTMENT_SLUGS.has(slug!);
}

/**
 * Whether `slug` is the jewelry department — treating "no department
 * selected" (the shop's default, unfiltered view) as jewelry too, since
 * jewelry is the largest department and the one shown by default.
 */
export function isJewelryDepartment(slug: string | null | undefined) {
  return !slug || slug === "jewelry";
}

/**
 * Compliance/certification filters (REACH, lead-free, cadmium-free,
 * nickel-free) describe finished jewelry, not raw jewelry-making supplies —
 * they apply to every department except jewelry-making.
 */
export function supportsComplianceFilters(slug: string | null | undefined) {
  return slug !== "jewelry-making";
}

/** Only the jewelry department has a fit-on-body film; other departments show a plain process film instead. */
export function hasFitFilm(slug: string | null | undefined) {
  return slug === "jewelry";
}
