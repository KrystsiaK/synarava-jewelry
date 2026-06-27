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

const labelOf = (value: string, opts: FilterOption[]) =>
  opts.find((o) => o.value === value)?.label ?? value;

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
  // Saved filters pending opt-in restore (not yet applied)
  const [pendingRestore, setPendingRestore] = useState<ShopFilters | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionCheckedRef = useRef(false);

  // ── Session restore: offer, don't auto-apply ───────────────────────────────
  useEffect(() => {
    if (sessionCheckedRef.current) return;
    sessionCheckedRef.current = true;

    const hasUrlFilters = countActiveFilters(initialFilters) > 0;
    if (hasUrlFilters) return; // URL already has filters — don't offer restore

    const saved = loadFiltersFromSession();
    if (saved && countActiveFilters(saved) > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingRestore(saved);
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
    <div className={cn("transition-opacity duration-200", isPending && "opacity-50 pointer-events-none")}>

      {/* ── Session restore banner ───────────────────────────────────────────── */}
      {pendingRestore && (
        <div className="mb-4 flex flex-wrap items-center gap-3 border border-stroke bg-surface/60 px-4 py-3">
          <span className="label-mono text-[0.72rem] text-muted/70 shrink-0">Last session:</span>

          {/* Summary pills */}
          <div className="flex flex-wrap gap-1.5">
            {pendingRestore.category && (
              <span className="label-mono text-[0.68rem] border border-stroke px-2 py-0.5 text-foreground/60">
                {labelOf(pendingRestore.category, categories)}
              </span>
            )}
            {pendingRestore.collection && (
              <span className="label-mono text-[0.68rem] border border-stroke px-2 py-0.5 text-foreground/60">
                {labelOf(pendingRestore.collection, collections)}
              </span>
            )}
            {pendingRestore.tag && (
              <span className="label-mono text-[0.68rem] border border-stroke px-2 py-0.5 text-foreground/60">
                {labelOf(pendingRestore.tag, tags)}
              </span>
            )}
            {pendingRestore.q && (
              <span className="label-mono text-[0.68rem] border border-stroke px-2 py-0.5 text-foreground/60">
                &ldquo;{pendingRestore.q}&rdquo;
              </span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setFilters(pendingRestore);
                setSearch(pendingRestore.q ?? "");
                navigate(pendingRestore);
                setPendingRestore(null);
              }}
              className="label-caps bg-foreground px-4 py-2 text-background transition-colors hover:bg-accent cursor-pointer text-[0.68rem]"
            >
              Apply filters
            </button>
            <button
              type="button"
              onClick={() => { clearFiltersSession(); setPendingRestore(null); }}
              className="text-muted hover:text-foreground transition-colors cursor-pointer"
              aria-label="Dismiss filter restore"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Desktop filter bar ──────────────────────────────────────────────── */}
      <div className="panel hidden md:flex items-center justify-between gap-6 px-6 py-3.5">

        {/* Left: label + divider + dropdowns */}
        <div className="flex items-center gap-6">
          <span className="label-mono text-[0.72rem] text-muted/50 shrink-0 tracking-[0.2em]">
            Refine
          </span>
          <div className="h-5 w-px bg-stroke shrink-0" />

          <div className="flex items-center gap-3">
            <FilterDropdown
              label="Category"
              options={categories}
              value={filters.category ?? ""}
              onChange={(v) => setFilter("category", v)}
              allLabel="All categories"
            />
            <FilterDropdown
              label="Collection"
              options={collections}
              value={filters.collection ?? ""}
              onChange={(v) => setFilter("collection", v)}
              allLabel="All collections"
            />
            <FilterDropdown
              label="Tag"
              options={tags}
              value={filters.tag ?? ""}
              onChange={(v) => setFilter("tag", v)}
              allLabel="All tags"
            />
          </div>
        </div>

        {/* Right: search + count */}
        <div className="flex items-center gap-5">
          <div className="relative flex items-center">
            <Search className="absolute left-0 size-3.5 text-muted/60 pointer-events-none" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search archive…"
              aria-label="Search products"
              className={cn(
                "bg-transparent pl-6 pr-6 font-mono text-[0.78rem] uppercase tracking-[0.14em]",
                "placeholder:text-muted/40 outline-none w-44 transition-all duration-200",
                "border-b border-transparent focus:border-accent",
                search && "border-stroke",
              )}
            />
            {search && (
              <button
                type="button"
                onClick={handleSearchClear}
                aria-label="Clear search"
                className="absolute right-0 text-muted hover:text-accent transition-colors cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="h-5 w-px bg-stroke" />

          <span className="label-mono text-[0.72rem] text-muted/50 whitespace-nowrap tabular-nums">
            {totalCount} {totalCount === 1 ? "piece" : "pieces"}
          </span>
        </div>
      </div>

      {/* ── Mobile filter row ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 md:hidden">
        <div className="relative flex flex-1 items-center border-b border-stroke">
          <Search className="absolute left-0 size-3.5 shrink-0 text-muted/60 pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search…"
            aria-label="Search products"
            className="w-full bg-transparent pl-6 pr-6 py-3 font-mono text-[0.78rem] uppercase tracking-[0.14em] placeholder:text-muted/40 outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={handleSearchClear}
              aria-label="Clear search"
              className="absolute right-0 text-muted hover:text-accent transition-colors cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label={`Filters${activeCount > 0 ? `, ${activeCount} active` : ""}`}
          className={cn(
            "relative inline-flex shrink-0 items-center gap-2 border px-4 py-3 label-caps",
            "transition-all duration-200 cursor-pointer active:scale-[0.97]",
            activeCount > 0
              ? "border-accent bg-accent/[0.06] text-accent"
              : "border-stroke text-muted hover:border-foreground/25 hover:text-foreground",
          )}
        >
          <SlidersHorizontal className="size-3.5" aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <span className="inline-flex h-4 w-4 items-center justify-center bg-accent text-white label-mono text-[10px] rounded-full shrink-0">
              {activeCount}
            </span>
          )}
        </button>

        {/* Labelled count */}
        <span className="label-mono text-[0.7rem] text-muted/50 whitespace-nowrap tabular-nums shrink-0">
          {totalCount} {totalCount === 1 ? "pc" : "pcs"}
        </span>
      </div>

      {/* ── Active filter chips ──────────────────────────────────────────────── */}
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

      {/* ── Mobile filter sheet ──────────────────────────────────────────────── */}
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

  const localActiveCount = countActiveFilters(local);

  const sections: { key: keyof ShopFilters; label: string; options: FilterOption[] }[] = [
    { key: "category",   label: "Category",   options: categories },
    { key: "collection", label: "Collection", options: collections },
    { key: "tag",        label: "Tag",        options: tags },
  ];

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <aside
        role="dialog"
        aria-label="Filter products"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col bg-background border-t border-stroke"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 py-4 border-b border-stroke">
          <div className="flex items-center gap-3">
            <p className="label-caps text-foreground">Refine by</p>
            {localActiveCount > 0 && (
              <span className="inline-flex h-5 px-1.5 items-center justify-center bg-accent text-white label-mono text-[10px] rounded-full">
                {localActiveCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {localActiveCount > 0 && (
              <button
                type="button"
                onClick={() => setLocal({})}
                className="label-caps text-[0.68rem] text-muted/60 hover:text-accent transition-colors cursor-pointer min-h-[44px] px-2"
              >
                Clear all
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close filters"
              className="text-muted hover:text-foreground transition-colors cursor-pointer p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Scrollable options — min-h-0 ensures it shrinks within flex column */}
        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          {sections.map(({ key, label, options }) => {
            if (options.length === 0) return null;
            const selectedValue = local[key as keyof ShopFilters];

            return (
              <div key={key} className="border-b border-stroke px-5 py-5">
                <p className="label-caps mb-4 text-muted/60">{label}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setLocal((p) => ({ ...p, [key]: undefined }))}
                    className={cn(
                      "border px-4 py-2 label-mono transition-all duration-150 cursor-pointer active:scale-[0.97] min-h-[44px]",
                      !selectedValue
                        ? "border-foreground bg-foreground text-background"
                        : "border-stroke text-muted hover:border-foreground/30 hover:text-foreground",
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
                        "border px-4 py-2 label-mono transition-all duration-150 cursor-pointer active:scale-[0.97] min-h-[44px]",
                        selectedValue === opt.value
                          ? "border-accent bg-accent/[0.08] text-accent"
                          : "border-stroke text-muted hover:border-foreground/30 hover:text-foreground",
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

        {/* Footer CTA */}
        <div className="shrink-0 border-t border-stroke p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => onApply(local)}
            className={cn(
              "w-full py-3.5 label-caps transition-colors duration-200 cursor-pointer active:scale-[0.99]",
              localActiveCount > 0
                ? "bg-accent text-white hover:bg-accent/90"
                : "bg-foreground text-background hover:bg-foreground/90",
            )}
          >
            {localActiveCount > 0
              ? `View pieces · ${localActiveCount} filter${localActiveCount > 1 ? "s" : ""} active`
              : "View all pieces"}
          </button>
        </div>
      </aside>
    </>
  );
}
