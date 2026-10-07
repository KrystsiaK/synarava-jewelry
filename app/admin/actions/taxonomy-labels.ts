"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin-session";
import {
  ensureTaxonomySeedLabels,
  listCatalogTaxonomyEnValues,
  listTaxonomyValueLabels,
  saveSynaravaTaxonomyLabels,
} from "@/lib/catalog/taxonomy-value-labels";
import type { TaxonomyKind } from "@/lib/catalog/taxonomy-value-kinds";
import { getStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";

export type TaxonomyLabelsActionState = {
  error?: string;
  success?: string;
};

export type TaxonomyLabelsEditorPayload = {
  categoryLeaves: string[];
  productTypes: string[];
  /** locale → kind → enValue → label */
  labels: Record<string, Record<TaxonomyKind, Record<string, string>>>;
  sources: Record<string, Record<TaxonomyKind, Record<string, string>>>;
};

function emptyKindMaps(): Record<TaxonomyKind, Record<string, string>> {
  return { CATEGORY_LEAF: {}, PRODUCT_TYPE: {} };
}

export async function loadTaxonomyLabelsEditorPayload(): Promise<TaxonomyLabelsEditorPayload> {
  await requireAdminSession();
  await ensureTaxonomySeedLabels();

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
  for (const locale of locales) {
    if (locale.code === "en") continue;
    labels[locale.code] = emptyKindMaps();
    sources[locale.code] = emptyKindMaps();
  }
  for (const row of rows) {
    if (row.locale === "en") continue;
    if (!labels[row.locale]) {
      labels[row.locale] = emptyKindMaps();
      sources[row.locale] = emptyKindMaps();
    }
    labels[row.locale][row.kind][row.enValue] = row.label;
    sources[row.locale][row.kind][row.enValue] = row.source;
  }

  return {
    categoryLeaves: [...categorySet].sort((a, b) => a.localeCompare(b)),
    productTypes: [...typeSet].sort((a, b) => a.localeCompare(b)),
    labels,
    sources,
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
