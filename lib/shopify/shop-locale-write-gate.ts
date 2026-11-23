/**
 * Single gate for Synarava → Shopify translation writes.
 * Compare (leaf plan) and translationsRegister (race) share these helpers —
 * no second locale map; callers use registry `shopifyLocale` (MissingLocalePublication).
 */

export const ENABLE_IN_SHOPIFY_LABEL = "Enable in Shopify" as const;

export type ShopifyLocaleEnableOffer = {
  kind: "ENABLE_SHOPIFY_LOCALE";
  label: typeof ENABLE_IN_SHOPIFY_LABEL;
  /** Shopify Admin locale code (e.g. pt-PT), from registry shopifyLocale. */
  shopifyLocale: string;
};

/**
 * Factual blocked / invalid-locale reason — same string for leaf gate and
 * translationsRegister race mapping.
 * Example: `Shopify store example.myshopify.com has locales [en, fr]; Synarava tried to write 'pt-PT'.`
 */
export function shopLocaleWriteBlockedReason(input: {
  shopDomain: string;
  /** Locale codes as returned by Shopify `shopLocales` (preserve casing/order). */
  shopLocales: readonly string[];
  /** Shopify locale Synarava attempted to write (e.g. pt-PT). */
  triedLocale: string;
}): string {
  const domain = input.shopDomain.trim() || "unknown";
  const list = input.shopLocales.map((code) => code.trim()).filter(Boolean).join(", ");
  const tried = input.triedLocale.trim() || input.triedLocale;
  return `Shopify store ${domain} has locales [${list}]; Synarava tried to write '${tried}'.`;
}

/**
 * Factual reconcile warning when registry Shopify locales are absent from the shop.
 * Same shape as {@link shopLocaleWriteBlockedReason}; not a check failure.
 * Example: `Shopify store example.myshopify.com has locales [en, fr]; registry locales not in shop: [pt-PT]`.
 */
export function shopRegistryLocalesMissingWarning(input: {
  shopDomain: string;
  /** Locale codes as returned by Shopify `shopLocales` (preserve casing/order). */
  shopLocales: readonly string[];
  /** Registry `shopifyLocale` codes that are not enabled on the shop. */
  missingRegistryLocales: readonly string[];
}): string {
  const domain = input.shopDomain.trim() || "unknown";
  const list = input.shopLocales.map((code) => code.trim()).filter(Boolean).join(", ");
  const missing = input.missingRegistryLocales.map((code) => code.trim()).filter(Boolean).join(", ");
  return `Shopify store ${domain} has locales [${list}]; registry locales not in shop: [${missing}]`;
}

/** True when a reconcile run.error is only the languages-missing warning (no API failures). */
export function isLanguagesMissingReconcileWarning(error: string | null | undefined): boolean {
  if (!error) return false;
  return /registry locales not in shop:\s*\[[^\]]*\]/i.test(error)
    && !/\d+ checks? could not be completed/i.test(error);
}

/**
 * Split registry reconcile locales into shop-present (to check) vs missing (warn only).
 * Uses {@link isShopifyLocaleEnabled} — no second locale map.
 */
export function partitionReconcileLocalesForShop(input: {
  registryLocales: readonly string[];
  /** When null/undefined, do not filter (legacy / snapshot unavailable). */
  enabledShopifyLocales?: readonly string[] | null;
}): { checkLocales: string[]; missingLocales: string[] } {
  const enabled = input.enabledShopifyLocales;
  if (enabled == null) {
    return { checkLocales: [...input.registryLocales], missingLocales: [] };
  }
  const checkLocales: string[] = [];
  const missingLocales: string[] = [];
  for (const locale of input.registryLocales) {
    if (isShopifyLocaleEnabled(locale, enabled)) {
      checkLocales.push(locale);
    } else {
      missingLocales.push(locale);
    }
  }
  return { checkLocales, missingLocales };
}

/** True when Shopify userError means the locale is missing / not valid for the shop. */
export function isInvalidShopifyLocaleUserError(message: string): boolean {
  return /not a valid locale|locale is not enabled|not enabled on this shop|not a valid.*for the shop/i.test(
    message,
  );
}

/** Map a Shopify invalid-locale userError to the same factual reason as the leaf gate. */
export function mapInvalidShopifyLocaleError(
  message: string,
  context: {
    shopDomain: string;
    shopLocales: readonly string[];
    triedLocale: string;
  },
): string {
  if (isInvalidShopifyLocaleUserError(message)) {
    return shopLocaleWriteBlockedReason(context);
  }
  return message;
}

/** Case-insensitive membership in the shop's enabled `shopLocales`. */
export function isShopifyLocaleEnabled(
  shopifyLocale: string,
  enabledShopifyLocales: ReadonlySet<string> | readonly string[],
): boolean {
  const needle = shopifyLocale.trim().toLowerCase();
  const codes = Array.isArray(enabledShopifyLocales)
    ? enabledShopifyLocales
    : [...enabledShopifyLocales];
  return codes.some((code) => code.trim().toLowerCase() === needle);
}

/**
 * Plan whether Synarava → Shopify may run for this Shopify locale.
 */
export function planShopifyLocaleTranslationWrite(input: {
  shopifyLocale: string;
  /** When null/undefined, do not gate (legacy callers / tests without a shop snapshot). */
  enabledShopifyLocales?: readonly string[] | null;
  /** Shop myshopify domain for the factual blocked message. */
  shopDomain?: string | null;
  /** When true and locale missing, attach an Enable-in-Shopify offer (no automation). */
  canWriteLocales?: boolean;
}): {
  allowPush: boolean;
  blockedReason: string | null;
  enableOffer: ShopifyLocaleEnableOffer | null;
} {
  const enabled = input.enabledShopifyLocales;
  if (enabled == null) {
    return { allowPush: true, blockedReason: null, enableOffer: null };
  }

  if (isShopifyLocaleEnabled(input.shopifyLocale, enabled)) {
    return { allowPush: true, blockedReason: null, enableOffer: null };
  }

  const blockedReason = shopLocaleWriteBlockedReason({
    shopDomain: input.shopDomain ?? "unknown",
    shopLocales: enabled,
    triedLocale: input.shopifyLocale,
  });
  const enableOffer = input.canWriteLocales
    ? {
        kind: "ENABLE_SHOPIFY_LOCALE" as const,
        label: ENABLE_IN_SHOPIFY_LABEL,
        shopifyLocale: input.shopifyLocale,
      }
    : null;

  return { allowPush: false, blockedReason, enableOffer };
}
