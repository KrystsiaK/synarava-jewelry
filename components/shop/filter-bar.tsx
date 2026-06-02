"use client";

import { useCallback, useEffect, useRef, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { cn } from "@/lib/ui";
import { FilterDropdown } from "./filter-dropdown";
import { FilterChips } from "./filter-chips";
import {
  type FilterOption,
  type ShopFilters,
  buildSearchParams,
  clearFiltersSession,
  countActiveFilters,
  loadFiltersFromSession,
  saveFiltersToSession,
} from "./types";

export type FilterBarProps = {
  categories: FilterOption[];
  collections: FilterOption[];
  tags: FilterOption[];
  initialFilters: ShopFilters;
  totalCount: number;
};

export function FilterBar({
  categories,
  collections,
  tags,
  initialFilters,
  totalCount,
}: FilterBarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [filters, setFilters] = useState<ShopFilters>(initialFilters);
  const [search, setSearch] = useState(initialFilters.q ?? "");
  const [mobileOpen, setMobileOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRestoredRef = useRef(false);

  // ── Session restore on first mount (only when no URL params) ──────────────
  useEffect(() => {
    if (sessionRestoredRef.current) return;
    sessionRestoredRef.current = true;

    const hasUrlFilters = countActiveFilters(initialFilters) > 0;
    if (hasUrlFilters) return;

    const saved = loadFiltersFromSession();
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilters(saved);
      setSearch(saved.q ?? "");
      startTransition(() => {
        router.replace(`/shop?${buildSearchParams(saved)}`);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigate with current filters ─────────────────────────────────────────
  const navigate = useCallback(
    (next: ShopFilters) => {
      saveFiltersToSession(next);
      startTransition(() => {
        const qs = buildSearchParams(next);
        router.push(qs ? `/shop?${qs}` : "/shop");
      });
    },
    [router],
  );

  const setFilter = useCallback(
    (key: keyof ShopFilters, value: string) => {
      const next = { ...filters, [key]: value || undefined };
      setFilters(next);
      navigate(next);
    },
    [filters, navigate],
  );

  const removeFilter = useCallback(
    (key: keyof ShopFilters) => {
      const next = { ...filters, [key]: undefined };
      if (key === "q") setSearch("");
      setFilters(next);
      navigate(next);
    },
    [filters, navigate],
  );

  const clearAll = useCallback(() => {
    setFilters({});
    setSearch("");
    clearFiltersSession();
    startTransition(() => router.push("/shop"));
  }, [router]);

  // ── Debounced search ───────────────────────────────────────────────────────
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const next = { ...filters, q: value.trim() || undefined };
      setFilters(next);
      navigate(next);
    }, 350);
  };

  const handleSearchClear = () => {
    setSearch("");
    const next = { ...filters, q: undefined };
    setFilters(next);
    navigate(next);
    searchRef.current?.focus();
  };

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const activeCount = countActiveFilters(filters);

  return (
    <div className={cn("transition-opacity", isPending && "opacity-60 pointer-events-none")}>
      {/* ── Desktop filter bar ─────────────────────────────────────────────── */}
      <div className="panel hidden md:flex items-center justify-between gap-6 px-6 py-4">
        {/* Left: Dropdowns */}
        <div className="flex items-center gap-8">
          <FilterDropdown
            label="Categories"
            options={categories}
            value={filters.category ?? ""}
            onChange={(v) => setFilter("category", v)}
            allLabel="All categories"
          />
          <FilterDropdown
            label="Collections"
            options={collections}
            value={filters.collection ?? ""}
            onChange={(v) => setFilter("collection", v)}
            allLabel="All collections"
          />
          <FilterDropdown
            label="Tags"
            options={tags}
            value={filters.tag ?? ""}
            onChange={(v) => setFilter("tag", v)}
            allLabel="All tags"
          />
          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="label-caps text-muted transition-colors hover:text-accent"
            >
              Reset
            </button>
          )}
        </div>

        {/* Right: Search + count */}
        <div className="flex items-center gap-6">
          <div className="relative flex items-center">
            <Search className="absolute left-0 size-3.5 text-muted" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search archive…"
              aria-label="Search products"
              className="bg-transparent border-none border-b border-stroke/0 pl-6 pr-6 font-mono text-[0.82rem] uppercase tracking-[0.14em] placeholder:text-muted/50 outline-none focus:border-b focus:border-accent w-48 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={handleSearchClear}
                aria-label="Clear search"
                className="absolute right-0 text-muted hover:text-accent transition-colors"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <span className="label-mono text-muted/70 whitespace-nowrap hidden lg:block">
            {totalCount} {totalCount === 1 ? "piece" : "pieces"}
          </span>
        </div>
      </div>

      {/* ── Mobile filter bar ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 md:hidden">
        {/* Search */}
        <div className="relative flex flex-1 items-center border-b border-stroke">
          <Search className="absolute left-0 size-3.5 shrink-0 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search…"
            aria-label="Search products"
            className="w-full bg-transparent pl-6 pr-6 py-2.5 font-mono text-[0.82rem] uppercase tracking-[0.14em] placeholder:text-muted/50 outline-none"
          />
          {search && (
            <button type="button" onClick={handleSearchClear} aria-label="Clear search" className="absolute right-0">
              <X className="size-3.5 text-muted" />
            </button>
          )}
        </div>

        {/* Filters button */}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label={`Filters${activeCount > 0 ? `, ${activeCount} active` : ""}`}
          className="relative flex shrink-0 items-center gap-2 border border-stroke px-4 py-2.5 label-caps transition-colors hover:border-accent"
        >
          <SlidersHorizontal className="size-3.5" />
          Filters
          {activeCount > 0 && (
            <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent label-mono text-[10px] text-white">
              {activeCount}
            </span>
          )}
        </button>

        <span className="label-mono text-muted/70 whitespace-nowrap text-xs">
          {totalCount}
        </span>
      </div>

      {/* ── Active filter chips (both views) ───────────────────────────────── */}
      {activeCount > 0 && (
        <div className="mt-3">
          <FilterChips
            filters={filters}
            categories={categories}
            collections={collections}
            tags={tags}
            onRemove={removeFilter}
            onClearAll={clearAll}
          />
        </div>
      )}

      {/* ── Mobile filter sheet ────────────────────────────────────────────── */}
      {mobileOpen && (
        <MobileFilterSheet
          categories={categories}
          collections={collections}
          tags={tags}
          filters={filters}
          onApply={(next) => {
            setFilters(next);
            setMobileOpen(false);
            navigate(next);
          }}
          onClose={() => setMobileOpen(false)}
        />
      )}
    </div>
  );
}

// ── Mobile filter sheet ────────────────────────────────────────────────────

type MobileFilterSheetProps = {
  categories: FilterOption[];
  collections: FilterOption[];
  tags: FilterOption[];
  filters: ShopFilters;
  onApply: (f: ShopFilters) => void;
  onClose: () => void;
};

function MobileFilterSheet({
  categories,
  collections,
  tags,
  filters,
  onApply,
  onClose,
}: MobileFilterSheetProps) {
  const [local, setLocal] = useState<ShopFilters>(filters);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const sections: { key: keyof ShopFilters; label: string; options: FilterOption[] }[] = [
    { key: "category", label: "Category", options: categories },
    { key: "collection", label: "Collection", options: collections },
    { key: "tag", label: "Tag", options: tags },
  ];

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <aside
        role="dialog"
        aria-label="Filter products"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col bg-background border-t border-stroke"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stroke px-5 py-4">
          <p className="label-caps text-foreground">Filters</p>
          <button type="button" onClick={onClose} aria-label="Close filters" className="text-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {sections.map(({ key, label, options }) => {
            if (options.length === 0) return null;
            return (
              <div key={key} className="border-b border-stroke px-5 py-5">
                <p className="label-caps mb-4 text-muted">{label}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setLocal((p) => ({ ...p, [key]: undefined }))}
                    className={cn(
                      "border px-3 py-1.5 label-mono transition-colors",
                      !local[key]
                        ? "border-foreground text-foreground"
                        : "border-stroke text-muted hover:border-foreground/40",
                    )}
                  >
                    All
                  </button>
                  {options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLocal((p) => ({ ...p, [key]: opt.value }))}
                      className={cn(
                        "border px-3 py-1.5 label-mono transition-colors",
                        local[key] === opt.value
                          ? "border-accent text-accent"
                          : "border-stroke text-muted hover:border-foreground/40",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="flex gap-3 border-t border-stroke p-4">
          <button
            type="button"
            onClick={() => { setLocal({}); onApply({}); }}
            className="flex-1 border border-stroke px-4 py-3 label-caps text-muted transition-colors hover:border-accent hover:text-accent"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => onApply(local)}
            className="flex-1 bg-foreground px-4 py-3 label-caps text-background transition-colors hover:bg-accent"
          >
            Apply filters
          </button>
        </div>
      </aside>
    </>
  );
}
