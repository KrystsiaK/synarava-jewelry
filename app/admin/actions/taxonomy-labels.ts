"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { JEWELRY_TAXONOMY_VALUE_TRANSLATIONS } from "@/lib/catalog/shop-facet-labels";
import {
  listCatalogTaxonomyEnValues,
  listTaxonomyValueLabels,
  saveSynaravaTaxonomyLabels,
} from "@/lib/catalog/taxonomy-value-labels";
import type { TaxonomyKind } from "@/lib/catalog/taxonomy-value-kinds";
import type { Locale } from "@/lib/i18n/locales";
import { getStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";

export type TaxonomyLabelsActionState = {
  error?: string;
  success?: string;
};

export type TaxonomyLabelDivergence = {
  divergesFromDictionary: true;
  dictionaryLabel: string;
};

export type TaxonomyLabelsEditorPayload = {
  categoryLeaves: string[];
  productTypes: string[];
  /** locale → kind → enValue → label */
  labels: Record<string, Record<TaxonomyKind, Record<string, string>>>;
  sources: Record<string, Record<TaxonomyKind, Record<string, string>>>;
  /** locale → kind → enValue → divergence when saved label ≠ code dictionary */
  divergences: Record<string, Record<TaxonomyKind, Record<string, TaxonomyLabelDivergence>>>;
};

function emptyKindMaps(): Record<TaxonomyKind, Record<string, string>> {
  return { CATEGORY_LEAF: {}, PRODUCT_TYPE: {} };
}

function emptyDivergenceMaps(): Record<TaxonomyKind, Record<string, TaxonomyLabelDivergence>> {
  return { CATEGORY_LEAF: {}, PRODUCT_TYPE: {} };
}

/** Code-dictionary display label for a taxonomy EN value + locale, if any. */
export function taxonomyDictionaryLabel(enValue: string, locale: string): string | undefined {
  const dictionary = JEWELRY_TAXONOMY_VALUE_TRANSLATIONS[locale as Locale];
  const label = dictionary?.[enValue]?.trim();
  return label || undefined;
}

export async function loadTaxonomyLabelsEditorPayload(): Promise<TaxonomyLabelsEditorPayload> {
  await requireAdminSession();
  // Read path: never seed TaxonomyValueLabel (sync-unification PR2).

  const [{ categoryLeaves, productTypes }, rows, locales] = await Promise.all([
    listCatalogTaxonomyEnValues(),
    listTaxonomyValueLabels(),
    getStorefrontLocales(),
  ]);

  // Include seeded / Shopify-only EN values even if not currently on a product.
  const categorySet = new Set(categoryLeaves);
  const typeSet = new Set(productTypes);
  for (const row of rows) {
    if (row.kind === "CATEGORY_LEAF") categorySet.add(row.enValue);
    else typeSet.add(row.enValue);
  }

  const labels: TaxonomyLabelsEditorPayload["labels"] = {};
  const sources: TaxonomyLabelsEditorPayload["sources"] = {};
  const divergences: TaxonomyLabelsEditorPayload["divergences"] = {};
  for (const locale of locales) {
    if (locale.code === "en") continue;
    labels[locale.code] = emptyKindMaps();
    sources[locale.code] = emptyKindMaps();
    divergences[locale.code] = emptyDivergenceMaps();
  }
  for (const row of rows) {
    if (row.locale === "en") continue;
    if (!labels[row.locale]) {
      labels[row.locale] = emptyKindMaps();
      sources[row.locale] = emptyKindMaps();
      divergences[row.locale] = emptyDivergenceMaps();
    }
    const saved = row.label.trim();
    labels[row.locale][row.kind][row.enValue] = row.label;
    sources[row.locale][row.kind][row.enValue] = row.source;
    const dictionaryLabel = taxonomyDictionaryLabel(row.enValue, row.locale);
    if (dictionaryLabel && saved !== dictionaryLabel) {
      divergences[row.locale][row.kind][row.enValue] = {
        divergesFromDictionary: true,
        dictionaryLabel,
      };
    }
  }

  return {
    categoryLeaves: [...categorySet].sort((a, b) => a.localeCompare(b)),
    productTypes: [...typeSet].sort((a, b) => a.localeCompare(b)),
    labels,
    sources,
    divergences,
  };
}

export async function saveTaxonomyLabelsAction(
  _prev: TaxonomyLabelsActionState,
  formData: FormData,
): Promise<TaxonomyLabelsActionState> {
  await requireAdminSession();

  const raw = String(formData.get("updates") ?? "");
  if (!raw.trim()) return { error: "Taxonomy payload is missing." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "Taxonomy payload is invalid." };
  }

  if (!Array.isArray(parsed)) return { error: "Taxonomy payload must be a list." };

  const updates: Array<{ kind: TaxonomyKind; enValue: string; locale: string; label: string }> = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const kind = row.kind === "CATEGORY_LEAF" || row.kind === "PRODUCT_TYPE" ? row.kind : null;
    const enValue = typeof row.enValue === "string" ? row.enValue : "";
    const locale = typeof row.locale === "string" ? row.locale : "";
    const label = typeof row.label === "string" ? row.label : "";
    if (!kind || !enValue.trim() || !locale.trim() || locale === "en") continue;
    updates.push({ kind, enValue, locale, label });
  }

  try {
    const saved = await saveSynaravaTaxonomyLabels(updates);
    revalidatePath("/admin/settings");
    revalidatePath("/[locale]/shop", "page");
    revalidatePath("/[locale]/artifacts/[id]", "page");
    return { success: saved ? `Taxonomy labels saved (${saved}).` : "No taxonomy label changes." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save taxonomy labels." };
  }
}
