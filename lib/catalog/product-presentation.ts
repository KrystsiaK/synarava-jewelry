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

const PRESENTATION_BY_DEPARTMENT: Record<ShopDepartmentSlug, ProductPresentation> = {
  jewelry: {
    descriptionLabel: "Object notes",
    descriptionTitle: "The piece, in full",
    buyingTitle: "Fit and care",
    priorityCharacteristicKeys: ["size", "fit_notes", "chain_length", "adjustable_length", "material", "metal", "stone_type", "care_instructions"],
  },
  pets: {
    descriptionLabel: "Everyday use",
    descriptionTitle: "Designed around care",
    buyingTitle: "Choose the right fit",
    priorityCharacteristicKeys: ["intended_pet", "neck_circumference", "chest_circumference", "fit_notes", "hardware", "washable", "care_instructions", "safety_disclosure"],
  },
  kids: {
    descriptionLabel: "How it works",
    descriptionTitle: "Made for curious hands",
    buyingTitle: "Age and supervision",
    priorityCharacteristicKeys: ["recommended_age", "activity_type", "skill_level", "set_contents", "adult_supervision", "small_parts_warning", "safety_disclosure"],
  },
  "jewelry-making": {
    descriptionLabel: "Maker notes",
    descriptionTitle: "What the tool enables",
    buyingTitle: "Contents and compatibility",
    priorityCharacteristicKeys: ["tool_type", "skill_level", "tool_compatibility", "component_size", "pack_quantity", "set_contents", "safety_disclosure"],
  },
};

export function getProductPresentation(department: ShopDepartmentSlug | null | undefined) {
  // Departments are now admin-curated primary-nav collections, so a slug
  // with no dedicated presentation (freshly added, not yet designed for)
  // falls back to jewelry's rather than indexing to undefined.
  const key = department && department in PRESENTATION_BY_DEPARTMENT ? department : "jewelry";
  return PRESENTATION_BY_DEPARTMENT[key];
}

export function getProductBreadcrumbs(product: {
  title: string;
  departmentSlug: ShopDepartmentSlug | null;
  departmentName: string;
  categorySlug: string | null;
  categoryName: string | null;
}): ProductBreadcrumb[] {
  const breadcrumbs: ProductBreadcrumb[] = [{ label: "Shop", href: "/shop" }];
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
