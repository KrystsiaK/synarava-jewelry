"use client";

import { X } from "lucide-react";
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

const DIM_LABELS: Record<keyof ShopFilters, string> = {
  q:          "Search",
  department: "Department",
  category:   "Category",
  collection: "Collection",
  tag:        "Tag",
  material:   "Material",
  finish:     "Finish",
  origin:     "Origin",
  certified:  "Certification",
  sort:        "Sort",
};

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
  const chips: { key: keyof ShopFilters; value: string }[] = [];

  if (filters.q)          chips.push({ key: "q",          value: `"${filters.q}"` });
  if (filters.department) chips.push({ key: "department", value: labelOf(filters.department, departments) });
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
      aria-label="Active filters"
      data-testid="filter-chips"
    >
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-0 overflow-hidden border border-couture-red/22 bg-background/70"
        >
          {/* Dimension label — dim prefix */}
          <span className="select-none border-r border-couture-red/14 px-2.5 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.15em] text-muted/70">
            {DIM_LABELS[chip.key]}
          </span>
          {/* Value */}
          <span className="px-2.5 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-couture-red">
            {chip.value}
          </span>
          {/* Remove */}
          <button
            type="button"
            aria-label={`Remove filter ${chip.value}`}
            onClick={() => onRemove(chip.key)}
            className="px-2 py-1.5 text-muted transition-colors hover:text-accent hover:bg-accent/10 cursor-pointer"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}

      {chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="cursor-pointer border-b border-muted/20 pb-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted/60 transition-colors hover:border-foreground/40 hover:text-foreground"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
