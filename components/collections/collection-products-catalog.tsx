"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "motion/react";

import { FilterBar, type FilterBarProps } from "@/components/shop/filter-bar";
import { ShopCatalogClient, type InitialCatalogPage } from "@/components/shop/shop-catalog-client";
import { buildSearchParams, type ShopFilters } from "@/components/shop/types";
import { useTranslations } from "@/lib/i18n/context";
import { localePath } from "@/lib/i18n/routing";

const ease = [0.22, 1, 0.36, 1] as const;

export type CollectionProductsCatalogProps = {
  collectionName: string;
  /** Public storefront path for this collection, e.g. `/collections/pearls`. */
  collectionPath: string;
  /** Canonical EN collection slug used by catalog filters / featured order. */
  collectionSourceSlug: string;
  initialPage: InitialCatalogPage;
  filterProps: Omit<FilterBarProps, "totalCount" | "basePath" | "pinnedFilters" | "onFiltersChange">;
};

export function CollectionProductsCatalog({
  collectionName,
  collectionPath,
  collectionSourceSlug,
  initialPage,
  filterProps,
}: CollectionProductsCatalogProps) {
  const { locale } = useTranslations();
  const headerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(headerRef, { once: true, margin: "-8%" });
  const pinnedFilters = { collection: collectionSourceSlug } as const;
  const [activeFilters, setActiveFilters] = useState<ShopFilters>(filterProps.initialFilters);
  const [totalCount, setTotalCount] = useState(initialPage.totalCount);

  const selectFilters = (filters: ShopFilters) => {
    const next = { ...filters, collection: collectionSourceSlug };
    setActiveFilters(next);
    const forUrl = { ...next, collection: undefined };
    const qs = buildSearchParams(forUrl);
    window.history.pushState(
      null,
      "",
      localePath(locale, qs ? `${collectionPath}?${qs}` : collectionPath),
    );
  };

  return (
    <section data-component="CollectionProductsCatalog" className="bg-surface py-20 md:py-36">
      <div className="site-shell">
        <div
          ref={headerRef}
          className="mb-10 flex flex-col gap-4 md:mb-14 md:flex-row md:items-end md:justify-between"
        >
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease }}
          >
            <p className="label-mono mb-3 text-muted-ink">Catalogue / {collectionName}</p>
            <h2 className="font-serif" style={{ fontSize: "clamp(2rem,4vw,3rem)" }}>
              Products in this Collection
            </h2>
          </motion.div>
        </div>

        <motion.div
          className="mb-8 md:mb-10"
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease, delay: 0.12 }}
        >
          <FilterBar
            {...filterProps}
            initialFilters={activeFilters}
            totalCount={totalCount}
            onFiltersChange={setActiveFilters}
            basePath={collectionPath}
            pinnedFilters={pinnedFilters}
          />
        </motion.div>

        <div id="shop-products">
          <ShopCatalogClient
            initialPage={initialPage}
            filters={activeFilters}
            onSelectFilters={selectFilters}
            categories={filterProps.categories}
            productTypes={filterProps.productTypes}
            collections={filterProps.collections}
            tags={filterProps.tags}
            onTotalCountChange={setTotalCount}
            basePath={collectionPath}
            pinnedFilters={pinnedFilters}
          />
        </div>
      </div>
    </section>
  );
}
