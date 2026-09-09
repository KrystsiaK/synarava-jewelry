"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";

import { ProductCard } from "@/components/ui/product-card";
import { PrimaryCtaButton } from "@/components/ui";
import { FilterBar, type FilterBarProps } from "./filter-bar";
import { buildSearchParams, type FilterOption, type ShopFilters } from "./types";
import type { ProductSummary } from "@/lib/content/catalog";
import { useTranslations } from "@/lib/i18n/context";
import { localePath } from "@/lib/i18n/routing";

const ease = [0.22, 1, 0.36, 1] as const;

export function ShopHero({
  leadProduct,
  archiveCount,
}: {
  leadProduct?: ProductSummary;
  archiveCount: number;
}) {
  const { t, plural } = useTranslations();

  return (
    <header data-component="ShopHero"
      className="shop-hero relative flex min-h-[72svh] items-end overflow-hidden bg-background px-5 pb-10 pt-24 text-foreground md:min-h-[82svh] md:px-[8vw] md:pb-16 md:pt-32"
    >
      {leadProduct ? (
        <div
          data-testid="shop-hero-media"
          className="absolute inset-0 overflow-hidden bg-charcoal"
        >
          <Image
            src={leadProduct.image}
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
          {t("shop.heroTitleLead")} <span className="font-light italic text-couture-red">{t("shop.heroTitleAccent")}</span>
        </h1>

        <p className="mt-6 max-w-[36rem] text-pretty font-sans text-sm font-medium leading-relaxed text-foreground/72 md:mt-7 md:text-base">
          {t("shop.heroDescription")}
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

/* ─── Empty state ────────────────────────────────────────────────── */
type EmptyStateProps = {
  filters: ShopFilters;
  departments?: FilterOption[];
  categories: FilterOption[];
  collections: FilterOption[];
  tags: FilterOption[];
};

const labelOf = (value: string, opts: FilterOption[]) =>
  opts.find((o) => o.value === value)?.label ?? value;

function EmptyState({ filters, departments = [], categories, collections, tags }: EmptyStateProps) {
  const { t, locale } = useTranslations();
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const isDepartmentLanding = Boolean(filters.department) && ![
    filters.q,
    filters.availability,
    filters.category,
    filters.collection,
    filters.tag,
    filters.material,
    filters.finish,
    filters.origin,
    filters.certified,
  ].some(Boolean);
  const departmentName = filters.department ? labelOf(filters.department, departments) : t("shop.empty.thisDepartment");
  const dim: Record<keyof ShopFilters, string> = {
    q: t("shop.filters.searchLabel"), department: t("shop.filters.department"), availability: t("shop.filters.availability"), category: t("shop.filters.category"), collection: t("shop.filters.collection"), tag: t("shop.filters.tag"),
    material: t("shop.filters.material"), finish: t("shop.filters.finish"), origin: t("shop.filters.origin"), certified: t("shop.filters.certification"), sort: t("shop.filters.sort"),
  };

  /* Active filter chips with remove-one URLs */
  const active: { key: keyof ShopFilters; label: string; removeHref: string }[] = [];
  if (filters.q) {
    const next = { ...filters, q: undefined };
    active.push({ key: "q", label: `"${filters.q}"`, removeHref: `/shop?${buildSearchParams(next)}` });
  }
  if (filters.department) {
    const next = { ...filters, department: undefined };
    active.push({ key: "department", label: labelOf(filters.department, departments), removeHref: `/shop?${buildSearchParams(next)}` });
  }
  if (filters.availability) {
    const next = { ...filters, availability: undefined };
    active.push({ key: "availability", label: t("shop.filters.inStock"), removeHref: `/shop?${buildSearchParams(next)}` });
  }
  if (filters.category) {
    const next = { ...filters, category: undefined };
    active.push({ key: "category", label: labelOf(filters.category, categories), removeHref: `/shop?${buildSearchParams(next)}` });
  }
  if (filters.collection) {
    const next = { ...filters, collection: undefined };
    active.push({ key: "collection", label: labelOf(filters.collection, collections), removeHref: `/shop?${buildSearchParams(next)}` });
  }
  if (filters.tag) {
    const next = { ...filters, tag: undefined };
    active.push({ key: "tag", label: labelOf(filters.tag, tags), removeHref: `/shop?${buildSearchParams(next)}` });
  }

  return (
    <motion.div
      ref={ref}
      className="panel flex flex-col items-start gap-8 p-8 md:p-12"
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease }}
    >
      {/* Ornament */}
      <div className="flex items-center gap-4">
        <div className="h-px w-12 bg-foreground/15" />
        <div className="h-2 w-2 rotate-45 border border-couture-red" />
        <div className="h-px w-12 bg-foreground/15" />
      </div>

      <div>
        <p className="label-mono mb-3 text-couture-red">{isDepartmentLanding ? t("shop.empty.preview") : t("shop.empty.count")}</p>
        <h2 className="font-serif text-[1.8rem] md:text-[2.2rem]">
          {isDepartmentLanding ? t("shop.empty.comingSoon", { department: departmentName }) : t("shop.empty.noMatch")}
        </h2>
        <p className="mt-3 max-w-xl text-base leading-[1.85] text-foreground/55">
          {isDepartmentLanding
            ? t("shop.empty.comingSoonBody")
            : t("shop.empty.noMatchBody")}
        </p>
      </div>

      {/* Active filter pills with individual remove */}
      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-mono text-[0.7rem] text-muted/60 mr-1">{t("shop.empty.active")}</span>
          {active.map((f) => (
            <Link
              key={f.key}
              href={f.removeHref}
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

      {/* Primary CTA */}
      <PrimaryCtaButton href={localePath(locale, "/shop")}>
        {isDepartmentLanding ? t("shop.empty.browseAvailable") : t("shop.empty.showAll")}
      </PrimaryCtaButton>
    </motion.div>
  );
}

/* ─── Product grid ───────────────────────────────────────────────── */
function ProductGrid({ products }: { products: ProductSummary[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-6%" });
  const reduceMotion = useReducedMotion() ?? false;

  /* Editorial offset rules matching the original grid */
  function offsetClass(index: number) {
    if (index === 2) return "lg:mt-16";
    if (index === 3) return "lg:-mt-16";
    return undefined;
  }

  return (
    <motion.div
      ref={ref}
      layout
      className="grid grid-cols-1 gap-x-4 gap-y-10 sm:grid-cols-2 md:gap-x-6 md:gap-y-20 lg:grid-cols-3"
      transition={{ layout: reduceMotion ? { duration: 0 } : { duration: 0.52, ease } }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {products.map((product, index) => {
          const isFeatured = index === 0;
          return (
            <motion.div
              layout
              key={product.slug}
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
              <ProductCard
                product={product}
                index={index}
                isFeatured={isFeatured}
                isParentInView={isInView}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Shop CTA footer ────────────────────────────────────────────── */
function ShopFooter() {
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
          {t("shop.footerCta.eyebrow")}
        </motion.p>

        <motion.h2
          className="max-w-xl font-serif leading-[1.05]"
          style={{ fontSize: "clamp(1.8rem,4vw,3.2rem)" }}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.85, ease, delay: 0.18 }}
        >
          {t("shop.footerCta.title")}
        </motion.h2>

        <motion.div
          className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5"
          initial={{ opacity: 0, y: 14 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease, delay: 0.28 }}
        >
          <PrimaryCtaButton href={localePath(locale, "/collections")}>
            {t("shop.footerCta.collections")}
          </PrimaryCtaButton>

          <Link
            href={localePath(locale, "/about")}
            className="label-mono border-b border-foreground/20 pb-1 text-foreground/60 transition-colors hover:border-couture-red hover:text-couture-red"
          >
            {t("shop.footerCta.story")}
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

/* ─── Root ───────────────────────────────────────────────────────── */
export type ShopPageProps = {
  products: ProductSummary[];
  leadProduct?: ProductSummary;
  archiveCount: number;
  filterProps: Omit<FilterBarProps, "totalCount">;
};

export function ShopPage({ products, leadProduct, archiveCount, filterProps }: ShopPageProps) {
  return (
    <main data-component="ShopPage"
      className="shop-experience artifact-shell min-h-screen overflow-x-hidden bg-background text-foreground selection:bg-couture-red selection:text-white"
    >
      <ShopHero leadProduct={leadProduct} archiveCount={archiveCount} />

      <div id="shop-results" className="relative scroll-mt-24 bg-background pb-16 pt-6 md:pb-24 md:pt-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "clamp(52px, 7vw, 104px) clamp(52px, 7vw, 104px)",
          }}
          aria-hidden="true"
        />
        <div className="site-shell">
          <FilterSection filterProps={filterProps} totalCount={products.length} />

          <LayoutGroup id="shop-results">
            <AnimatePresence mode="wait" initial={false}>
              {products.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 18, filter: "blur(5px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                  transition={{ duration: 0.34, ease }}
                >
                  <EmptyState
                    filters={filterProps.initialFilters}
                    departments={filterProps.departments}
                    categories={filterProps.categories}
                    collections={filterProps.collections}
                    tags={filterProps.tags}
                  />
                </motion.div>
              ) : (
                <ProductGrid key="products" products={products} />
              )}
            </AnimatePresence>
          </LayoutGroup>
        </div>
      </div>

      <ShopFooter />
    </main>
  );
}
