import type { CharacteristicValueType } from "@prisma/client";
import type { Locale } from "@/lib/i18n/locales";

/**
 * Curated jewelry passport — mirrored to Shopify as `synarava.*` metafields.
 * Keep this list small: shop filters + PDP priority + category seed targets.
 * Arbitrary merchant fields live in the Metafields tab (Shopify definitions).
 */
export const PRODUCT_CHARACTERISTICS = [
  { key: "size", label: "Size", group: "Dimensions & fit", type: "TEXT", filterable: true },
  { key: "fit_notes", label: "Fit notes", group: "Dimensions & fit", type: "TEXT", multiline: true, filterable: false },
  { key: "chain_length", label: "Chain length", group: "Dimensions & fit", type: "NUMBER", unit: "cm" },
  { key: "adjustable_length", label: "Adjustable length", group: "Dimensions & fit", type: "NUMBER", unit: "cm" },
  { key: "material", label: "Primary material", group: "Materials & construction", type: "TEXT", filterable: true },
  { key: "metal", label: "Metal", group: "Materials & construction", type: "TEXT", filterable: true },
  { key: "stone_type", label: "Stone / gem", group: "Materials & construction", type: "TEXT", filterable: true },
  { key: "color", label: "Color", group: "Materials & construction", type: "TEXT", filterable: true },
  { key: "finish", label: "Finish", group: "Materials & construction", type: "TEXT", filterable: true },
  { key: "plating", label: "Plating", group: "Materials & construction", type: "TEXT", filterable: true },
  { key: "origin", label: "Country / region of origin", group: "Materials & construction", type: "TEXT", filterable: true },
  { key: "care_instructions", label: "Care instructions", group: "Care", type: "TEXT", multiline: true, filterable: false },
  { key: "reach_certified", label: "REACH certified", group: "Compliance", type: "BOOLEAN", certificate: true },
  { key: "lead_free", label: "Lead free", group: "Compliance", type: "BOOLEAN" },
  { key: "cadmium_free", label: "Cadmium free", group: "Compliance", type: "BOOLEAN" },
  { key: "nickel_free", label: "Nickel-free release", group: "Compliance", type: "BOOLEAN" },
] as const;

export const PRODUCT_CHARACTERISTIC_GROUPS = Array.from(
  new Set(PRODUCT_CHARACTERISTICS.map((item) => item.group)),
);

// Merchant-owned characteristic taxonomy is code-defined, not admin-editable
// (see docs/translation-field-registry.md).
const CHARACTERISTIC_GROUP_LABEL_TRANSLATIONS: Partial<Record<Locale, Record<string, string>>> = {
  pt: {
    "Dimensions & fit": "Dimensões e ajuste",
    "Materials & construction": "Materiais e construção",
    Care: "Cuidados",
    Compliance: "Conformidade",
  },
};

const CHARACTERISTIC_LABEL_TRANSLATIONS: Partial<Record<Locale, Record<string, string>>> = {
  pt: {
    size: "Tamanho",
    fit_notes: "Notas de ajuste",
    chain_length: "Comprimento da corrente",
    adjustable_length: "Comprimento ajustável",
    material: "Material principal",
    metal: "Metal",
    stone_type: "Pedra / gema",
    color: "Cor",
    finish: "Acabamento",
    plating: "Banho (revestimento)",
    origin: "País / região de origem",
    care_instructions: "Instruções de cuidado",
    reach_certified: "Certificado REACH",
    lead_free: "Sem chumbo",
    cadmium_free: "Sem cádmio",
    nickel_free: "Libertação sem níquel",
  },
};

/** Locale-aware label for a characteristic key — falls back to the English source. */
export function characteristicLabel(key: string, fallbackLabel: string, locale: Locale): string {
  return CHARACTERISTIC_LABEL_TRANSLATIONS[locale]?.[key] ?? fallbackLabel;
}

export function characteristicGroupLabel(group: string, locale: Locale): string {
  return CHARACTERISTIC_GROUP_LABEL_TRANSLATIONS[locale]?.[group] ?? group;
}

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

/**
 * Reads the fixed `PRODUCT_CHARACTERISTICS` list out of a product form,
 * one `characteristic_<key>` field per definition, and drops empty rows.
 */
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

const BOOLEAN_LABELS: Record<Locale, { yes: string; no: string }> = {
  en: { yes: "Yes", no: "No" },
  pt: { yes: "Sim", no: "Não" },
  ru: { yes: "Да", no: "Нет" },
};

export function characteristicDisplayValue(value: ProductCharacteristicValue, locale: Locale = "en") {
  if (value.valueType === "BOOLEAN") {
    const labels = BOOLEAN_LABELS[locale];
    return value.booleanValue ? labels.yes : labels.no;
  }
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
