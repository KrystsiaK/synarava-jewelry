"use client";

import { X } from "lucide-react";
import { useTranslations } from "@/lib/i18n/context";
import type { FilterOption, ShopFilters } from "./types";

type FilterChipsProps = {
  filters: ShopFilters;
  departments?: FilterOption[];
  categories: FilterOption[];
  collections: FilterOption[];
  tags: FilterOption[];
  materials?: FilterOption[];
  finishes?: FilterOption[];
  origins?: FilterOption[];
  onRemove: (key: keyof ShopFilters) => void;
  onClearAll: () => void;
};

const labelOf = (value: string, options: FilterOption[]) =>
  options.find((o) => o.value === value)?.label ?? value;

export function FilterChips({
  filters,
  departments = [],
  categories,
  collections,
  tags,
  materials = [],
  finishes = [],
  origins = [],
  onRemove,
  onClearAll,
}: FilterChipsProps) {
  const { t } = useTranslations();
  const dimLabels: Record<keyof ShopFilters, string> = {
    q: t("shop.filters.searchLabel"),
    department: t("shop.filters.department"),
    availability: t("shop.filters.availability"),
    category: t("shop.filters.category"),
    collection: t("shop.filters.collection"),
    tag: t("shop.filters.tag"),
    material: t("shop.filters.material"),
    finish: t("shop.filters.finish"),
    origin: t("shop.filters.origin"),
    certified: t("shop.filters.certification"),
    sort: t("shop.filters.sort"),
  };
  const chips: { key: keyof ShopFilters; value: string }[] = [];

  if (filters.q)          chips.push({ key: "q",          value: `"${filters.q}"` });
  if (filters.department) chips.push({ key: "department", value: labelOf(filters.department, departments) });
  if (filters.availability) chips.push({ key: "availability", value: t("shop.filters.inStock") });
  if (filters.category)   chips.push({ key: "category",   value: labelOf(filters.category, categories) });
  if (filters.collection) chips.push({ key: "collection", value: labelOf(filters.collection, collections) });
  if (filters.tag)        chips.push({ key: "tag",        value: labelOf(filters.tag, tags) });
  if (filters.material)   chips.push({ key: "material",   value: labelOf(filters.material, materials) });
  if (filters.finish)     chips.push({ key: "finish",     value: labelOf(filters.finish, finishes) });
  if (filters.origin)     chips.push({ key: "origin",     value: labelOf(filters.origin, origins) });
  if (filters.certified)  chips.push({ key: "certified",  value: labelOf(filters.certified, [{ value: "reach_certified", label: "REACH" }, { value: "lead_free", label: "Lead free" }, { value: "cadmium_free", label: "Cadmium free" }, { value: "nickel_free", label: "Nickel-free" }]) });

  if (chips.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2.5"
      role="group"
      aria-label={t("shop.filters.activeFilters")}
      data-testid="filter-chips"
    >
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-0 overflow-hidden border border-couture-red/22 bg-background/70"
        >
          {/* Dimension label — dim prefix */}
          <span className="select-none border-r border-couture-red/14 px-2.5 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.15em] text-muted/70">
            {dimLabels[chip.key]}
          </span>
          {/* Value */}
          <span className="px-2.5 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-couture-red">
            {chip.value}
          </span>
          {/* Remove */}
          <button
            type="button"
            aria-label={t("shop.filters.remove", { value: chip.value })}
            onClick={() => onRemove(chip.key)}
            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center px-2 py-1.5 text-muted transition-colors hover:bg-accent/10 hover:text-accent"
          >
            <X className="size-3" aria-hidden="true" />
          </button>
        </span>
      ))}

      {chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="min-h-11 cursor-pointer border-b border-muted/20 px-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted/60 transition-colors hover:border-foreground/40 hover:text-foreground"
        >
          {t("shop.filters.clearAll")}
        </button>
      )}
    </div>
  );
}
