"use client";

import { useCallback, useEffect, useRef, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { AnimatedModal, ArtifactButton } from "@/components/ui";
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

const SHOP_SCROLL_OPTIONS = { scroll: false };

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
  const [mobileSession, setMobileSession] = useState(0);
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
        router.push(qs ? `/shop?${qs}` : "/shop", SHOP_SCROLL_OPTIONS);
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
    startTransition(() => router.push("/shop", SHOP_SCROLL_OPTIONS));
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
    <div className={cn("relative", isPending && "pointer-events-none")} aria-busy={isPending}>
      <AnimatePresence>
        {isPending ? (
          <motion.div
            className="pointer-events-none absolute inset-x-0 -bottom-px z-20 h-px origin-left bg-couture-red"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 0.82, opacity: 1 }}
            exit={{ scaleX: 1, opacity: 0 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            aria-hidden="true"
          />
        ) : null}
      </AnimatePresence>

      {/* ── Session restore banner ───────────────────────────────────────────── */}
      {pendingRestore && (
        <div className="mb-4 flex flex-wrap items-center gap-3 border border-foreground/[0.08] bg-surface/80 px-4 py-3">
          <span className="shrink-0 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted/70">Last viewing:</span>

          {/* Summary pills */}
          <div className="flex flex-wrap gap-1.5">
            {pendingRestore.category && (
              <span className="border border-foreground/[0.08] px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-foreground/60">
                {labelOf(pendingRestore.category, categories)}
              </span>
            )}
            {pendingRestore.collection && (
              <span className="border border-foreground/[0.08] px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-foreground/60">
                {labelOf(pendingRestore.collection, collections)}
              </span>
            )}
            {pendingRestore.tag && (
              <span className="border border-foreground/[0.08] px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-foreground/60">
                {labelOf(pendingRestore.tag, tags)}
              </span>
            )}
            {pendingRestore.q && (
              <span className="border border-foreground/[0.08] px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-foreground/60">
                &ldquo;{pendingRestore.q}&rdquo;
              </span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <ArtifactButton
              type="button"
              onClick={() => {
                setFilters(pendingRestore);
                setSearch(pendingRestore.q ?? "");
                navigate(pendingRestore);
                setPendingRestore(null);
              }}
              size="sm"
            >
              Apply filters
            </ArtifactButton>
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
      <div className="hidden border-y border-foreground/[0.08] bg-background/82 md:block">
        <div className="flex items-end justify-between gap-8 border-b border-foreground/[0.06] px-5 py-4 lg:px-6">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-couture-red">
              Curate the archive
            </p>
            <p className="mt-1 max-w-xl text-sm leading-6 text-foreground/58">
              Refine by form, collection, material language, or a quiet search term.
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted/55">
              Showing
            </p>
            <p className="mt-1 font-serif text-[1.35rem] leading-none text-foreground">
              {totalCount} <span className="font-sans text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted/60">{totalCount === 1 ? "piece" : "pieces"}</span>
            </p>
          </div>
        </div>

        {/* Left: label + divider + dropdowns */}
        <div className="flex items-center justify-between gap-5 px-5 py-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
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

          <div className="relative flex w-[min(28vw,17rem)] items-center border-b border-foreground/[0.14] transition-colors focus-within:border-couture-red">
            <Search className="pointer-events-none absolute left-0 size-3.5 text-muted/60" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search archive…"
              aria-label="Search products"
              className={cn(
                "w-full bg-transparent py-2 pl-6 pr-6 text-[0.8rem] font-semibold uppercase tracking-[0.13em]",
                "placeholder:text-muted/42 outline-none transition-all duration-200",
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
        </div>
      </div>

      {/* ── Mobile filter row ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 md:hidden">
        <div className="relative flex flex-1 items-center border-b border-foreground/[0.14]">
          <Search className="absolute left-0 size-3.5 shrink-0 text-muted/60 pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search…"
            aria-label="Search products"
            className="w-full bg-transparent py-3 pl-6 pr-6 text-[0.78rem] font-semibold uppercase tracking-[0.13em] placeholder:text-muted/42 outline-none"
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
          onClick={() => {
            setMobileSession((session) => session + 1);
            setMobileOpen(true);
          }}
          aria-label={`Filters${activeCount > 0 ? `, ${activeCount} active` : ""}`}
          className={cn(
            "relative inline-flex shrink-0 items-center gap-2 border px-4 py-3 label-caps",
            "transition-all duration-200 cursor-pointer active:scale-[0.97]",
            activeCount > 0
              ? "border-couture-red bg-couture-red/[0.06] text-couture-red"
              : "border-foreground/[0.12] text-muted hover:border-foreground/25 hover:text-foreground",
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
        <span className="shrink-0 whitespace-nowrap text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-muted/55 tabular-nums">
          {totalCount} {totalCount === 1 ? "piece" : "pieces"}
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
      <MobileFilterSheet
        key={mobileSession}
        open={mobileOpen}
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
    </div>
  );
}

// ── Mobile filter sheet ────────────────────────────────────────────────────

type MobileFilterSheetProps = {
  open: boolean;
  categories: FilterOption[];
  collections: FilterOption[];
  tags: FilterOption[];
  filters: ShopFilters;
  onApply: (f: ShopFilters) => void;
  onClose: () => void;
};

function MobileFilterSheet({
  open,
  categories,
  collections,
  tags,
  filters,
  onApply,
  onClose,
}: MobileFilterSheetProps) {
  const [local, setLocal] = useState<ShopFilters>(filters);

  const localActiveCount = countActiveFilters(local);

  const sections: { key: keyof ShopFilters; label: string; options: FilterOption[] }[] = [
    { key: "category",   label: "Category",   options: categories },
    { key: "collection", label: "Collection", options: collections },
    { key: "tag",        label: "Tag",        options: tags },
  ];

  return (
    <AnimatedModal
      open={open}
      onClose={onClose}
      variant="sheet"
      ariaLabel="Filter products"
      className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col border-t border-white/10 bg-[#090a0c] text-[#f2efe9] shadow-[0_-12px_40px_rgba(0,0,0,0.28)]"
    >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <p className="label-caps text-[#f2efe9]">Refine by</p>
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
                className="label-caps min-h-[44px] cursor-pointer px-2 text-[0.68rem] text-white/55 transition-colors hover:text-[#d45c7b]"
              >
                Clear all
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close filters"
              className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center p-2 text-white/55 transition-colors hover:text-white"
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
              <div key={key} className="border-b border-white/10 px-5 py-5">
                <p className="label-caps mb-4 text-white/45">{label}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setLocal((p) => ({ ...p, [key]: undefined }))}
                    className={cn(
                      "border px-4 py-2 label-mono transition-all duration-150 cursor-pointer active:scale-[0.97] min-h-[44px]",
                      !selectedValue
                        ? "border-[#f2efe9] bg-[#f2efe9] text-[#090a0c]"
                        : "border-white/14 text-white/62 hover:border-white/35 hover:text-white",
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
                          ? "border-[#d45c7b] bg-[#d45c7b]/10 text-[#e87592]"
                          : "border-white/14 text-white/62 hover:border-white/35 hover:text-white",
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
        <div className="shrink-0 border-t border-white/10 bg-[#090a0c] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <ArtifactButton
            type="button"
            onClick={() => onApply(local)}
            className="w-full"
          >
            {localActiveCount > 0
              ? `View pieces · ${localActiveCount} filter${localActiveCount > 1 ? "s" : ""} active`
              : "View all pieces"}
          </ArtifactButton>
        </div>
    </AnimatedModal>
  );
}
