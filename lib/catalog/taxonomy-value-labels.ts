import "server-only";

import { cache } from "react";
import type { TaxonomyValueLabelSource } from "@prisma/client";

import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/locales";
import { JEWELRY_TAXONOMY_VALUE_TRANSLATIONS } from "@/lib/catalog/shop-facet-labels";
import type { TaxonomyKind } from "@/lib/catalog/taxonomy-value-kinds";

export type { TaxonomyKind } from "@/lib/catalog/taxonomy-value-kinds";

/** Category / product-type EN keys shipped in the jewelry vocabulary map (seed + fallback). */
export function taxonomySeedEntries(): Array<{
  kind: TaxonomyKind;
  enValue: string;
  locale: Locale;
  label: string;
}> {
  const rows: Array<{ kind: TaxonomyKind; enValue: string; locale: Locale; label: string }> = [];
  for (const [locale, map] of Object.entries(JEWELRY_TAXONOMY_VALUE_TRANSLATIONS) as Array<
    [Locale, Record<string, string>]
  >) {
    for (const [enValue, label] of Object.entries(map)) {
      const trimmed = enValue.trim();
      const localized = label.trim();
      if (!trimmed || !localized) continue;
      rows.push({ kind: "CATEGORY_LEAF", enValue: trimmed, locale, label: localized });
      rows.push({ kind: "PRODUCT_TYPE", enValue: trimmed, locale, label: localized });
    }
  }
  return rows;
}

/**
 * Inserts missing SEED_MAP rows only. Never overwrites SHOPIFY or SYNARAVA edits.
 * Safe to call on admin load / storefront warm path.
 */
export async function ensureTaxonomySeedLabels(): Promise<number> {
  const seeds = taxonomySeedEntries();
  if (seeds.length === 0) return 0;
  // skipDuplicates: never overwrite SHOPIFY / SYNARAVA rows.
  const result = await db.taxonomyValueLabel.createMany({
    data: seeds.map((seed) => ({
      kind: seed.kind,
      enValue: seed.enValue,
      locale: seed.locale,
      label: seed.label,
      source: "SEED_MAP" as const,
    })),
    skipDuplicates: true,
  });
  return result.count;
}

/** Flat enValue → label for a locale (both kinds). First wins; kinds share display strings. */
export const getTaxonomyFacetLabelMap = cache(async (locale: Locale): Promise<Map<string, string>> => {
  const labels = new Map<string, string>();
  if (locale === "en") return labels;

  // Do not seed on the storefront read path — empty DB falls through to the
  // code map in localizeShopFacetValue. Admin load/save calls ensureTaxonomySeedLabels.
  const findMany = db.taxonomyValueLabel?.findMany;
  if (!findMany) return labels;

  const rows = await findMany({
    where: { locale },
    select: { enValue: true, label: true, kind: true, source: true },
    orderBy: [{ source: "asc" }, { kind: "asc" }],
  });

  // Prefer SHOPIFY over SYNARAVA over SEED_MAP when the same enValue appears twice.
  const rank: Record<TaxonomyValueLabelSource, number> = {
    SEED_MAP: 0,
    SYNARAVA: 1,
    SHOPIFY: 2,
  };
  const ranked = new Map<string, { label: string; rank: number }>();
  for (const row of rows) {
    const key = row.enValue.trim();
    const label = row.label.trim();
    if (!key || !label) continue;
    const nextRank = rank[row.source];
    const prev = ranked.get(key);
    if (!prev || nextRank >= prev.rank) {
      ranked.set(key, { label, rank: nextRank });
    }
  }
  for (const [key, value] of ranked) labels.set(key, value.label);
  return labels;
});

export async function listCatalogTaxonomyEnValues(): Promise<{
  categoryLeaves: string[];
  productTypes: string[];
}> {
  const [categoryRows, productTypeRows] = await Promise.all([
    db.product.findMany({
      where: { shopifyCategoryName: { not: null } },
      select: { shopifyCategoryName: true },
      distinct: ["shopifyCategoryName"],
    }),
    db.product.findMany({
      where: { productType: { not: null } },
      select: { productType: true },
      distinct: ["productType"],
      orderBy: { productType: "asc" },
    }),
  ]);

  const leaf = (fullName: string | null | undefined) =>
    fullName?.split(">").at(-1)?.trim() ?? "";

  const categoryLeaves = [...new Set(
    categoryRows.map((row) => leaf(row.shopifyCategoryName)).filter(Boolean),
  )].sort((a, b) => a.localeCompare(b));

  const productTypes = [...new Set(
    productTypeRows.map((row) => row.productType?.trim() ?? "").filter(Boolean),
  )].sort((a, b) => a.localeCompare(b));

  return { categoryLeaves, productTypes };
}

export async function listTaxonomyValueLabels(locale?: string) {
  return db.taxonomyValueLabel.findMany({
    where: locale ? { locale } : undefined,
    orderBy: [{ kind: "asc" }, { enValue: "asc" }, { locale: "asc" }],
  });
}

export async function saveSynaravaTaxonomyLabels(
  updates: Array<{ kind: TaxonomyKind; enValue: string; locale: string; label: string }>,
): Promise<number> {
  let saved = 0;
  for (const update of updates) {
    const enValue = update.enValue.trim();
    const locale = update.locale.trim();
    const label = update.label.trim();
    if (!enValue || !locale || locale === "en") continue;

    if (!label) {
      // Clearing Synarava/seed overlay restores map/Shopify-only resolution.
      // Do not delete SHOPIFY rows — pull owns those.
      const existing = await db.taxonomyValueLabel.findUnique({
        where: {
          kind_enValue_locale: { kind: update.kind, enValue, locale },
        },
      });
      if (existing && existing.source !== "SHOPIFY") {
        await db.taxonomyValueLabel.delete({ where: { id: existing.id } });
        saved += 1;
      }
      continue;
    }

    await db.taxonomyValueLabel.upsert({
      where: {
        kind_enValue_locale: { kind: update.kind, enValue, locale },
      },
      create: {
        kind: update.kind,
        enValue,
        locale,
        label,
        source: "SYNARAVA",
      },
      update: {
        label,
        source: "SYNARAVA",
      },
    });
    saved += 1;
  }
  return saved;
}

/**
 * Shopify PRODUCT.product_type translation pull → shared vocabulary row.
 * Overwrites the shared label for that EN value (Shopify SoT when present).
 * Does not create EN identity — caller must pass the product's EN productType.
 */
export async function applyShopifyProductTypeLabel(input: {
  enProductType: string;
  locale: string;
  label: string;
}): Promise<void> {
  const enValue = input.enProductType.trim();
  const locale = input.locale.trim();
  const label = input.label.trim();
  if (!enValue || !locale || locale === "en" || !label) return;

  await db.taxonomyValueLabel.upsert({
    where: {
      kind_enValue_locale: {
        kind: "PRODUCT_TYPE",
        enValue,
        locale,
      },
    },
    create: {
      kind: "PRODUCT_TYPE",
      enValue,
      locale,
      label,
      source: "SHOPIFY",
    },
    update: {
      label,
      source: "SHOPIFY",
    },
  });
}
