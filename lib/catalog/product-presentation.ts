import type { ShopDepartmentSlug } from "@/lib/catalog/taxonomy";

export type ProductPresentation = {
  descriptionLabel: string;
  descriptionTitle: string;
  buyingTitle: string;
  buyingBody: string;
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
    buyingBody: "Check the dimensions and materials before ordering. Care guidance is included with every piece.",
    priorityCharacteristicKeys: ["size", "fit_notes", "chain_length", "adjustable_length", "material", "metal", "stone_type", "care_instructions"],
  },
  pets: {
    descriptionLabel: "Everyday use",
    descriptionTitle: "Designed around care",
    buyingTitle: "Choose the right fit",
    buyingBody: "Measure your pet before ordering and review the intended use, hardware, and care instructions.",
    priorityCharacteristicKeys: ["intended_pet", "neck_circumference", "chest_circumference", "fit_notes", "hardware", "washable", "care_instructions", "safety_disclosure"],
  },
  kids: {
    descriptionLabel: "How it works",
    descriptionTitle: "Made for curious hands",
    buyingTitle: "Age and supervision",
    buyingBody: "Review the recommended age, set contents, and any supervision or small-parts guidance before ordering.",
    priorityCharacteristicKeys: ["recommended_age", "activity_type", "skill_level", "set_contents", "adult_supervision", "small_parts_warning", "safety_disclosure"],
  },
  "jewelry-making": {
    descriptionLabel: "Maker notes",
    descriptionTitle: "What the tool enables",
    buyingTitle: "Contents and compatibility",
    buyingBody: "Check the sold unit, dimensions, skill level, and compatibility with your existing tools or components.",
    priorityCharacteristicKeys: ["tool_type", "skill_level", "tool_compatibility", "component_size", "pack_quantity", "set_contents", "safety_disclosure"],
  },
};

export function getProductPresentation(department: ShopDepartmentSlug | null | undefined) {
  return PRESENTATION_BY_DEPARTMENT[department ?? "jewelry"];
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
