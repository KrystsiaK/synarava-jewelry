export const PRODUCT_FIELD_MESSAGES = {
  name: "Enter a product name.",
  slug: "Enter a URL slug.",
  sku: "Enter an SKU.",
  price: "Enter a price greater than 0.",
  collectionSlug: "Publish the collection before making this product live, or keep the product in Draft.",
} as const;

export type ProductFieldName = keyof typeof PRODUCT_FIELD_MESSAGES;

export type ProductFieldErrors = Partial<Record<ProductFieldName, string>>;

/**
 * Visual order of required product fields across editor tabs
 * (Product → Price → Inventory strip order, then fields top-to-bottom).
 * Used to open the first failing tab / focus the first failing control.
 */
export const PRODUCT_FIELD_VISUAL_ORDER = [
  "name",
  "slug",
  "collectionSlug",
  "price",
  "sku",
] as const satisfies readonly ProductFieldName[];

/** Tab that owns each validated product field. */
export const PRODUCT_FIELD_SECTION = {
  name: "essentials",
  slug: "essentials",
  collectionSlug: "essentials",
  price: "price",
  sku: "inventory",
} as const satisfies Record<ProductFieldName, "essentials" | "price" | "inventory">;

export function firstProductFieldError(
  errors: ProductFieldErrors,
): ProductFieldName | null {
  for (const name of PRODUCT_FIELD_VISUAL_ORDER) {
    if (errors[name]) return name;
  }
  return null;
}

export function validateProductInput(input: {
  name: string;
  slug: string;
  sku: string;
  price: string;
}): ProductFieldErrors {
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

/** Read commerce core fields from a product editor `<form>` (any tab). */
export function readProductFormValidationInput(form: HTMLFormElement): {
  name: string;
  slug: string;
  sku: string;
  price: string;
} {
  const read = (name: string) => {
    const element = form.elements.namedItem(name);
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return element.value;
    }
    if (element instanceof RadioNodeList) return element.value;
    return "";
  };
  return {
    name: read("name"),
    slug: read("slug"),
    sku: read("sku"),
    price: read("price"),
  };
}
