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

/** Human reason when a content locale cannot be pushed to Shopify. */
export function shopLocaleNotEnabledReason(displayCode: string): string {
  const code = displayCode.trim().toUpperCase();
  return `${code} is not enabled in the Shopify store (Settings → Languages)`;
}

/** True when Shopify userError means the locale is missing / not valid for the shop. */
export function isInvalidShopifyLocaleUserError(message: string): boolean {
  return /not a valid locale|locale is not enabled|not enabled on this shop|not a valid.*for the shop/i.test(
    message,
  );
}

/** Map a Shopify invalid-locale userError to the same human reason as the leaf gate. */
export function mapInvalidShopifyLocaleError(message: string, displayCode: string): string {
  if (isInvalidShopifyLocaleUserError(message)) {
    return shopLocaleNotEnabledReason(displayCode);
  }
  return message;
}

/** Case-insensitive membership in the shop's enabled `shopLocales`. */
export function isShopifyLocaleEnabled(
  shopifyLocale: string,
  enabledShopifyLocales: ReadonlySet<string>,
): boolean {
  const needle = shopifyLocale.trim().toLowerCase();
  if (enabledShopifyLocales.has(needle)) return true;
  for (const code of enabledShopifyLocales) {
    if (code.toLowerCase() === needle) return true;
  }
  return false;
}

/**
 * Plan whether Synarava → Shopify may run for this Shopify locale.
 * `displayCode` is the registry content code (pt → "PT" in the reason).
 */
export function planShopifyLocaleTranslationWrite(input: {
  shopifyLocale: string;
  displayCode: string;
  /** When null/undefined, do not gate (legacy callers / tests without shop snapshot). */
  enabledShopifyLocales?: ReadonlySet<string> | null;
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

  const blockedReason = shopLocaleNotEnabledReason(input.displayCode);
  const enableOffer = input.canWriteLocales
    ? {
        kind: "ENABLE_SHOPIFY_LOCALE" as const,
        label: ENABLE_IN_SHOPIFY_LABEL,
        shopifyLocale: input.shopifyLocale,
      }
    : null;

  return { allowPush: false, blockedReason, enableOffer };
}
