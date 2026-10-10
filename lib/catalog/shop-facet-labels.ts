import type { Locale } from "@/lib/i18n/locales";
import {
  parseCharacteristicTextOverlay,
  resolveCharacteristicDisplayValue,
  type ProductCharacteristicValue,
} from "@/lib/products/characteristics";

/**
 * Buyer-facing labels for closed shop facet vocabularies.
 *
 * Filter *keys* stay English/canonical (URL + Prisma match on
 * `productType`, `shopifyCategoryId`, `ProductCharacteristic.textValue`).
 * Only the displayed label localizes — same split as
 * `characteristicLabel` for passport field names.
 *
 * Sync contract (category leaf + product type):
 * - EN identity: Shopify SoT (`shopifyCategoryId` / `productType`).
 * - Category translations: Standard Product Taxonomy is not a
 *   TranslatableResourceType → Synarava `TaxonomyValueLabel` overlays only.
 * - Product type: Shopify PRODUCT `product_type` translations are pulled into
 *   shared overlays when present; Synarava fills gaps. No push of shared
 *   overlays to Shopify (existing registerProductTranslation omits product_type).
 *
 * Resolution (non-en): DB overlay map → this code dictionary → English.
 * Characteristic TEXT overlays still win for material/finish/origin.
 */

/** Category leaf + product-type vocabulary (seeded into TaxonomyValueLabel). */
export const JEWELRY_TAXONOMY_VALUE_TRANSLATIONS: Partial<Record<Locale, Record<string, string>>> = {
  pt: {
    Jewelry: "Joalharia",
    Brooches: "Broches",
    "Brooches & Lapel Pins": "Broches e alfinetes",
    Necklaces: "Colares",
    Earrings: "Brincos",
    Bracelets: "Pulseiras",
    Rings: "Anéis",
    "Hair Accessories": "Acessórios para cabelo",
    "Beaded Necklace": "Colar de contas",
    Necklace: "Colar",
    Bracelet: "Pulseira",
    Earring: "Brinco",
    Ring: "Anel",
    Brooch: "Broche",
  },
  ru: {
    Jewelry: "Ювелирные изделия",
    Brooches: "Броши",
    "Brooches & Lapel Pins": "Броши и булавки",
    Necklaces: "Колье",
    Earrings: "Серьги",
    Bracelets: "Браслеты",
    Rings: "Кольца",
    "Hair Accessories": "Аксессуары для волос",
    "Beaded Necklace": "Бусы",
    Necklace: "Колье",
    Bracelet: "Браслет",
    Earring: "Серьга",
    Ring: "Кольцо",
    Brooch: "Брошь",
  },
};

/** Passport material / finish / origin common values (code-map fallback only). */
const JEWELRY_PASSPORT_VALUE_TRANSLATIONS: Partial<Record<Locale, Record<string, string>>> = {
  pt: {
    Pearl: "Pérola",
    "Crystal pearl": "Pérola de cristal",
    "Artificial pearls": "Pérolas artificiais",
    "Natural pearl": "Pérola natural",
    "Freshwater pearl": "Pérola de água doce",
    "Jewellery beading wire": "Fio de contas",
    Metal: "Metal",
    Brass: "Latão",
    Gold: "Ouro",
    Silver: "Prata",
    "316L stainless steel": "Aço inoxidável 316L",
    "Stainless steel": "Aço inoxidável",
    "18K Gold PVD": "PVD ouro 18K",
    "18K gold PVD": "PVD ouro 18K",
    "18K Gold PVD details": "PVD ouro 18K",
    "White / gold": "Branco / ouro",
    White: "Branco",
    Black: "Preto",
  },
  ru: {
    Pearl: "Жемчуг",
    "Crystal pearl": "Хрустальный жемчуг",
    "Artificial pearls": "Искусственный жемчуг",
    "Natural pearl": "Натуральный жемчуг",
    "Freshwater pearl": "Речной жемчуг",
    "Jewellery beading wire": "Ювелирный тросик",
    Metal: "Металл",
    Brass: "Латунь",
    Gold: "Золото",
    Silver: "Серебро",
    "316L stainless steel": "Нержавеющая сталь 316L",
    "Stainless steel": "Нержавеющая сталь",
    "18K Gold PVD": "PVD золото 18K",
    "18K gold PVD": "PVD золото 18K",
    "18K Gold PVD details": "PVD золото 18K",
    "White / gold": "Белый / золото",
    White: "Белый",
    Black: "Чёрный",
  },
};

/** Full shipped dictionary (taxonomy + passport). Kept for tests / fallback. */
const JEWELRY_FACET_VALUE_TRANSLATIONS: Partial<Record<Locale, Record<string, string>>> = {
  pt: {
    ...JEWELRY_TAXONOMY_VALUE_TRANSLATIONS.pt,
    ...JEWELRY_PASSPORT_VALUE_TRANSLATIONS.pt,
  },
  ru: {
    ...JEWELRY_TAXONOMY_VALUE_TRANSLATIONS.ru,
    ...JEWELRY_PASSPORT_VALUE_TRANSLATIONS.ru,
  },
};

/** Locale display label for a canonical EN facet value (category leaf, type, material…). */
export function localizeShopFacetValue(
  value: string,
  locale: Locale,
  overlays?: Map<string, string> | null,
): string {
  const trimmed = value.trim();
  if (!trimmed || locale === "en") return trimmed;
  const direct = overlays?.get(trimmed)
    ?? JEWELRY_FACET_VALUE_TRANSLATIONS[locale]?.[trimmed];
  if (direct) return direct;
  // Compound material lines from Shopify specs: "A / B / C".
  if (trimmed.includes(" / ")) {
    const parts = trimmed.split(" / ").map((part) => part.trim()).filter(Boolean);
    if (parts.length > 1) {
      return parts
        .map((part) => localizeShopFacetValue(part, locale, overlays))
        .join(" / ");
    }
  }
  return trimmed;
}

/**
 * Build EN textValue → locale label for one characteristic key from product
 * passport overlays. First non-empty overlay for a given EN value wins.
 */
export function buildCharacteristicFacetLabelMap(
  rows: Array<{
    key: string;
    textValue: string | null;
    details: unknown;
  }>,
  characteristicKey: string,
  locale: Locale,
): Map<string, string> {
  const labels = new Map<string, string>();
  if (locale === "en") return labels;

  for (const row of rows) {
    if (row.key !== characteristicKey) continue;
    const en = row.textValue?.trim();
    if (!en || labels.has(en)) continue;
    const overlay = parseCharacteristicTextOverlay(row.details)[characteristicKey]?.trim();
    if (overlay) labels.set(en, overlay);
  }
  return labels;
}

/** Resolve a characteristic facet option label: overlay → dictionary → EN. */
export function characteristicFacetLabel(
  enValue: string,
  locale: Locale,
  overlayByEnValue?: Map<string, string>,
): string {
  const trimmed = enValue.trim();
  if (!trimmed) return trimmed;
  return overlayByEnValue?.get(trimmed) ?? localizeShopFacetValue(trimmed, locale);
}

/**
 * PDP spec value: Shopify/Passport TEXT overlay → jewelry dictionary → EN.
 * Matches shop filter resolution so RU/PT cards and PDP stay aligned.
 */
export function resolvePdpCharacteristicDisplayValue(
  value: ProductCharacteristicValue,
  locale: Locale,
  textOverlay: Record<string, string> = {},
  taxonomyOverlays?: Map<string, string> | null,
): string {
  const resolved = resolveCharacteristicDisplayValue(value, locale, textOverlay);
  if (value.valueType !== "TEXT") return resolved;
  if (textOverlay[value.key]?.trim()) return resolved;
  return localizeShopFacetValue(resolved, locale, taxonomyOverlays);
}

/**
 * Operational Shopify tags (SKU / handle style) are not buyer vocabulary.
 * Hide them on cards; the shop tag filter is removed for the same reason.
 */
export function isBuyerFacingTagName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  // JW-BROOCH-… / sku-like codes
  if (/^[A-Z0-9]{2,}(?:-[A-Z0-9]+){2,}$/i.test(trimmed)) return false;
  if (/^[A-Z]{1,3}-\d{2,}(?:-\d+)*$/i.test(trimmed)) return false;
  return true;
}

export function buyerFacingTagNames(names: string[]): string[] {
  return names.filter(isBuyerFacingTagName);
}
