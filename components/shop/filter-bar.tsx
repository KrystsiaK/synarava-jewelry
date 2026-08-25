"use client";

import { useCallback, useEffect, useRef, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { AnimatedModal, ArtifactButton } from "@/components/ui";
import { cn } from "@/lib/ui";
import { useTranslations } from "@/lib/i18n/context";
import { FilterDropdown } from "./filter-dropdown";
import { FilterChips } from "./filter-chips";
import {
  type FilterOption,
  type ShopFilters,
  buildSearchParams,
  clearFiltersSession,
  countActiveFilters,
  filtersWithoutSort,
  loadFiltersFromSession,
  saveFiltersToSession,
} from "./types";

export type FilterBarProps = {
  departments?: FilterOption[];
  categories: FilterOption[];
  collections: FilterOption[];
  tags: FilterOption[];
  materials?: FilterOption[];
  finishes?: FilterOption[];
  origins?: FilterOption[];
  initialFilters: ShopFilters;
  totalCount: number;
};

const labelOf = (value: string, opts: FilterOption[]) =>
  opts.find((o) => o.value === value)?.label ?? value;

const SHOP_SCROLL_OPTIONS = { scroll: false };

export function FilterBar({
  departments = [],
  categories,
  collections,
  tags,
  materials = [],
  finishes = [],
  origins = [],
  initialFilters,
  totalCount,
}: FilterBarProps) {
  const router = useRouter();
  const { t, plural } = useTranslations();
  const [isPending, startTransition] = useTransition();

  const [filters, setFilters] = useState<ShopFilters>(initialFilters);
  const [search, setSearch] = useState(initialFilters.q ?? "");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSession, setMobileSession] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(() => Boolean(
    initialFilters.collection || initialFilters.tag || initialFilters.material
      || initialFilters.finish || initialFilters.origin || initialFilters.certified,
  ));
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
    const next = filtersWithoutSort(filters);
    setFilters(next);
    setSearch("");
    clearFiltersSession();
    startTransition(() => {
      const qs = buildSearchParams(next);
      router.push(qs ? `/shop?${qs}` : "/shop", SHOP_SCROLL_OPTIONS);
    });
  }, [filters, router]);

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
  const sortOptions: FilterOption[] = [
    { value: "newest", label: t("shop.filters.newest") },
    { value: "price-asc", label: t("shop.filters.priceAsc") },
    { value: "price-desc", label: t("shop.filters.priceDesc") },
    { value: "name-asc", label: t("shop.filters.nameAsc") },
  ];
  const availabilityOptions: FilterOption[] = [
    { value: "in-stock", label: t("shop.filters.inStock") },
  ];
  const isJewelryContext = !filters.department || filters.department === "jewelry";
  const showFinish = isJewelryContext;
  const showCompliance = filters.department !== "jewelry-making";

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
          <span className="shrink-0 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted/70">{t("shop.filters.lastViewing")}</span>

          {/* Summary pills */}
          <div className="flex flex-wrap gap-1.5">
            {pendingRestore.department && (
              <span className="border border-foreground/[0.08] px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-foreground/60">
                {labelOf(pendingRestore.department, departments)}
              </span>
            )}
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
              {t("shop.filters.applySaved")}
            </ArtifactButton>
            <button
              type="button"
              onClick={() => { clearFiltersSession(); setPendingRestore(null); }}
              className="text-muted hover:text-foreground transition-colors cursor-pointer"
              aria-label={t("shop.filters.dismissSaved")}
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
              {t("shop.filters.eyebrow")}
            </p>
            <p className="mt-1 max-w-xl text-sm leading-6 text-foreground/58">
              {t("shop.filters.description")}
            </p>
          </div>

          <div className="flex shrink-0 items-end gap-5">
            <FilterDropdown
              label={t("shop.filters.sort")}
              options={sortOptions}
              value={filters.sort && filters.sort !== "featured" ? filters.sort : ""}
              onChange={(value) => setFilter("sort", value)}
              allLabel={t("shop.filters.featured")}
              inactiveLabel={t("shop.filters.featured")}
            />
            <div className="text-right">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted/55">
                {t("shop.filters.showing")}
              </p>
              <p className="mt-1 font-serif text-[1.35rem] leading-none text-foreground" aria-live="polite" aria-atomic="true">
                <span className="font-sans text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted/60">{plural("shop.filters.productCount", totalCount)}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Left: label + divider + dropdowns */}
        <div className="flex items-center justify-between gap-5 px-5 py-4 lg:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <FilterDropdown
              label={t("shop.filters.department")}
              options={departments}
              value={filters.department ?? ""}
              onChange={(v) => setFilter("department", v)}
              allLabel={t("shop.filters.allDepartments")}
            />
            <FilterDropdown
              label={t("shop.filters.category")}
              options={categories}
              value={filters.category ?? ""}
              onChange={(v) => setFilter("category", v)}
              allLabel={t("shop.filters.allCategories")}
            />
            <FilterDropdown
              label={t("shop.filters.availability")}
              options={availabilityOptions}
              value={filters.availability ?? ""}
              onChange={(v) => setFilter("availability", v)}
              allLabel={t("shop.filters.allAvailability")}
            />
            <button
              type="button"
              aria-expanded={advancedOpen}
              onClick={() => setAdvancedOpen((open) => !open)}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 border border-foreground/10 bg-surface/45 px-3.5 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted transition-[background-color,border-color,color] hover:border-foreground/24 hover:bg-surface hover:text-foreground"
            >
              {advancedOpen ? t("shop.filters.less") : t("shop.filters.more")}
              <ChevronDown className={cn("size-3 transition-transform", advancedOpen && "rotate-180")} aria-hidden="true" />
            </button>
          </div>

          <div className="relative flex w-[min(28vw,17rem)] items-center border-b border-foreground/[0.14] transition-colors focus-within:border-couture-red">
            <Search className="pointer-events-none absolute left-0 size-3.5 text-muted/60" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t("shop.filters.searchPlaceholder")}
              aria-label={t("shop.filters.searchLabel")}
              className={cn(
                "w-full bg-transparent py-2 pl-6 pr-6 text-[0.8rem] font-semibold uppercase tracking-[0.13em]",
                "placeholder:text-muted/42 outline-none transition-[color,border-color] duration-200",
              )}
            />
            {search && (
              <button
                type="button"
                onClick={handleSearchClear}
                aria-label={t("shop.filters.clearSearch")}
                className="absolute right-0 inline-flex size-11 cursor-pointer items-center justify-center text-muted transition-colors hover:text-accent"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
        {advancedOpen ? (
          <div className="flex flex-wrap items-center gap-2.5 border-t border-foreground/[0.06] px-5 py-4 lg:px-6">
            {isJewelryContext ? <FilterDropdown label={t("shop.filters.collection")} options={collections} value={filters.collection ?? ""} onChange={(v) => setFilter("collection", v)} allLabel={t("shop.filters.allCollections")} /> : null}
            <FilterDropdown label={t("shop.filters.tag")} options={tags} value={filters.tag ?? ""} onChange={(v) => setFilter("tag", v)} allLabel={t("shop.filters.allTags")} />
            <FilterDropdown label={t("shop.filters.material")} options={materials} value={filters.material ?? ""} onChange={(v) => setFilter("material", v)} allLabel={t("shop.filters.allMaterials")} />
            {showFinish ? <FilterDropdown label={t("shop.filters.finish")} options={finishes} value={filters.finish ?? ""} onChange={(v) => setFilter("finish", v)} allLabel={t("shop.filters.allFinishes")} /> : null}
            <FilterDropdown label={t("shop.filters.origin")} options={origins} value={filters.origin ?? ""} onChange={(v) => setFilter("origin", v)} allLabel={t("shop.filters.allOrigins")} />
            {showCompliance ? <FilterDropdown label={t("shop.filters.compliance")} options={[{ value: "reach_certified", label: "REACH" }, { value: "lead_free", label: "Lead free" }, { value: "cadmium_free", label: "Cadmium free" }, { value: "nickel_free", label: "Nickel-free" }]} value={filters.certified ?? ""} onChange={(v) => setFilter("certified", v)} allLabel={t("shop.filters.allCompliance")} /> : null}
          </div>
        ) : null}
      </div>

      {/* ── Mobile filter row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-[1fr_auto] items-end gap-3 md:hidden">
        <div className="relative col-span-2 flex items-center border-b border-foreground/[0.14]">
          <Search className="absolute left-0 size-3.5 shrink-0 text-muted/60 pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t("shop.filters.searchPlaceholder")}
            aria-label={t("shop.filters.searchLabel")}
            className="w-full bg-transparent py-3 pl-6 pr-6 text-[0.78rem] font-semibold uppercase tracking-[0.13em] placeholder:text-muted/42 outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={handleSearchClear}
              aria-label={t("shop.filters.clearSearch")}
              className="absolute right-0 inline-flex size-11 cursor-pointer items-center justify-center text-muted transition-colors hover:text-accent"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-end gap-2">
          <FilterDropdown
            label={t("shop.filters.sort")}
            options={sortOptions}
            value={filters.sort && filters.sort !== "featured" ? filters.sort : ""}
            onChange={(value) => setFilter("sort", value)}
            allLabel={t("shop.filters.featured")}
            inactiveLabel={t("shop.filters.featured")}
          />
          <button
            type="button"
            onClick={() => {
              setMobileSession((session) => session + 1);
              setMobileOpen(true);
            }}
            aria-label={`${t("shop.filters.filters")}${activeCount > 0 ? `, ${t("shop.filters.activeCount", { count: activeCount })}` : ""}`}
            className={cn(
              "relative inline-flex shrink-0 items-center gap-2 border px-4 py-3 label-caps",
              "cursor-pointer transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.97]",
              activeCount > 0
                ? "border-couture-red bg-couture-red/[0.06] text-couture-red"
                : "border-foreground/[0.12] text-muted hover:border-foreground/25 hover:text-foreground",
            )}
          >
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            {t("shop.filters.filters")}
            {activeCount > 0 && (
              <span className="inline-flex h-4 w-4 items-center justify-center bg-accent text-white label-mono text-[10px] rounded-full shrink-0">
                {activeCount}
              </span>
            )}
          </button>
        </div>

        {/* Labelled count */}
        <span className="shrink-0 whitespace-nowrap text-right text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-muted/55 tabular-nums" aria-live="polite" aria-atomic="true">
          {plural("shop.filters.productCount", totalCount)}
        </span>
      </div>

      {/* ── Active filter chips ──────────────────────────────────────────────── */}
      {activeCount > 0 && (
        <div className="mt-3">
          <FilterChips
            filters={filters}
            departments={departments}
            categories={categories}
            collections={collections}
            tags={tags}
            materials={materials}
            finishes={finishes}
            origins={origins}
            onRemove={removeFilter}
            onClearAll={clearAll}
          />
        </div>
      )}

      {/* ── Mobile filter sheet ──────────────────────────────────────────────── */}
      <MobileFilterSheet
        key={mobileSession}
        open={mobileOpen}
        departments={departments}
        categories={categories}
        collections={collections}
        tags={tags}
        materials={materials}
        finishes={finishes}
        origins={origins}
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
  departments?: FilterOption[];
  categories: FilterOption[];
  collections: FilterOption[];
  tags: FilterOption[];
  materials?: FilterOption[];
  finishes?: FilterOption[];
  origins?: FilterOption[];
  filters: ShopFilters;
  onApply: (f: ShopFilters) => void;
  onClose: () => void;
};

function MobileFilterSheet({
  open,
  departments = [],
  categories,
  collections,
  tags,
  materials = [],
  finishes = [],
  origins = [],
  filters,
  onApply,
  onClose,
}: MobileFilterSheetProps) {
  const { t, plural } = useTranslations();
  const [local, setLocal] = useState<ShopFilters>(filters);

  const localActiveCount = countActiveFilters(local);

  const sections: { key: keyof ShopFilters; label: string; options: FilterOption[] }[] = [
    { key: "department", label: t("shop.filters.department"), options: departments },
    { key: "category", label: t("shop.filters.category"), options: categories },
    { key: "availability", label: t("shop.filters.availability"), options: [{ value: "in-stock", label: t("shop.filters.inStock") }] },
    ...(!local.department || local.department === "jewelry"
      ? [{ key: "collection" as const, label: t("shop.filters.collection"), options: collections }]
      : []),
    { key: "tag", label: t("shop.filters.tag"), options: tags },
    { key: "material", label: t("shop.filters.material"), options: materials },
    ...(!local.department || local.department === "jewelry"
      ? [{ key: "finish" as const, label: t("shop.filters.finish"), options: finishes }]
      : []),
    { key: "origin", label: t("shop.filters.origin"), options: origins },
    ...(local.department === "jewelry-making"
      ? []
      : [{ key: "certified" as const, label: t("shop.filters.compliance"), options: [{ value: "reach_certified", label: "REACH" }, { value: "lead_free", label: "Lead free" }, { value: "cadmium_free", label: "Cadmium free" }, { value: "nickel_free", label: "Nickel-free" }] }]),
  ];

  return (
    <AnimatedModal
      open={open}
      onClose={onClose}
      variant="sheet"
      ariaLabel={t("shop.filters.refine")}
      className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col border-t border-stroke bg-background text-foreground shadow-[0_-12px_40px_rgba(0,0,0,0.18)]"
    >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-stroke px-5 py-4">
          <div className="flex items-center gap-3">
            <p className="label-caps text-foreground">{t("shop.filters.refine")}</p>
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
                onClick={() => setLocal(filtersWithoutSort(local))}
                className="label-caps min-h-[44px] cursor-pointer px-2 text-[0.68rem] text-muted transition-colors hover:text-accent"
              >
                {t("shop.filters.clearAll")}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={t("shop.filters.close")}
              className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center p-2 text-muted transition-colors hover:text-foreground"
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
                <p className="label-caps mb-4 text-muted">{label}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setLocal((p) => ({ ...p, [key]: undefined }))}
                    className={cn(
                      "min-h-[44px] cursor-pointer border px-4 py-2 label-mono transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97]",
                      !selectedValue
                        ? "border-foreground bg-foreground text-background"
                        : "border-stroke text-muted hover:border-foreground/35 hover:text-foreground",
                    )}
                  >
                    {t("shop.filters.all")}
                  </button>
                  {options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLocal((p) => ({ ...p, [key]: opt.value }))}
                      className={cn(
                        "min-h-[44px] cursor-pointer border px-4 py-2 label-mono transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97]",
                        selectedValue === opt.value
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-stroke text-muted hover:border-foreground/35 hover:text-foreground",
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
        <div className="shrink-0 border-t border-stroke bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <ArtifactButton
            type="button"
            onClick={() => onApply(local)}
            className="w-full"
          >
            {localActiveCount > 0
              ? plural("shop.filters.view", localActiveCount)
              : t("shop.filters.viewAll")}
          </ArtifactButton>
        </div>
    </AnimatedModal>
  );
}
