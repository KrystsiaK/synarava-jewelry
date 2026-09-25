/**
 * Temporary gate: product create/edit in admin is paused while the catalog
 * list is Shopify-primary sync only. Storefront, pickers, and collections
 * keep reading the Prisma projection — do not delete product APIs.
 *
 * Flip to `true` to restore the full Catalog authoring UI.
 */
export const ADMIN_PRODUCT_AUTHORING_ENABLED = false;

export function isAdminProductAuthoringEnabled(): boolean {
  return ADMIN_PRODUCT_AUTHORING_ENABLED;
}
