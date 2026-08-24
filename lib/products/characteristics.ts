import type { CharacteristicValueType } from "@prisma/client";

export const PRODUCT_CHARACTERISTICS = [
  { key: "size", label: "Size", group: "Dimensions & fit", type: "TEXT", filterable: true },
  { key: "fit_notes", label: "Fit notes", group: "Dimensions & fit", type: "TEXT", multiline: true, filterable: false },
  { key: "internal_diameter", label: "Internal diameter", group: "Dimensions & fit", type: "NUMBER", unit: "mm" },
  { key: "external_diameter", label: "External diameter", group: "Dimensions & fit", type: "NUMBER", unit: "mm" },
  { key: "length", label: "Length", group: "Dimensions & fit", type: "NUMBER", unit: "mm" },
  { key: "width", label: "Width", group: "Dimensions & fit", type: "NUMBER", unit: "mm" },
  { key: "height", label: "Height", group: "Dimensions & fit", type: "NUMBER", unit: "mm" },
  { key: "chain_length", label: "Chain length", group: "Dimensions & fit", type: "NUMBER", unit: "cm" },
  { key: "adjustable_length", label: "Adjustable length", group: "Dimensions & fit", type: "NUMBER", unit: "cm" },
  { key: "pendant_length", label: "Pendant length", group: "Dimensions & fit", type: "NUMBER", unit: "mm" },
  { key: "pendant_width", label: "Pendant width", group: "Dimensions & fit", type: "NUMBER", unit: "mm" },
  { key: "unit_weight", label: "Unit weight", group: "Dimensions & fit", type: "NUMBER", unit: "g", filterable: false },
  { key: "material", label: "Primary material", group: "Materials & construction", type: "TEXT", filterable: true },
  { key: "secondary_material", label: "Secondary material", group: "Materials & construction", type: "TEXT", filterable: true },
  { key: "metal", label: "Metal", group: "Materials & construction", type: "TEXT", filterable: true },
  { key: "alloy", label: "Purity / alloy", group: "Materials & construction", type: "TEXT", filterable: true },
  { key: "stone_type", label: "Stone / gem", group: "Materials & construction", type: "TEXT", filterable: true },
  { key: "stone_color", label: "Stone color", group: "Materials & construction", type: "TEXT", filterable: true },
  { key: "stone_shape", label: "Stone shape", group: "Materials & construction", type: "TEXT", filterable: true },
  { key: "pearl_type", label: "Pearl type", group: "Materials & construction", type: "TEXT", filterable: true },
  { key: "pearl_size", label: "Pearl size", group: "Materials & construction", type: "TEXT", filterable: true },
  { key: "finish", label: "Finish / galvanization", group: "Materials & construction", type: "TEXT", filterable: true },
  { key: "plating", label: "Plating", group: "Materials & construction", type: "TEXT", filterable: true },
  { key: "color", label: "Color", group: "Materials & construction", type: "TEXT", filterable: true },
  { key: "origin", label: "Country / region of origin", group: "Materials & construction", type: "TEXT", filterable: true },
  { key: "production_method", label: "Production method", group: "Materials & construction", type: "TEXT", filterable: true },
  { key: "clasp_type", label: "Clasp type", group: "Materials & construction", type: "TEXT", filterable: true },
  { key: "care_instructions", label: "Care instructions", group: "Care & fulfilment", type: "TEXT", multiline: true, filterable: false },
  { key: "packaging", label: "Packaging", group: "Care & fulfilment", type: "TEXT", multiline: true, filterable: false },
  { key: "warranty", label: "Warranty", group: "Care & fulfilment", type: "TEXT", multiline: true, filterable: false },
  { key: "lead_time", label: "Production lead time", group: "Care & fulfilment", type: "TEXT", filterable: false },
  { key: "set_contents", label: "Set contents / sold unit", group: "Care & fulfilment", type: "TEXT", multiline: true, filterable: false },
  { key: "made_to_order", label: "Made to order", group: "Care & fulfilment", type: "BOOLEAN", filterable: true },
  { key: "reach_certified", label: "REACH certified", group: "Compliance & sales", type: "BOOLEAN", certificate: true },
  { key: "lead_free", label: "Lead free", group: "Compliance & sales", type: "BOOLEAN" },
  { key: "cadmium_free", label: "Cadmium free", group: "Compliance & sales", type: "BOOLEAN" },
  { key: "nickel_free", label: "Nickel-free release", group: "Compliance & sales", type: "BOOLEAN" },
  { key: "hypoallergenic", label: "Hypoallergenic", group: "Compliance & sales", type: "BOOLEAN" },
  { key: "sold_per_piece", label: "Sold per piece", group: "Compliance & sales", type: "BOOLEAN" },
  { key: "safety_disclosure", label: "Safety disclosure", group: "Compliance & sales", type: "TEXT", multiline: true, filterable: false },
] as const;

export const PRODUCT_CHARACTERISTIC_GROUPS = Array.from(
  new Set(PRODUCT_CHARACTERISTICS.map((item) => item.group)),
);

export type ProductCharacteristicKey = (typeof PRODUCT_CHARACTERISTICS)[number]["key"];

export type ProductCharacteristicValue = {
  key: string;
  label: string;
  group: string;
  valueType: CharacteristicValueType;
  textValue: string | null;
  numberValue: number | null;
  booleanValue: boolean | null;
  unit: string | null;
  certificateUrl: string | null;
  sortOrder: number;
};

export function parseCharacteristicsForm(formData: FormData) {
  return PRODUCT_CHARACTERISTICS.flatMap((definition, sortOrder) => {
    const field = `characteristic_${definition.key}`;
    const raw = String(formData.get(field) ?? "").trim();
    const valueType = definition.type as CharacteristicValueType;
    const booleanValue = valueType === "BOOLEAN" ? formData.get(field) === "on" : null;
    const numberValue = valueType === "NUMBER" && raw !== "" ? Number(raw) : null;
    const certificateUrl = "certificate" in definition
      ? String(formData.get(`${field}_certificate`) ?? "").trim() || null
      : null;

    if (valueType === "NUMBER" && (numberValue == null || !Number.isFinite(numberValue))) return [];
    if (valueType === "TEXT" && !raw) return [];
    if (valueType === "BOOLEAN" && !booleanValue && !certificateUrl) return [];

    return [{
      key: definition.key,
      label: definition.label,
      group: definition.group,
      valueType,
      textValue: valueType === "TEXT" ? raw : null,
      numberValue,
      booleanValue,
      unit: "unit" in definition ? definition.unit : null,
      certificateUrl,
      searchable: true,
      filterable: "filterable" in definition ? Boolean(definition.filterable) : true,
      sortOrder,
    }];
  });
}

export function characteristicDisplayValue(value: ProductCharacteristicValue) {
  if (value.valueType === "BOOLEAN") return value.booleanValue ? "Yes" : "No";
  if (value.valueType === "NUMBER") {
    return `${value.numberValue ?? ""}${value.unit ? ` ${value.unit}` : ""}`.trim();
  }
  return value.textValue ?? "";
}

export function buildProductSearchDocument(input: {
  name: string;
  sku: string;
  slug: string;
  description?: string | null;
  shortDescription?: string | null;
  materialLine?: string | null;
  tags?: string[];
  characteristics: ReturnType<typeof parseCharacteristicsForm> | ProductCharacteristicValue[];
}) {
  return [
    input.name,
    input.sku,
    input.slug,
    input.description,
    input.shortDescription,
    input.materialLine,
    ...(input.tags ?? []),
    ...input.characteristics.flatMap((item) => [item.label, characteristicDisplayValue(item as ProductCharacteristicValue)]),
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}
