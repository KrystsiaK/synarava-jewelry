export const SHOP_DEPARTMENTS = [
  { slug: "jewelry", name: "Jewelry" },
  { slug: "pets", name: "Pets" },
  { slug: "kids", name: "Kids" },
  { slug: "jewelry-making", name: "Jewelry Making" },
] as const;

export type ShopDepartmentSlug = (typeof SHOP_DEPARTMENTS)[number]["slug"];

export function isShopDepartmentSlug(value: unknown): value is ShopDepartmentSlug {
  return SHOP_DEPARTMENTS.some((department) => department.slug === value);
}

export function shopDepartmentName(slug: ShopDepartmentSlug | null | undefined) {
  return SHOP_DEPARTMENTS.find((department) => department.slug === slug)?.name ?? "";
}
