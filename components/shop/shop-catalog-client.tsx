"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useInView, useReducedMotion } from "motion/react";

import { ProductCard } from "@/components/ui/product-card";
import type { ShopListingProduct } from "@/lib/content/shop-listing";
import { useTranslations } from "@/lib/i18n/context";
import { localePath } from "@/lib/i18n/routing";
import {
  getMemoryView,
  getPersistedView,
  saveView,
  type CatalogViewAnchor,
  type CatalogViewSnapshot,
} from "@/lib/catalog/catalog-view-cache";
import { buildSearchParams, type FilterOption, type ShopFilters } from "./types";

const ease = [0.22, 1, 0.36, 1] as const;

/** JSON shape returned by GET /api/catalog/products (Dates arrive as strings; nothing here reads them client-side). */
type CatalogPageResponse = {
  nodes: ShopListingProduct[];
  hasNextPage: boolean;
  endCursor: string | null;
  totalCount: number;
  popularAvailable: boolean;
};

export type InitialCatalogPage = Omit<CatalogPageResponse, "popularAvailable">;

const fingerprintOf = (filters: ShopFilters) => buildSearchParams(filters);

async function fetchCatalogPage(
  filters: ShopFilters,
  locale: string,
  cursor: string | null,
  signal: AbortSignal,
): Promise<CatalogPageResponse> {
  const params = new URLSearchParams(fingerprintOf(filters));
  params.set("locale", locale);
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(`/api/catalog/products?${params.toString()}`, { signal });
  if (!response.ok) throw new Error(`catalog fetch failed: ${response.status}`);
  return response.json() as Promise<CatalogPageResponse>;
}

type CatalogState = {
  fingerprint: string;
  nodes: ShopListingProduct[];
  hasNextPage: boolean;
  endCursor: string | null;
  totalCount: number;
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
};

/* ─── Empty state ────────────────────────────────────────────────── */
type EmptyStateProps = {
  filters: ShopFilters;
  categories: FilterOption[];
  productTypes?: FilterOption[];
  collections: FilterOption[];
  tags: FilterOption[];
  basePath?: string;
  pinnedFilters?: Pick<ShopFilters, "collection">;
};

const labelOf = (value: string, opts: FilterOption[]) =>
  opts.find((o) => o.value === value)?.label ?? value;

function EmptyState({
  filters,
  categories,
  productTypes = [],
  collections,
  tags,
  onSelectFilters,
  basePath = "/shop",
  pinnedFilters,
}: EmptyStateProps & { onSelectFilters: (filters: ShopFilters) => void }) {
  const { t, locale } = useTranslations();
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const pinnedCollection = pinnedFilters?.collection;
  const dim: Record<keyof ShopFilters, string> = {
    q: t("shop.filters.searchLabel"), availability: t("shop.filters.availability"), category: t("shop.filters.category"), productType: t("shop.filters.productType"), collection: t("shop.filters.collection"), tag: t("shop.filters.tag"),
    material: t("shop.filters.material"), finish: t("shop.filters.finish"), origin: t("shop.filters.origin"), certified: t("shop.filters.certification"), sort: t("shop.filters.sort"),
  };

  const applyPinned = (next: ShopFilters): ShopFilters => (
    pinnedCollection ? { ...next, collection: pinnedCollection } : next
  );

  const hrefFor = (next: ShopFilters) => {
    const forUrl = pinnedCollection ? { ...next, collection: undefined } : next;
    const qs = buildSearchParams(forUrl);
    return `${localePath(locale, qs ? `${basePath}?${qs}` : basePath)}#shop-products`;
  };

  const active: { key: keyof ShopFilters; label: string; nextFilters: ShopFilters }[] = [];
  if (filters.q) active.push({ key: "q", label: `"${filters.q}"`, nextFilters: applyPinned({ ...filters, q: undefined }) });
  if (filters.availability) active.push({ key: "availability", label: t("shop.filters.inStock"), nextFilters: applyPinned({ ...filters, availability: undefined }) });
  if (filters.category) active.push({ key: "category", label: labelOf(filters.category, categories), nextFilters: applyPinned({ ...filters, category: undefined }) });
  if (filters.productType) active.push({ key: "productType", label: labelOf(filters.productType, productTypes), nextFilters: applyPinned({ ...filters, productType: undefined }) });
  if (filters.collection && !pinnedCollection) active.push({ key: "collection", label: labelOf(filters.collection, collections), nextFilters: { ...filters, collection: undefined } });
  if (filters.tag) active.push({ key: "tag", label: labelOf(filters.tag, tags), nextFilters: applyPinned({ ...filters, tag: undefined }) });

  return (
    <motion.div
      ref={ref}
      className="panel flex flex-col items-start gap-8 p-8 md:p-12"
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease }}
    >
      <div className="flex items-center gap-4">
        <div className="h-px w-12 bg-foreground/15" />
        <div className="h-2 w-2 rotate-45 border border-couture-red" />
        <div className="h-px w-12 bg-foreground/15" />
      </div>

      <div>
        <p className="label-mono mb-3 text-couture-red">{t("shop.empty.count")}</p>
        <h2 className="font-serif text-[1.8rem] md:text-[2.2rem]">
          {t("shop.empty.noMatch")}
        </h2>
        <p className="mt-3 max-w-xl text-base leading-[1.85] text-foreground/55">
          {t("shop.empty.noMatchBody")}
        </p>
      </div>

      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-mono text-[0.7rem] text-muted/60 mr-1">{t("shop.empty.active")}</span>
          {active.map((f) => (
            <Link
              key={f.key}
              href={hrefFor(f.nextFilters)}
              onClick={(event) => {
                event.preventDefault();
                onSelectFilters(f.nextFilters);
              }}
              className="inline-flex items-center gap-0 border border-stroke overflow-hidden transition-colors hover:border-foreground/30 group"
            >
              <span className="label-mono text-[0.65rem] text-muted/50 px-2 py-1.5 border-r border-stroke">
                {dim[f.key]}
              </span>
              <span className="label-mono text-foreground/70 px-2.5 py-1.5 group-hover:text-foreground transition-colors">
                {f.label}
              </span>
              <span className="px-2 py-1.5 text-muted/40 group-hover:text-couture-red transition-colors label-mono text-[0.7rem]">
                ✕
              </span>
            </Link>
          ))}
        </div>
      )}

      <Link
        href={hrefFor(applyPinned({}))}
        onClick={(event) => {
          event.preventDefault();
          onSelectFilters(applyPinned({}));
        }}
        className="inline-flex min-h-11 items-center bg-foreground px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-background transition-colors hover:bg-couture-red hover:text-white"
      >
        {t("shop.empty.showAll")}
      </Link>
    </motion.div>
  );
}

/* ─── Product grid ───────────────────────────────────────────────── */
function ProductGrid({ products, sort }: { products: ShopListingProduct[]; sort?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-6%" });
  const reduceMotion = useReducedMotion() ?? false;

  function offsetClass(index: number) {
    if (index === 2) return "lg:mt-16";
    if (index === 3) return "lg:-mt-16";
    return undefined;
  }

  return (
    <motion.div
      id="shop-product-grid"
      ref={ref}
      layout
      className="grid grid-cols-1 gap-x-4 gap-y-10 sm:grid-cols-2 md:gap-x-6 md:gap-y-20 lg:grid-cols-3"
      transition={{ layout: reduceMotion ? { duration: 0 } : { duration: 0.52, ease } }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {products.map((product, index) => {
          const isFeatured = (sort === undefined || sort === "featured") && index === 0;
          return (
            <motion.div
              layout
              key={product.id}
              data-product-id={product.id}
              className={`${isFeatured ? "sm:col-span-2 lg:col-span-2" : ""} ${offsetClass(index) ?? ""}`}
              initial={reduceMotion ? false : { opacity: 0, y: 22, scale: 0.985, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.985, filter: "blur(4px)" }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      layout: { duration: 0.52, ease },
                      opacity: { duration: 0.24, ease },
                      y: { duration: 0.42, ease },
                      scale: { duration: 0.42, ease },
                      filter: { duration: 0.28, ease },
                    }
              }
            >
              <ProductCard product={product} index={index} isFeatured={isFeatured} isParentInView={isInView} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Root ───────────────────────────────────────────────────────── */
export type ShopCatalogClientProps = {
  initialPage: InitialCatalogPage;
  filters: ShopFilters;
  onSelectFilters: (filters: ShopFilters) => void;
  categories: FilterOption[];
  productTypes?: FilterOption[];
  collections: FilterOption[];
  tags: FilterOption[];
  onTotalCountChange?: (count: number) => void;
  basePath?: string;
  pinnedFilters?: Pick<ShopFilters, "collection">;
};

export function ShopCatalogClient({
  initialPage,
  filters,
  onSelectFilters,
  categories,
  productTypes,
  collections,
  tags,
  onTotalCountChange,
  basePath = "/shop",
  pinnedFilters,
}: ShopCatalogClientProps) {
  const { t, locale } = useTranslations();
  // Checked synchronously (not in an effect) so a same-tab Back from a PDP
  // — the common case, since the module-level memory cache survives that
  // client-side navigation — restores straight into the first paint instead
  // of flashing SSR's page-1 first.
  const initialViewKey = `${locale}|${fingerprintOf(filters)}`;
  const initialMemoryHit = getMemoryView(initialViewKey);
  const [state, setState] = useState<CatalogState>(() => (initialMemoryHit
    ? {
        fingerprint: fingerprintOf(filters),
        nodes: initialMemoryHit.nodes,
        hasNextPage: initialMemoryHit.hasNextPage,
        endCursor: initialMemoryHit.endCursor,
        totalCount: initialMemoryHit.totalCount,
        loading: false,
        loadingMore: false,
        error: false,
      }
    : {
        fingerprint: fingerprintOf(filters),
        nodes: initialPage.nodes,
        hasNextPage: initialPage.hasNextPage,
        endCursor: initialPage.endCursor,
        totalCount: initialPage.totalCount,
        loading: false,
        loadingMore: false,
        error: false,
      }));

  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const targetFilters = useMemo(() => filters, [filters]);
  const viewKeyOf = useCallback((f: ShopFilters) => `${locale}|${fingerprintOf(f)}`, [locale]);
  const mountViewKeyRef = useRef(initialViewKey);

  // Gates the sentinel while a scroll anchor still needs restoring, so a
  // short restored list sitting near the sentinel doesn't immediately
  // trigger an unwanted extra page load before the user sees where they
  // left off. Only true by default when the memory cache already answered
  // that synchronously — a plain cold mount doesn't wait on the IndexedDB
  // round-trip below; that only matters for "reloaded after a deep scroll",
  // and the effect re-gates the sentinel if that check comes back with an anchor.
  const [restoring, setRestoring] = useState(() => Boolean(initialMemoryHit?.anchor));
  const [anchorToRestore, setAnchorToRestore] = useState<CatalogViewAnchor | null>(() => initialMemoryHit?.anchor ?? null);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const restoringRef = useRef(restoring);
  useEffect(() => { restoringRef.current = restoring; }, [restoring]);

  const persistCurrentView = useCallback((anchor: CatalogViewAnchor | null) => {
    if (restoringRef.current) return;
    const current = stateRef.current;
    if (current.nodes.length === 0) return;
    const snapshot: CatalogViewSnapshot = {
      viewKey: viewKeyOf(targetFilters),
      savedAt: Date.now(),
      nodes: current.nodes,
      endCursor: current.endCursor,
      hasNextPage: current.hasNextPage,
      totalCount: current.totalCount,
      anchor,
    };
    saveView(snapshot);
  }, [targetFilters, viewKeyOf]);

  const applySnapshot = useCallback((fp: string, snapshot: CatalogViewSnapshot) => {
    setState({
      fingerprint: fp,
      nodes: snapshot.nodes,
      hasNextPage: snapshot.hasNextPage,
      endCursor: snapshot.endCursor,
      totalCount: snapshot.totalCount,
      loading: false,
      loadingMore: false,
      error: false,
    });
    setAnchorToRestore(snapshot.anchor);
    setRestoring(Boolean(snapshot.anchor));
  }, []);

  const runFetch = useCallback((mode: "reset" | "append", cursor: string | null) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;
    const fp = fingerprintOf(targetFilters);

    setState((prev) => (mode === "reset"
      ? { ...prev, loading: true, error: false }
      : { ...prev, loadingMore: true, error: false }));

    fetchCatalogPage(targetFilters, locale, cursor, controller.signal).then((page) => {
      if (requestIdRef.current !== requestId) return;
      const prev = stateRef.current;
      const next: CatalogState = mode === "reset"
        ? {
            fingerprint: fp,
            nodes: page.nodes,
            hasNextPage: page.hasNextPage,
            endCursor: page.endCursor,
            totalCount: page.totalCount,
            loading: false,
            loadingMore: false,
            error: false,
          }
        : (() => {
            const seen = new Set(prev.nodes.map((node) => node.id));
            return {
              ...prev,
              nodes: [...prev.nodes, ...page.nodes.filter((node) => !seen.has(node.id))],
              hasNextPage: page.hasNextPage,
              endCursor: page.endCursor,
              totalCount: page.totalCount,
              loadingMore: false,
            };
          })();
      setState(next);
      saveView({
        viewKey: viewKeyOf(targetFilters),
        savedAt: Date.now(),
        nodes: next.nodes,
        endCursor: next.endCursor,
        hasNextPage: next.hasNextPage,
        totalCount: next.totalCount,
        anchor: null,
      });
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (requestIdRef.current !== requestId) return;
      setState((prev) => ({ ...prev, loading: false, loadingMore: false, error: true }));
    });
  }, [targetFilters, locale, viewKeyOf]);

  // A filter/sort/search change (from FilterBar, EmptyState, discovery links
  // or browser back/forward) always lands here as a new `filters` prop.
  // Restore a cached view for it (memory first — a same-tab Next.js Link
  // navigation to a PDP and back survives in the module-level cache even
  // though this component unmounts — then IndexedDB for a same-tab reload)
  // before falling back to a fresh page-1 fetch.
  useEffect(() => {
    const fp = fingerprintOf(targetFilters);
    const viewKey = viewKeyOf(targetFilters);
    const isMountEntryPoint = fp === state.fingerprint && viewKey === mountViewKeyRef.current;
    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();

    const memoryHit = getMemoryView(viewKey);
    if (memoryHit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      applySnapshot(fp, memoryHit);
      return;
    }

    if (!isMountEntryPoint) {
      setRestoring(true);
      setState((prev) => ({ ...prev, loading: true, error: false }));
    }

    getPersistedView(viewKey).then((persistedHit) => {
      if (requestIdRef.current !== requestId) return;
      if (persistedHit) {
        applySnapshot(fp, persistedHit);
      } else if (isMountEntryPoint) {
        // SSR's initialPage is already showing and valid — nothing more to restore.
        setRestoring(false);
      } else {
        runFetch("reset", null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetFilters]);

  useEffect(() => {
    onTotalCountChange?.(state.totalCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.totalCount]);

  // Once a restored page has actually painted, scroll the anchor card back
  // to where the user left it — recomputed from the live DOM (not a stored
  // pixel offset alone), since image loads and viewport width can shift
  // layout between visits. Two rAFs: one for the DOM update, one for layout.
  useEffect(() => {
    if (!anchorToRestore) return;
    let cancelled = false;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (cancelled) return;
        const grid = document.getElementById("shop-product-grid");
        const target = grid?.querySelector(`[data-product-id="${CSS.escape(anchorToRestore.productId)}"]`);
        if (target) {
          const rect = target.getBoundingClientRect();
          window.scrollTo({ top: window.scrollY + rect.top - anchorToRestore.offsetPx });
        }
        setAnchorToRestore(null);
        setRestoring(false);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [anchorToRestore, state.nodes]);

  // Tracks the topmost visible card (throttled to one measurement per
  // frame) so a page reload or same-tab return can scroll back to it.
  useEffect(() => {
    let pending = false;
    const computeAnchor = (): CatalogViewAnchor | null => {
      if (typeof document.elementFromPoint !== "function") return null; // not implemented in every test/embedded environment
      const readY = 160;
      const el = document.elementFromPoint(window.innerWidth / 2, readY)?.closest<HTMLElement>("[data-product-id]");
      if (!el?.dataset.productId) return null;
      return { productId: el.dataset.productId, offsetPx: el.getBoundingClientRect().top - readY };
    };
    const onScroll = () => {
      if (pending || restoringRef.current) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        persistCurrentView(computeAnchor());
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      persistCurrentView(computeAnchor()); // final flush before this view goes away (e.g. navigating to a PDP)
    };
  }, [persistCurrentView]);

  const loadMore = useCallback(() => {
    if (state.loading || state.loadingMore || !state.hasNextPage) return;
    runFetch("append", state.endCursor);
  }, [state.loading, state.loadingMore, state.hasNextPage, state.endCursor, runFetch]);

  const retry = useCallback(() => {
    if (state.nodes.length === 0) runFetch("reset", null);
    else runFetch("append", state.endCursor);
  }, [state.nodes.length, state.endCursor, runFetch]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !state.hasNextPage || restoring) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore();
    }, { rootMargin: "800px 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [state.hasNextPage, restoring, loadMore]);

  const liveMessage = state.loading
    ? t("shop.catalog.loading")
    : state.loadingMore
      ? t("shop.catalog.loadingMore")
      : state.error
        ? t("shop.catalog.error")
        : !state.hasNextPage && state.nodes.length > 0
          ? t("shop.catalog.allLoaded")
          : "";

  return (
    <div id="shop-products" className="scroll-mt-24">
      <div aria-live="polite" role="status" className="sr-only">{liveMessage}</div>
      <LayoutGroup id="shop-results">
        <AnimatePresence mode="wait" initial={false}>
          {state.nodes.length === 0 && !state.loading ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 18, filter: "blur(5px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
              transition={{ duration: 0.34, ease }}
            >
              {state.error ? (
                <div className="panel flex flex-col items-start gap-5 p-8 md:p-12">
                  <p className="font-serif text-[1.6rem]">{t("shop.catalog.error")}</p>
                  <button
                    type="button"
                    onClick={retry}
                    className="inline-flex min-h-11 items-center bg-foreground px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-background transition-colors hover:bg-couture-red hover:text-white"
                  >
                    {t("shop.catalog.retry")}
                  </button>
                </div>
              ) : (
                <EmptyState
                  filters={filters}
                  categories={categories}
                  productTypes={productTypes}
                  collections={collections}
                  tags={tags}
                  onSelectFilters={onSelectFilters}
                  basePath={basePath}
                  pinnedFilters={pinnedFilters}
                />
              )}
            </motion.div>
          ) : (
            <ProductGrid key={state.fingerprint} products={state.nodes} sort={filters.sort} />
          )}
        </AnimatePresence>
      </LayoutGroup>

      {state.nodes.length > 0 && (
        <div ref={sentinelRef} className="mt-12 flex flex-col items-center gap-3">
          {state.error ? (
            <>
              <p className="text-sm text-foreground/60">{t("shop.catalog.error")}</p>
              <button
                type="button"
                onClick={retry}
                className="min-h-11 border border-foreground/30 px-8 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground transition-colors hover:border-couture-red hover:text-couture-red"
              >
                {t("shop.catalog.retry")}
              </button>
            </>
          ) : state.hasNextPage ? (
            <button
              type="button"
              aria-controls="shop-product-grid"
              onClick={loadMore}
              disabled={state.loadingMore}
              className="min-h-11 border border-foreground/30 px-8 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground transition-colors hover:border-couture-red hover:text-couture-red disabled:opacity-50"
            >
              {state.loadingMore ? t("shop.catalog.loadingMore") : t("shop.loadMoreProducts")}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
