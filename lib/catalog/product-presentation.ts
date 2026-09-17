import type { ShopDepartmentSlug } from "@/lib/catalog/taxonomy";

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

const PRIORITY_CHARACTERISTIC_KEYS: Record<ShopDepartmentSlug, string[]> = {
  jewelry: ["size", "fit_notes", "chain_length", "adjustable_length", "material", "metal", "stone_type", "care_instructions"],
  pets: ["intended_pet", "neck_circumference", "chest_circumference", "fit_notes", "hardware", "washable", "care_instructions", "safety_disclosure"],
  kids: ["recommended_age", "activity_type", "skill_level", "set_contents", "adult_supervision", "small_parts_warning", "safety_disclosure"],
  "jewelry-making": ["tool_type", "skill_level", "tool_compatibility", "component_size", "pack_quantity", "set_contents", "safety_disclosure"],
};

/**
 * `t` is whichever translate function the caller already has — client
 * components pass useTranslations().t, server components pass
 * getServerTranslations().t — so this stays usable from both without
 * knowing which context it's in (REV-23).
 */
export function getProductPresentation(department: ShopDepartmentSlug | null | undefined, t: TranslateFn): ProductPresentation {
  // Departments are now admin-curated primary-nav collections, so a slug
  // with no dedicated presentation (freshly added, not yet designed for)
  // falls back to jewelry's rather than indexing to undefined.
  const key = department && department in PRIORITY_CHARACTERISTIC_KEYS ? department : "jewelry";
  return {
    descriptionLabel: t(`product.presentation.${key}.descriptionLabel`),
    descriptionTitle: t(`product.presentation.${key}.descriptionTitle`),
    buyingTitle: t(`product.presentation.${key}.buyingTitle`),
    priorityCharacteristicKeys: PRIORITY_CHARACTERISTIC_KEYS[key],
  };
}

export function getProductBreadcrumbs(product: {
  title: string;
  departmentSlug: ShopDepartmentSlug | null;
  departmentName: string;
  categorySlug: string | null;
  categoryName: string | null;
}, t: TranslateFn): ProductBreadcrumb[] {
  const breadcrumbs: ProductBreadcrumb[] = [{ label: t("nav.shop"), href: "/shop" }];
  const filters = new URLSearchParams();

  if (product.departmentSlug && product.departmentName) {
    filters.set("department", product.departmentSlug);
    breadcrumbs.push({
      label: product.departmentName,
      href: `/shop?${filters.toString()}`,
    });
  }

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
