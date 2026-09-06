export const SHOP_DEPARTMENTS = [
  { slug: "jewelry", name: "Jewelry" },
  { slug: "pets", name: "Pets" },
  { slug: "kids", name: "Kids" },
  { slug: "jewelry-making", name: "Jewelry Making" },
] as const;

export type ShopDepartmentSlug = (typeof SHOP_DEPARTMENTS)[number]["slug"];

export function isShopDepartmentSlug(value: unknown): value is ShopDepartmentSlug {
  return SHOP_DEPARTMENTS.some((department) => department.slug === value);
}

export function shopDepartmentName(slug: ShopDepartmentSlug | null | undefined) {
  return SHOP_DEPARTMENTS.find((department) => department.slug === slug)?.name ?? "";
}

/**
 * The camelCase i18n key suffix for a department slug — translation keys
 * can't contain hyphens, so "jewelry-making" is looked up as
 * `shop.jewelryMaking` rather than `shop.jewelry-making`.
 */
export function shopDepartmentTranslationKey(slug: ShopDepartmentSlug) {
  return slug === "jewelry-making" ? "jewelryMaking" : slug;
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

type InferrableProduct = {
  productType: string;
  title: string;
};

/**
 * Classifies a Shopify product into a shop department when Shopify's own
 * `productType` doesn't already match one of our department slugs exactly
 * (the common case for a freshly-imported or miscategorized product).
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
