/**
 * Locale-owned Shop page copy. Empty values stay empty so a translation does
 * not inherit the English admin string — the storefront then uses that
 * locale's dictionary (`messages/<locale>.json`).
 */
export const SHOP_PAGE_COPY_KEYS = [
  "shopNewTitle",
  "shopNewDescription",
  "shopViewAllLabel",
  "shopProductTypeTitle",
  "shopProductTypeDescription",
  "shopFiltersEyebrow",
  "shopFiltersDescription",
  "shopFilterCategoryLabel",
  "shopFilterProductTypeLabel",
  "shopFilterAvailabilityLabel",
  "shopFiltersMoreLabel",
  "shopFiltersSearchPlaceholder",
  "shopFiltersShowingLabel",
  "shopAvailableCountLabel",
] as const;

export type ShopPageCopyKey = (typeof SHOP_PAGE_COPY_KEYS)[number];

export type ShopPageCopy = Partial<Record<ShopPageCopyKey, string>>;

export const SHOP_PAGE_COPY_LABELS: Record<ShopPageCopyKey, string> = {
  shopNewTitle: "Shop — new arrivals heading",
  shopNewDescription: "Shop — new arrivals description",
  shopViewAllLabel: "Shop — view all label",
  shopProductTypeTitle: "Shop — product type heading",
  shopProductTypeDescription: "Shop — product type description",
  shopFiltersEyebrow: "Shop — filter heading",
  shopFiltersDescription: "Shop — filter description",
  shopFilterCategoryLabel: "Shop — category filter label",
  shopFilterProductTypeLabel: "Shop — product type filter label",
  shopFilterAvailabilityLabel: "Shop — availability filter label",
  shopFiltersMoreLabel: "Shop — more filters label",
  shopFiltersSearchPlaceholder: "Shop — product search placeholder",
  shopFiltersShowingLabel: "Shop — showing label",
  shopAvailableCountLabel: "Shop — products available label",
};

const SHOP_PAGE_COPY_FALLBACKS: Record<Exclude<ShopPageCopyKey, "shopAvailableCountLabel">, string> = {
  shopNewTitle: "shop.discovery.newTitle",
  shopNewDescription: "shop.discovery.newDescription",
  shopViewAllLabel: "shop.discovery.viewAll",
  shopProductTypeTitle: "shop.discovery.productTypeTitle",
  shopProductTypeDescription: "shop.discovery.productTypeDescription",
  shopFiltersEyebrow: "shop.filters.eyebrow",
  shopFiltersDescription: "shop.filters.description",
  shopFilterCategoryLabel: "shop.filters.category",
  shopFilterProductTypeLabel: "shop.filters.productType",
  shopFilterAvailabilityLabel: "shop.filters.availability",
  shopFiltersMoreLabel: "shop.filters.more",
  shopFiltersSearchPlaceholder: "shop.filters.searchPlaceholder",
  shopFiltersShowingLabel: "shop.filters.showing",
};

export type ShopFilterLabels = {
  eyebrow: string;
  description: string;
  category: string;
  productType: string;
  availability: string;
  more: string;
  searchPlaceholder: string;
  searchLabel: string;
  showing: string;
};

export type ResolvedShopStorefrontCopy = {
  newTitle: string;
  newDescription: string;
  viewAll: string;
  productTypeTitle: string;
  productTypeDescription: string;
  filters: ShopFilterLabels;
  /** Words after the hero count. Already pluralized when the admin field is empty. */
  availableCountLabel: string;
};

export function shopPageCopyFromRecord(
  source: object | null | undefined,
): Record<ShopPageCopyKey, string> {
  const record = (source ?? null) as Partial<Record<string, unknown>> | null;
  return Object.fromEntries(
    SHOP_PAGE_COPY_KEYS.map((key) => {
      const value = record?.[key];
      return [key, typeof value === "string" ? value.trim() : ""];
    }),
  ) as Record<ShopPageCopyKey, string>;
}

export function blankUntranslatedShopPageCopy(
  content: Record<string, unknown>,
  translation: Partial<Record<ShopPageCopyKey, unknown>>,
) {
  for (const key of SHOP_PAGE_COPY_KEYS) {
    const value = translation[key];
    if (typeof value !== "string" || value.trim().length === 0) {
      content[key] = "";
    }
  }
}

function ownedText(content: ShopPageCopy | null | undefined, key: ShopPageCopyKey) {
  return content?.[key]?.trim() ?? "";
}

export function resolveShopStorefrontCopy(
  content: ShopPageCopy | null | undefined,
  t: (key: string) => string,
  availableCountFallback: string,
): ResolvedShopStorefrontCopy {
  const text = (key: Exclude<ShopPageCopyKey, "shopAvailableCountLabel">) =>
    ownedText(content, key) || t(SHOP_PAGE_COPY_FALLBACKS[key]);
  const search = ownedText(content, "shopFiltersSearchPlaceholder");

  return {
    newTitle: text("shopNewTitle"),
    newDescription: text("shopNewDescription"),
    viewAll: text("shopViewAllLabel"),
    productTypeTitle: text("shopProductTypeTitle"),
    productTypeDescription: text("shopProductTypeDescription"),
    filters: {
      eyebrow: text("shopFiltersEyebrow"),
      description: text("shopFiltersDescription"),
      category: text("shopFilterCategoryLabel"),
      productType: text("shopFilterProductTypeLabel"),
      availability: text("shopFilterAvailabilityLabel"),
      more: text("shopFiltersMoreLabel"),
      searchPlaceholder: search || t("shop.filters.searchPlaceholder"),
      searchLabel: search || t("shop.filters.searchLabel"),
      showing: text("shopFiltersShowingLabel"),
    },
    availableCountLabel: ownedText(content, "shopAvailableCountLabel") || availableCountFallback,
  };
}
