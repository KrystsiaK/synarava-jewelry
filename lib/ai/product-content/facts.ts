import { parseProductDetails } from "@/lib/content/product-details";

export type ProductContentFacts = {
  productId: string;
  name: string;
  productType: string | null;
  materialLine: string | null;
  shortDescription: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  detailsAttributes: { label: string; value: string }[];
  characteristics: { key: string; label: string; value: string }[];
  collections: string[];
  translations: {
    locale: string;
    title: string;
    shortDescription: string | null;
    description: string | null;
    materialLine: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
  }[];
};

type CharacteristicRow = {
  key: string;
  label: string;
  textValue: string | null;
  numberValue: { toString(): string } | number | null;
  booleanValue: boolean | null;
  unit: string | null;
};

type TranslationRow = {
  locale: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  materialLine: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

type CollectionLink = {
  collection: { name: string };
};

export type ProductForFacts = {
  id: string;
  name: string;
  productType: string | null;
  materialLine: string | null;
  shortDescription: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  details: unknown;
  characteristics: CharacteristicRow[];
  collections: CollectionLink[];
  translations: TranslationRow[];
};

function characteristicValue(row: CharacteristicRow): string {
  if (row.textValue?.trim()) {
    return row.unit ? `${row.textValue.trim()} ${row.unit}` : row.textValue.trim();
  }
  if (row.numberValue != null) {
    const n = typeof row.numberValue === "number" ? String(row.numberValue) : row.numberValue.toString();
    return row.unit ? `${n} ${row.unit}` : n;
  }
  if (row.booleanValue != null) return row.booleanValue ? "yes" : "no";
  return "";
}

/** Build prompt facts — product/catalog only; never reviews/orders/customers. */
export function buildProductContentFacts(product: ProductForFacts): ProductContentFacts {
  const details = parseProductDetails(product.details);
  return {
    productId: product.id,
    name: product.name,
    productType: product.productType,
    materialLine: product.materialLine,
    shortDescription: product.shortDescription,
    description: product.description,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    detailsAttributes: (details.attributes ?? []).map((a) => ({
      label: a.label,
      value: a.value,
    })),
    characteristics: product.characteristics
      .map((row) => ({
        key: row.key,
        label: row.label,
        value: characteristicValue(row),
      }))
      .filter((row) => row.value.length > 0),
    collections: product.collections.map((link) => link.collection.name).filter(Boolean),
    translations: product.translations.map((t) => ({
      locale: t.locale,
      title: t.title,
      shortDescription: t.shortDescription,
      description: t.description,
      materialLine: t.materialLine,
      seoTitle: t.seoTitle,
      seoDescription: t.seoDescription,
    })),
  };
}

/** Flatten facts into a single searchable string for claim-guard. */
export function factsCorpus(facts: ProductContentFacts): string {
  const chunks: string[] = [
    facts.name,
    facts.productType ?? "",
    facts.materialLine ?? "",
    facts.shortDescription ?? "",
    facts.description ?? "",
    facts.seoTitle ?? "",
    facts.seoDescription ?? "",
    ...facts.detailsAttributes.flatMap((a) => [a.label, a.value]),
    ...facts.characteristics.flatMap((c) => [c.key, c.label, c.value]),
    ...facts.collections,
    ...facts.translations.flatMap((t) => [
      t.title,
      t.shortDescription ?? "",
      t.description ?? "",
      t.materialLine ?? "",
      t.seoTitle ?? "",
      t.seoDescription ?? "",
    ]),
  ];
  return chunks.join("\n").toLowerCase();
}
