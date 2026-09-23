/**
 * Storefront catalog helpers that used to key off primary-nav "department"
 * collections. Department has been removed; these are jewelry-default constants
 * kept so call sites stay readable until any future product-kind signal exists.
 */

/** Fit-on-body film is shown for the jewelry storefront. */
export function hasFitFilm() {
  return true;
}

/** Compliance filters apply to finished jewelry on the single catalog. */
export function supportsComplianceFilters() {
  return true;
}
