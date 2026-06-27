"use client";

import { X } from "lucide-react";
import type { FilterOption, ShopFilters } from "./types";

type FilterChipsProps = {
  filters: ShopFilters;
  categories: FilterOption[];
  collections: FilterOption[];
  tags: FilterOption[];
  onRemove: (key: keyof ShopFilters) => void;
  onClearAll: () => void;
};

const labelOf = (value: string, options: FilterOption[]) =>
  options.find((o) => o.value === value)?.label ?? value;

const DIM_LABELS: Record<keyof ShopFilters, string> = {
  q:          "Search",
  category:   "Category",
  collection: "Collection",
  tag:        "Tag",
};

export function FilterChips({
  filters,
  categories,
  collections,
  tags,
  onRemove,
  onClearAll,
}: FilterChipsProps) {
  const chips: { key: keyof ShopFilters; value: string }[] = [];

  if (filters.q)          chips.push({ key: "q",          value: `"${filters.q}"` });
  if (filters.category)   chips.push({ key: "category",   value: labelOf(filters.category, categories) });
  if (filters.collection) chips.push({ key: "collection", value: labelOf(filters.collection, collections) });
  if (filters.tag)        chips.push({ key: "tag",        value: labelOf(filters.tag, tags) });

  if (chips.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Active filters"
      data-testid="filter-chips"
    >
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-0 border border-accent/30 bg-accent/[0.05] overflow-hidden"
        >
          {/* Dimension label — dim prefix */}
          <span className="label-mono text-[0.65rem] text-muted/70 px-2.5 py-1.5 border-r border-accent/20 select-none">
            {DIM_LABELS[chip.key]}
          </span>
          {/* Value */}
          <span className="label-mono text-accent px-2.5 py-1.5">
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
          className="label-caps text-muted/60 border-b border-muted/20 pb-0.5 transition-colors hover:text-foreground hover:border-foreground/40 cursor-pointer"
        >
          Clear all
        </button>
      )}
    </div>
  );
}