import "server-only";

import { shopifyAdminRequest, type ShopifyShopLocale } from "@/lib/shopify/admin";

export const WRITE_LOCALES_SCOPE = "write_locales";

export async function fetchGrantedShopifyScopes(): Promise<string[]> {
  const data = await shopifyAdminRequest<{
    currentAppInstallation: { accessScopes: Array<{ handle: string }> };
  }>(`query SynaravaAccessScopes {
    currentAppInstallation { accessScopes { handle } }
  }`);
  return data.currentAppInstallation.accessScopes.map((scope) => scope.handle);
}

export async function hasWriteLocalesScope(): Promise<boolean> {
  const scopes = await fetchGrantedShopifyScopes();
  return scopes.includes(WRITE_LOCALES_SCOPE);
}

type LocaleMutationErrors = { userErrors: Array<{ field?: string[] | null; message: string }> };

function throwUserErrors(errors: Array<{ message: string }>, action: string) {
  if (errors.length === 0) return;
  throw new Error(`${action} failed: ${errors.map((error) => error.message).join("; ")}`);
}

/** Enable a shop locale (unpublished). Idempotent when already enabled. */
export async function shopLocaleEnable(locale: string): Promise<ShopifyShopLocale> {
  const data = await shopifyAdminRequest<{
    shopLocaleEnable: LocaleMutationErrors & { shopLocale: ShopifyShopLocale | null };
  }>(
    `mutation SynaravaShopLocaleEnable($locale: String!) {
      shopLocaleEnable(locale: $locale) {
        userErrors { field message }
        shopLocale { locale name primary published }
      }
    }`,
    { locale },
  );
  const already = data.shopLocaleEnable.userErrors.some((error) =>
    /already|enabled/i.test(error.message),
  );
  if (data.shopLocaleEnable.userErrors.length && !already) {
    throwUserErrors(data.shopLocaleEnable.userErrors, "shopLocaleEnable");
  }
  if (data.shopLocaleEnable.shopLocale) return data.shopLocaleEnable.shopLocale;
  // Already enabled — read current state.
  const locales = await shopifyAdminRequest<{ shopLocales: ShopifyShopLocale[] }>(
    `query SynaravaShopLocalesAfterEnable { shopLocales { locale name primary published } }`,
  );
  const match = locales.shopLocales.find((entry) => entry.locale.toLowerCase() === locale.toLowerCase());
  if (!match) throw new Error(`Locale "${locale}" was not found after enable.`);
  return match;
}

/** Publish or unpublish a shop locale. Idempotent for the requested published flag. */
export async function shopLocaleUpdate(locale: string, published: boolean): Promise<ShopifyShopLocale> {
  const data = await shopifyAdminRequest<{
    shopLocaleUpdate: LocaleMutationErrors & { shopLocale: ShopifyShopLocale | null };
  }>(
    `mutation SynaravaShopLocaleUpdate($locale: String!, $shopLocale: ShopLocaleInput!) {
      shopLocaleUpdate(locale: $locale, shopLocale: $shopLocale) {
        userErrors { field message }
        shopLocale { locale name primary published }
      }
    }`,
    { locale, shopLocale: { published } },
  );
  throwUserErrors(data.shopLocaleUpdate.userErrors, "shopLocaleUpdate");
  if (!data.shopLocaleUpdate.shopLocale) {
    throw new Error(`shopLocaleUpdate returned no locale for "${locale}".`);
  }
  return data.shopLocaleUpdate.shopLocale;
}

/** Disable (delete) a shop locale and its Shopify translations. */
export async function shopLocaleDisable(locale: string): Promise<string> {
  const data = await shopifyAdminRequest<{
    shopLocaleDisable: LocaleMutationErrors & { locale: string | null };
  }>(
    `mutation SynaravaShopLocaleDisable($locale: String!) {
      shopLocaleDisable(locale: $locale) {
        userErrors { field message }
        locale
      }
    }`,
    { locale },
  );
  const already = data.shopLocaleDisable.userErrors.some((error) =>
    /not found|disabled|does not exist/i.test(error.message),
  );
  if (data.shopLocaleDisable.userErrors.length && !already) {
    throwUserErrors(data.shopLocaleDisable.userErrors, "shopLocaleDisable");
  }
  return data.shopLocaleDisable.locale ?? locale;
}
