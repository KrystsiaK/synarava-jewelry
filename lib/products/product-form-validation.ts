export const PRODUCT_FIELD_MESSAGES = {
  name: "Enter a product name.",
  slug: "Enter a URL slug.",
  sku: "Enter an SKU.",
  price: "Enter a price greater than 0.",
} as const;

export type ProductFieldName = keyof typeof PRODUCT_FIELD_MESSAGES;

export type ProductFieldErrors = Partial<Record<ProductFieldName, string>>;

export function validateProductInput(input: Record<ProductFieldName, string>): ProductFieldErrors {
  const fieldErrors: ProductFieldErrors = {};

  if (!input.name.trim()) fieldErrors.name = PRODUCT_FIELD_MESSAGES.name;
  if (!input.slug.trim()) fieldErrors.slug = PRODUCT_FIELD_MESSAGES.slug;
  if (!input.sku.trim()) fieldErrors.sku = PRODUCT_FIELD_MESSAGES.sku;

  const price = Number(input.price);
  if (!input.price.trim() || !Number.isFinite(price) || price <= 0) {
    fieldErrors.price = PRODUCT_FIELD_MESSAGES.price;
  }

  return fieldErrors;
}
