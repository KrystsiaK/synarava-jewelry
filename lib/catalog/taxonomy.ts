/**
 * Storefront catalog helpers that used to key off primary-nav "department"
 * collections. Department has been removed; these are jewelry-default constants
 * kept so call sites stay readable until any future product-kind signal exists.
 */

/** Fit-on-body film is shown for the jewelry storefront. */
export function hasFitFilm() {
  return true;
}

/**
 * Compliance boolean facets (REACH / lead-free / …) are passport data, not a
 * shop browse dimension Kiryl wants on the storefront. Keep the query param
 * and where-clause for deep links; hide the filter chrome.
 */
export function supportsComplianceFilters() {
  return false;
}

/**
 * Product tags in this catalog are operational (SKU-like) and have no locale
 * surface. Hide the tag facet; cards also filter via `buyerFacingTagNames`.
 */
export function supportsTagFilters() {
  return false;
}
