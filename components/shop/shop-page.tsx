"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { motion, useInView } from "motion/react";

import { PrimaryCtaButton } from "@/components/ui";
import { FilterBar, type FilterBarProps } from "./filter-bar";
import { buildSearchParams, type ShopFilters } from "./types";
import { ShopDiscovery, type ShopProductTypeTile } from "./shop-discovery";
import { ShopCatalogClient, type InitialCatalogPage } from "./shop-catalog-client";
import type { ShopListingProduct } from "@/lib/content/shop-listing";
import { useTranslations } from "@/lib/i18n/context";
import { localePath } from "@/lib/i18n/routing";
import { splitHeroTitleAccent } from "@/lib/content/service-page-defaults";

const ease = [0.22, 1, 0.36, 1] as const;

export function ShopHero({
  heroImage,
  title,
  description,
  archiveCount,
}: {
  heroImage?: string;
  title: string;
  description: string;
  archiveCount: number;
}) {
  const { t, plural } = useTranslations();
  const { lead, accent } = splitHeroTitleAccent(title);

  return (
    <header data-component="ShopHero"
      className="shop-hero relative flex min-h-[72svh] items-end overflow-hidden bg-background px-5 pb-10 pt-24 text-foreground md:min-h-[82svh] md:px-[8vw] md:pb-16 md:pt-32"
    >
      {heroImage ? (
        <div
          data-testid="shop-hero-media"
          className="absolute inset-0 overflow-hidden bg-charcoal"
        >
          <Image
            src={heroImage}
            alt=""
            fill
            preload
            quality={75}
            sizes="100vw"
            className="shop-hero-image object-cover object-[62%_center] md:object-center"
          />
        </div>
      ) : null}

      <div className="shop-hero-image-overlay pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative z-10 w-full max-w-[46rem]">
        <h1 className="max-w-[9ch] text-balance font-serif text-[clamp(3.6rem,8vw,6rem)] uppercase leading-[0.84] tracking-[-0.035em] text-foreground">
          {lead ? `${lead} ` : null}<span className="font-light italic text-couture-red">{accent}</span>
        </h1>

        <p className="mt-6 max-w-[36rem] text-pretty font-sans text-sm font-medium leading-relaxed text-foreground/72 md:mt-7 md:text-base">
          {description}
        </p>

        <div className="mt-7 flex flex-wrap gap-x-10 gap-y-3 border-t border-foreground/20 pt-5 font-sans text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-foreground/65 md:mt-9">
          <span><strong className="mr-2 text-couture-red">{String(archiveCount).padStart(2, "0")}</strong>{plural("shop.availableCount", archiveCount)}</span>
          <span>{t("shop.selectionPromise")}</span>
        </div>
      </div>
    </header>
  );
}

/* ─── Filter section ─────────────────────────────────────────────── */
function FilterSection({
  filterProps,
  totalCount,
}: {
  filterProps: Omit<FilterBarProps, "totalCount">;
  totalCount: number;
}) {
  return (
    <motion.div
      className="mb-8 md:mb-10"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease, delay: 0.2 }}
    >
      <FilterBar {...filterProps} totalCount={totalCount} />
    </motion.div>
  );
}

/* ─── Shop CTA footer ────────────────────────────────────────────── */
function ShopFooter({
  eyebrow,
  title,
  ctaLabel,
  secondaryLabel,
}: {
  eyebrow?: string;
  title?: string;
  ctaLabel?: string;
  secondaryLabel?: string;
}) {
  const { t, locale } = useTranslations();
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <div data-component="ShopFooter"
      ref={ref}
      className="relative mt-24 overflow-hidden border-t border-foreground/[0.06] bg-surface py-16 md:mt-32 md:py-24"
    >
      {/* Ghost text */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <span
          className="select-none font-serif leading-none text-foreground"
          style={{ fontSize: "clamp(5rem,18vw,14rem)", opacity: 0.025, whiteSpace: "nowrap" }}
        >
          ARCHIVE
        </span>
      </div>

      <div className="site-shell relative z-10 flex flex-col items-center gap-8 text-center">
        <motion.div
          className="flex items-center gap-5"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.7, ease }}
        >
          <div className="h-px w-14 bg-foreground/15" />
          <div className="h-2 w-2 rotate-45 border border-couture-red" />
          <div className="h-px w-14 bg-foreground/15" />
        </motion.div>

        <motion.p
          className="label-mono text-couture-red"
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease, delay: 0.1 }}
        >
          {eyebrow || t("shop.footerCta.eyebrow")}
        </motion.p>

        <motion.h2
          className="max-w-xl font-serif leading-[1.05]"
          style={{ fontSize: "clamp(1.8rem,4vw,3.2rem)" }}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.85, ease, delay: 0.18 }}
        >
          {title || t("shop.footerCta.title")}
        </motion.h2>

        <motion.div
          className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5"
          initial={{ opacity: 0, y: 14 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease, delay: 0.28 }}
        >
          <PrimaryCtaButton href={localePath(locale, "/collections")}>
            {ctaLabel || t("shop.footerCta.collections")}
          </PrimaryCtaButton>

          <Link
            href={localePath(locale, "/about")}
            className="label-mono border-b border-foreground/20 pb-1 text-foreground/60 transition-colors hover:border-couture-red hover:text-couture-red"
          >
            {secondaryLabel || t("shop.footerCta.story")}
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

/* ─── Root ───────────────────────────────────────────────────────── */
export type ShopPageProps = {
  initialPage: InitialCatalogPage;
  newestProducts: ShopListingProduct[];
  popularProducts: ShopListingProduct[];
  showPopular: boolean;
  heroImage?: string;
  heroTitle: string;
  heroDescription: string;
  archiveCount: number;
  filterProps: Omit<FilterBarProps, "totalCount">;
  productTypeTiles: ShopProductTypeTile[];
  collectionsCalloutEyebrow?: string;
  collectionsCalloutTitle?: string;
  collectionsCalloutCtaLabel?: string;
  collectionsCalloutSecondaryLabel?: string;
};

export function ShopPage({
  initialPage,
  newestProducts,
  popularProducts,
  showPopular,
  heroImage,
  heroTitle,
  heroDescription,
  archiveCount,
  filterProps,
  productTypeTiles,
  collectionsCalloutEyebrow,
  collectionsCalloutTitle,
  collectionsCalloutCtaLabel,
  collectionsCalloutSecondaryLabel,
}: ShopPageProps) {
  const { t, locale } = useTranslations();
  const [activeFilters, setActiveFilters] = useState<ShopFilters>(filterProps.initialFilters);
  const [totalCount, setTotalCount] = useState(initialPage.totalCount);
  const selectDiscoveryFilters = (filters: ShopFilters) => {
    setActiveFilters(filters);
    const qs = buildSearchParams(filters);
    window.history.pushState(null, "", `${localePath(locale, qs ? `/shop?${qs}` : "/shop")}#shop-products`);
    window.requestAnimationFrame(() => {
      document.getElementById("shop-products")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  return (
    <main data-component="ShopPage"
      className="shop-experience artifact-shell min-h-screen overflow-x-hidden bg-background text-foreground selection:bg-couture-red selection:text-white"
    >
      <ShopHero heroImage={heroImage} title={heroTitle} description={heroDescription} archiveCount={archiveCount} />

      <ShopDiscovery
        newestProducts={newestProducts}
        popularProducts={popularProducts}
        showPopular={showPopular}
        productTypes={productTypeTiles}
        onSelectFilters={selectDiscoveryFilters}
      />

      <div className="relative bg-background pb-16 pt-6 md:pb-24 md:pt-14">
        <h2 className="sr-only">{t("shop.resultsHeading")}</h2>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "clamp(52px, 7vw, 104px) clamp(52px, 7vw, 104px)",
          }}
          aria-hidden="true"
        />
        <div className="site-shell">
          <FilterSection
            filterProps={{
              ...filterProps,
              initialFilters: activeFilters,
              onFiltersChange: setActiveFilters,
            }}
            totalCount={totalCount}
          />

          <ShopCatalogClient
            initialPage={initialPage}
            filters={activeFilters}
            onSelectFilters={selectDiscoveryFilters}
            categories={filterProps.categories}
            productTypes={filterProps.productTypes}
            collections={filterProps.collections}
            tags={filterProps.tags}
            onTotalCountChange={setTotalCount}
          />
        </div>
      </div>

      <ShopFooter
        eyebrow={collectionsCalloutEyebrow}
        title={collectionsCalloutTitle}
        ctaLabel={collectionsCalloutCtaLabel}
        secondaryLabel={collectionsCalloutSecondaryLabel}
      />
    </main>
  );
}
