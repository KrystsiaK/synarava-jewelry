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

/**
 * @deprecated Only used by `lib/shopify/products.ts`, an unused legacy
 * Storefront-API client superseded by the DB-backed catalog
 * (`lib/content/catalog.ts`). Kept so that dead file still compiles;
 * safe to delete both together.
 */
export const SHOP_DEPARTMENTS = [
  { slug: "jewelry", name: "Jewelry" },
  { slug: "pets", name: "Pets" },
  { slug: "kids", name: "Kids" },
  { slug: "jewelry-making", name: "Jewelry Making" },
] as const;

/** @deprecated See `SHOP_DEPARTMENTS`. */
export function isShopDepartmentSlug(value: unknown): value is ShopDepartmentSlug {
  return SHOP_DEPARTMENTS.some((department) => department.slug === value);
}

/** @deprecated See `SHOP_DEPARTMENTS`. */
export function shopDepartmentName(slug: ShopDepartmentSlug | null | undefined) {
  return SHOP_DEPARTMENTS.find((department) => department.slug === slug)?.name ?? "";
}

type InferrableProduct = {
  productType: string;
  title: string;
};

/**
 * @deprecated See `SHOP_DEPARTMENTS`. Classifies a Shopify product into a
 * shop department when Shopify's own `productType` doesn't already match
 * one of our department slugs exactly (the common case for a freshly
 * imported or miscategorized product).
 *
 * Falls back to keyword matching against `productType` + `title`, and
 * finally to "jewelry" — the storefront's largest and default department —
 * if nothing matches. That final fallback is a guess, not a classification,
 * so it's logged: a product with no department signal at all (e.g. a
 * non-English title with no matching keyword) will otherwise be silently
 * miscategorized with no trace of why.
 */
export function inferDepartment(product: InferrableProduct): ShopDepartmentSlug {
  const explicitType = product.productType.trim().toLowerCase();
  if (isShopDepartmentSlug(explicitType)) return explicitType;

  const searchable = `${product.productType} ${product.title}`.toLowerCase();
  if (/\b(leash|lead|collar|harness|pet|dog|cat)\b/.test(searchable)) return "pets";
  if (/\b(kid|kids|child|children|educational toy|developmental toy)\b/.test(searchable)) {
    return "kids";
  }
  if (/\b(bead|finding|cord|chain|jewelry making|jewellery making|craft tool|supply)\b/.test(searchable)) {
    return "jewelry-making";
  }

  console.warn(
    `[catalog] inferDepartment: no department signal for product type "${product.productType}", ` +
      `title "${product.title}" — defaulting to "jewelry".`,
  );
  return "jewelry";
}
