"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowsDownUp as ArrowUpDown,
  CaretDown as ChevronDown,
  MagnifyingGlass as Search,
  SlidersHorizontal,
  X,
} from "@phosphor-icons/react/ssr";

import { AnimatedModal, ArtifactButton } from "@/components/ui";
import { RichText } from "@/components/content/rich-text";
import { cn } from "@/lib/ui";
import { useTranslations } from "@/lib/i18n/context";
import { localePath } from "@/lib/i18n/routing";
import { supportsComplianceFilters, supportsTagFilters } from "@/lib/catalog/taxonomy";
import {
  shopListStateSchema,
  type ShopFilters,
  type ShopListState,
} from "@/lib/catalog/shop-list-state";
import type { ShopFilterLabels } from "@/lib/content/shop-page-copy";
import {
  createSiteListStateAdapter,
  useListState,
} from "@/components/shared/list-state";
import { shopComplianceOptions } from "./compliance-options";
import { FilterDropdown } from "./filter-dropdown";
import { FilterChips } from "./filter-chips";
import {
  type FilterOption,
  clearFiltersSession,
  countActiveFilters,
  filtersWithoutSort,
} from "./types";

const siteListAdapter = createSiteListStateAdapter<ShopListState>();

export type FilterBarProps = {
  categories: FilterOption[];
  productTypes?: FilterOption[];
  collections: FilterOption[];
  tags: FilterOption[];
  materials?: FilterOption[];
  finishes?: FilterOption[];
  origins?: FilterOption[];
  initialFilters: ShopFilters;
  totalCount: number;
  onFiltersChange?: (filters: ShopFilters) => void;
  /** Storefront path without locale prefix. Defaults to `/shop`. */
  basePath?: string;
  /**
   * Filters that stay applied (e.g. collection on `/collections/[slug]`).
   * Hidden from chips/dropdowns and omitted from the shareable query string.
   */
  pinnedFilters?: Pick<ShopFilters, "collection">;
  /** Locale-owned Shop page labels. Empty values keep the dictionary string. */
  labels?: Partial<ShopFilterLabels>;
};

export function FilterBar({
  categories,
  productTypes = [],
  collections,
  tags,
  materials = [],
  finishes = [],
  origins = [],
  initialFilters,
  totalCount,
  onFiltersChange,
  basePath = "/shop",
  pinnedFilters,
  labels,
}: FilterBarProps) {
  const { t, plural, locale } = useTranslations();
  const text = (value: string | undefined, key: string) => value?.trim() || t(key);
  const complianceOptions = shopComplianceOptions(t);
  const pinnedCollection = pinnedFilters?.collection;
  const showCollectionFilter = !pinnedCollection;
  const listPathname = localePath(locale, basePath);
  const pinned = useMemo(
    () => (pinnedCollection ? { collection: pinnedCollection } : undefined),
    [pinnedCollection],
  );

  const {
    state: filters,
    draft,
    setState,
    setField,
    setFieldDebounced,
  } = useListState(shopListStateSchema, siteListAdapter, {
    initialState: {
      q: initialFilters.q,
      availability: initialFilters.availability,
      category: initialFilters.category,
      productType: initialFilters.productType,
      collection: initialFilters.collection,
      tag: initialFilters.tag,
      material: initialFilters.material,
      finish: initialFilters.finish,
      origin: initialFilters.origin,
      certified: initialFilters.certified,
      sort: initialFilters.sort ?? "featured",
    },
    pathname: listPathname,
    pinned,
    debounceKeys: ["q"],
    debounceMs: 350,
  });

  const search = draft.q ?? "";
  const searchRef = useRef<HTMLInputElement>(null);
  const skipNotifyRef = useRef(true);

  useEffect(() => {
    if (skipNotifyRef.current) {
      skipNotifyRef.current = false;
      return;
    }
    onFiltersChange?.(filters);
  }, [filters, onFiltersChange]);

  // Drop legacy session key once (site adapter is URL-only).
  useEffect(() => {
    clearFiltersSession();
  }, []);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSession, setMobileSession] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(() => Boolean(
    (showCollectionFilter && initialFilters.collection)
      || initialFilters.tag || initialFilters.material
      || initialFilters.finish || initialFilters.origin || initialFilters.certified,
  ));

  const setFilter = useCallback(
    (key: keyof ShopListState, value: string) => {
      if (key === "collection" && pinnedCollection) return;
      if (key === "sort") {
        const nextSort: ShopListState["sort"] = value
          ? (value as ShopListState["sort"])
          : "featured";
        setField("sort", nextSort);
        return;
      }
      if (key === "availability") {
        setField("availability", value === "in-stock" ? "in-stock" : undefined);
        return;
      }
      setField(key, (value || undefined) as never);
    },
    [pinnedCollection, setField],
  );

  const removeFilter = useCallback(
    (key: keyof ShopListState) => {
      if (key === "collection" && pinnedCollection) return;
      if (key === "sort") {
        setField("sort", "featured");
        return;
      }
      setField(key, undefined as never);
    },
    [pinnedCollection, setField],
  );

  const toListState = useCallback((next: ShopFilters): ShopListState => ({
    q: next.q,
    availability: next.availability,
    category: next.category,
    productType: next.productType,
    collection: next.collection,
    tag: next.tag,
    material: next.material,
    finish: next.finish,
    origin: next.origin,
    certified: next.certified,
    sort: next.sort ?? "featured",
  }), []);

  const clearAll = useCallback(() => {
    clearFiltersSession();
    setState(toListState(filtersWithoutSort(filters)));
  }, [filters, setState, toListState]);

  const chipFilters = pinnedCollection ? { ...filters, collection: undefined } : filters;
  const activeCount = countActiveFilters(chipFilters);

  const handleSearchChange = (value: string) => {
    setFieldDebounced("q", value.trim() || undefined);
  };

  const handleSearchClear = () => {
    setField("q", undefined);
    searchRef.current?.focus();
  };

  const sortOptions: FilterOption[] = [
    { value: "popular", label: t("shop.filters.popular") },
    { value: "newest", label: t("shop.filters.newest") },
    { value: "price-asc", label: t("shop.filters.priceAsc") },
    { value: "price-desc", label: t("shop.filters.priceDesc") },
    { value: "name-asc", label: t("shop.filters.nameAsc") },
  ];
  const availabilityOptions: FilterOption[] = [
    { value: "in-stock", label: t("shop.filters.inStock") },
  ];
  const showFinish = true;
  const showCompliance = supportsComplianceFilters();
  const showTags = supportsTagFilters();

  return (
    <div data-component="FilterBar" className="relative">
      {/* ── Desktop filter bar ──────────────────────────────────────────────── */}
      <div className="hidden border-y border-foreground/[0.08] bg-background/82 md:block">
        <div className="flex items-end justify-between gap-8 border-b border-foreground/[0.06] px-5 py-4 lg:px-6">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-couture-red">
              {text(labels?.eyebrow, "shop.filters.eyebrow")}
            </p>
            <RichText
              content={text(labels?.description, "shop.filters.description")}
              className="mt-1 max-w-xl text-sm leading-6 text-foreground/58"
            />
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
                {text(labels?.showing, "shop.filters.showing")}
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
              label={text(labels?.category, "shop.filters.category")}
              options={categories}
              value={filters.category ?? ""}
              onChange={(v) => setFilter("category", v)}
              allLabel={t("shop.filters.allCategories")}
            />
            <FilterDropdown
              label={text(labels?.productType, "shop.filters.productType")}
              options={productTypes}
              value={filters.productType ?? ""}
              onChange={(v) => setFilter("productType", v)}
              allLabel={t("shop.filters.allProductTypes")}
            />
            <FilterDropdown
              label={text(labels?.availability, "shop.filters.availability")}
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
              {advancedOpen ? t("shop.filters.less") : text(labels?.more, "shop.filters.more")}
              <ChevronDown className={cn("size-3 transition-transform", advancedOpen && "rotate-180")} aria-hidden="true" />
            </button>
          </div>

          {/* Boxed like FilterDropdown — underline + band border-y stacked as a double rule. */}
          <div className="relative flex w-[min(36vw,22rem)] min-w-[12rem] items-center border border-foreground/[0.1] bg-surface/45 transition-[border-color,background-color] focus-within:border-couture-red focus-within:bg-surface">
            <Search className="pointer-events-none absolute left-3 size-5 text-couture-red" weight="regular" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={text(labels?.searchPlaceholder, "shop.filters.searchPlaceholder")}
              aria-label={text(labels?.searchLabel, "shop.filters.searchLabel")}
              className={cn(
                "w-full min-w-0 bg-transparent py-2 pl-9 pr-11 text-[0.8rem] font-semibold uppercase tracking-[0.13em]",
                "placeholder:text-muted/42 outline-none transition-[color,border-color] duration-200",
                // Hide WebKit's native clear so only our custom X shows (Chrome/Safari).
                "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none",
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
            {showCollectionFilter ? (
              <FilterDropdown label={t("shop.filters.collection")} options={collections} value={filters.collection ?? ""} onChange={(v) => setFilter("collection", v)} allLabel={t("shop.filters.allCollections")} />
            ) : null}
            {showTags ? <FilterDropdown label={t("shop.filters.tag")} options={tags} value={filters.tag ?? ""} onChange={(v) => setFilter("tag", v)} allLabel={t("shop.filters.allTags")} /> : null}
            <FilterDropdown label={t("shop.filters.material")} options={materials} value={filters.material ?? ""} onChange={(v) => setFilter("material", v)} allLabel={t("shop.filters.allMaterials")} />
            {showFinish ? <FilterDropdown label={t("shop.filters.finish")} options={finishes} value={filters.finish ?? ""} onChange={(v) => setFilter("finish", v)} allLabel={t("shop.filters.allFinishes")} /> : null}
            <FilterDropdown label={t("shop.filters.origin")} options={origins} value={filters.origin ?? ""} onChange={(v) => setFilter("origin", v)} allLabel={t("shop.filters.allOrigins")} />
            {showCompliance ? <FilterDropdown label={t("shop.filters.compliance")} options={complianceOptions} value={filters.certified ?? ""} onChange={(v) => setFilter("certified", v)} allLabel={t("shop.filters.allCompliance")} /> : null}
          </div>
        ) : null}
      </div>

      {/* ── Mobile filter row ───────────────────────────────────────────────── */}
      <div className="md:hidden">
        <div className="relative flex items-center border-b border-foreground/[0.14]">
          <Search className="pointer-events-none absolute left-0 size-5 shrink-0 text-couture-red" weight="regular" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={text(labels?.searchPlaceholder, "shop.filters.searchPlaceholder")}
            aria-label={text(labels?.searchLabel, "shop.filters.searchLabel")}
            className={cn(
              "w-full min-w-0 bg-transparent py-3 pl-6 pr-11 text-[0.78rem] font-semibold uppercase tracking-[0.13em]",
              "placeholder:text-muted/42 outline-none",
              "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none",
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

        <span className="mt-3 flex justify-end whitespace-nowrap text-right text-[0.64rem] font-semibold uppercase tracking-[0.13em] text-muted/60 tabular-nums" aria-live="polite" aria-atomic="true">
          {plural("shop.filters.productCount", totalCount)}
        </span>

        <div className="mt-2 grid w-full grid-cols-2 divide-x divide-foreground/[0.1] border border-foreground/[0.12] bg-background/55">
          <FilterDropdown
            label={t("shop.filters.sort")}
            options={sortOptions}
            value={filters.sort && filters.sort !== "featured" ? filters.sort : ""}
            onChange={(value) => setFilter("sort", value)}
            allLabel={t("shop.filters.featured")}
            inactiveLabel={t("shop.filters.featured")}
            triggerVariant="toolbar"
            triggerIcon={<ArrowUpDown className="size-5 text-couture-red" weight="regular" />}
          />
          <button
            type="button"
            onClick={() => {
              setMobileSession((session) => session + 1);
              setMobileOpen(true);
            }}
            aria-label={`${t("shop.filters.filters")}${activeCount > 0 ? `, ${t("shop.filters.activeCount", { count: activeCount })}` : ""}`}
            className={cn(
              "relative inline-flex min-h-14 min-w-0 cursor-pointer items-center gap-3 px-3 text-left",
              "transition-[background-color,color,transform] duration-200 hover:bg-surface/70 active:scale-[0.97]",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent",
              activeCount > 0 ? "bg-couture-red/[0.045] text-couture-red" : "text-foreground",
            )}
          >
            <span className="inline-flex size-5 shrink-0 items-center justify-center text-muted" aria-hidden="true">
              <SlidersHorizontal className="size-5 text-couture-red" weight="regular" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-muted/65">
                {t("shop.filters.filters")}
              </span>
              <span className="mt-0.5 block truncate text-[0.7rem] font-semibold uppercase tracking-[0.12em]">
                {activeCount > 0
                  ? t("shop.filters.activeCount", { count: activeCount })
                  : t("shop.filters.all")}
              </span>
            </span>
          </button>
        </div>
      </div>

      {/* ── Active filter chips ──────────────────────────────────────────────── */}
      {activeCount > 0 && (
        <div className="mt-3">
          <FilterChips
            filters={chipFilters}
            categories={categories}
            productTypes={productTypes}
            collections={collections}
            tags={tags}
            materials={materials}
            finishes={finishes}
            origins={origins}
            onRemove={removeFilter}
            onClearAll={clearAll}
            labels={labels}
          />
        </div>
      )}

      {/* ── Mobile filter sheet ──────────────────────────────────────────────── */}
      <MobileFilterSheet
        key={mobileSession}
        open={mobileOpen}
        categories={categories}
        productTypes={productTypes}
        collections={showCollectionFilter ? collections : []}
        tags={tags}
        materials={materials}
        finishes={finishes}
        origins={origins}
        filters={filters}
        labels={labels}
        hideCollection={!showCollectionFilter}
        onApply={(next) => {
          setState(toListState(next));
          setMobileOpen(false);
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
  productTypes: FilterOption[];
  collections: FilterOption[];
  tags: FilterOption[];
  materials?: FilterOption[];
  finishes?: FilterOption[];
  origins?: FilterOption[];
  filters: ShopFilters;
  labels?: Partial<ShopFilterLabels>;
  hideCollection?: boolean;
  onApply: (f: ShopFilters) => void;
  onClose: () => void;
};

function MobileFilterSheet({
  open,
  categories,
  productTypes,
  collections,
  tags,
  materials = [],
  finishes = [],
  origins = [],
  filters,
  labels,
  hideCollection = false,
  onApply,
  onClose,
}: MobileFilterSheetProps) {
  const { t, plural } = useTranslations();
  const text = (value: string | undefined, key: string) => value?.trim() || t(key);
  const [local, setLocal] = useState<ShopFilters>(filters);

  const localActiveCount = countActiveFilters(
    hideCollection ? { ...local, collection: undefined } : local,
  );

  const sections: { key: keyof ShopFilters; label: string; options: FilterOption[] }[] = [
    { key: "category", label: text(labels?.category, "shop.filters.category"), options: categories },
    { key: "productType", label: text(labels?.productType, "shop.filters.productType"), options: productTypes },
    { key: "availability", label: text(labels?.availability, "shop.filters.availability"), options: [{ value: "in-stock", label: t("shop.filters.inStock") }] },
    ...(!hideCollection
      ? [{ key: "collection" as const, label: t("shop.filters.collection"), options: collections }]
      : []),
    ...(supportsTagFilters()
      ? [{ key: "tag" as const, label: t("shop.filters.tag"), options: tags }]
      : []),
    { key: "material", label: t("shop.filters.material"), options: materials },
    { key: "finish", label: t("shop.filters.finish"), options: finishes },
    { key: "origin", label: t("shop.filters.origin"), options: origins },
    ...(supportsComplianceFilters()
      ? [{ key: "certified" as const, label: t("shop.filters.compliance"), options: shopComplianceOptions(t) }]
      : []),
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
                      {opt.hint && (
                        <span className="ml-1.5 normal-case tracking-normal text-muted/55">{opt.hint}</span>
                      )}
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
