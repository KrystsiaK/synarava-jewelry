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

export function FilterChips({
  filters,
  categories,
  collections,
  tags,
  onRemove,
  onClearAll,
}: FilterChipsProps) {
  const chips: { key: keyof ShopFilters; label: string }[] = [];

  if (filters.q) chips.push({ key: "q", label: `"${filters.q}"` });
  if (filters.category) chips.push({ key: "category", label: labelOf(filters.category, categories) });
  if (filters.collection) chips.push({ key: "collection", label: labelOf(filters.collection, collections) });
  if (filters.tag) chips.push({ key: "tag", label: labelOf(filters.tag, tags) });

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
          className="inline-flex items-center gap-1.5 border border-stroke px-3 py-1 label-mono transition-colors"
        >
          {chip.label}
          <button
            type="button"
            aria-label={`Remove filter ${chip.label}`}
            onClick={() => onRemove(chip.key)}
            className="ml-0.5 text-muted transition-colors hover:text-accent"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}

      {chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="label-mono text-muted underline underline-offset-4 transition-colors hover:text-foreground"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
