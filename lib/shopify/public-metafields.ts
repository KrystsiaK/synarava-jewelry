import { PRODUCT_CHARACTERISTICS } from "@/lib/products/characteristics";

const SUPPORTED_TYPES = new Set([
  "single_line_text_field", "multi_line_text_field", "number_integer",
  "number_decimal", "boolean", "date", "date_time", "url",
]);
const MANAGED_KEYS = new Set<string>(PRODUCT_CHARACTERISTICS.map((item) => item.key));

function record(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/** Only Shopify definitions explicitly readable from Storefront may become product copy. */
export function projectPublicProductMetafields(value: unknown): Array<{ label: string; value: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const field = record(item);
    const definition = record(field.definition);
    if (record(definition.access).storefront !== "PUBLIC_READ") return [];
    if (typeof field.key !== "string" || typeof field.type !== "string" || typeof field.value !== "string") return [];
    if (!SUPPORTED_TYPES.has(field.type)) return [];
    if (field.namespace === "synarava" && MANAGED_KEYS.has(field.key)) return [];
    const label = typeof definition.name === "string" && definition.name.trim()
      ? definition.name.trim()
      : field.key.replace(/_/g, " ");
    const value = field.type === "boolean" ? field.value === "true" ? "Yes" : "No" : field.value.trim();
    return value ? [{ label, value }] : [];
  });
}
