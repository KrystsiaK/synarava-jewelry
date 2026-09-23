export type ProductPresentation = {
  descriptionLabel: string;
  descriptionTitle: string;
  buyingTitle: string;
  priorityCharacteristicKeys: string[];
};

export type ProductBreadcrumb = {
  label: string;
  href?: string;
};

type TranslateFn = (key: string) => string;

const JEWELRY_PRIORITY_CHARACTERISTIC_KEYS = [
  "size",
  "fit_notes",
  "chain_length",
  "adjustable_length",
  "material",
  "metal",
  "stone_type",
  "care_instructions",
];

/**
 * `t` is whichever translate function the caller already has — client
 * components pass useTranslations().t, server components pass
 * getServerTranslations().t — so this stays usable from both without
 * knowing which context it's in (REV-23).
 */
export function getProductPresentation(t: TranslateFn): ProductPresentation {
  return {
    descriptionLabel: t("product.presentation.jewelry.descriptionLabel"),
    descriptionTitle: t("product.presentation.jewelry.descriptionTitle"),
    buyingTitle: t("product.presentation.jewelry.buyingTitle"),
    priorityCharacteristicKeys: JEWELRY_PRIORITY_CHARACTERISTIC_KEYS,
  };
}

export function getProductBreadcrumbs(product: {
  title: string;
  categorySlug: string | null;
  categoryName: string | null;
}, t: TranslateFn): ProductBreadcrumb[] {
  const breadcrumbs: ProductBreadcrumb[] = [{ label: t("nav.shop"), href: "/shop" }];
  const filters = new URLSearchParams();

  if (product.categorySlug && product.categoryName) {
    filters.set("category", product.categorySlug);
    breadcrumbs.push({
      label: product.categoryName,
      href: `/shop?${filters.toString()}`,
    });
  }

  breadcrumbs.push({ label: product.title });
  return breadcrumbs;
}
