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
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";

import { ProductCard } from "@/components/ui/product-card";
import { ArtifactLink, PrimaryCtaButton } from "@/components/ui";
import { FilterBar, type FilterBarProps } from "./filter-bar";
import { buildSearchParams, type FilterOption, type ShopFilters } from "./types";
import type { ProductSummary } from "@/lib/content/catalog";
import { SHOP_DEPARTMENTS } from "@/lib/catalog/taxonomy";

const ease = [0.22, 1, 0.36, 1] as const;

const SHOP_HERO_SPRING = {
  stiffness: 84,
  damping: 24,
  mass: 0.62,
  restDelta: 0.0005,
} as const;

function ShopHero({
  leadProduct,
  archiveCount,
}: {
  leadProduct?: ProductSummary;
  archiveCount: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const smoothProgress = useSpring(scrollYProgress, SHOP_HERO_SPRING);
  const progress = reduceMotion ? scrollYProgress : smoothProgress;
  const copyOpacity = useTransform(progress, [0, 0.68], [1, 0]);
  const copyY = useTransform(progress, [0, 0.68], reduceMotion ? ["0%", "0%"] : ["0%", "-8%"]);
  const mediaY = useTransform(progress, [0, 1], reduceMotion ? ["0%", "0%"] : ["0%", "9%"]);
  const mediaScale = useTransform(progress, [0, 1], reduceMotion ? [1, 1] : [1.04, 0.97]);

  return (
    <header
      ref={ref}
      className="shop-hero relative flex min-h-[74svh] items-end overflow-hidden bg-background px-5 pb-10 pt-24 text-foreground md:min-h-[88svh] md:px-[4vw] md:pb-20 md:pt-28"
    >
      <div
        className="shop-theme-grid pointer-events-none absolute inset-0"
        aria-hidden="true"
      />

      {leadProduct ? (
        <motion.div
          className="absolute -right-[18%] top-[5rem] h-[54svh] w-[96%] transform-gpu overflow-hidden md:-right-[3%] md:top-[6.5rem] md:h-[78vh] md:w-[67%]"
          style={{
            y: mediaY,
            scale: mediaScale,
            clipPath: "polygon(12% 4%, 94% 0, 100% 84%, 79% 100%, 0 91%, 5% 22%)",
          }}
        >
          <Image
            src={leadProduct.image}
            alt={leadProduct.title}
            fill
            preload
            quality={90}
            sizes="(max-width: 768px) 110vw, 68vw"
            className="shop-hero-image object-cover"
          />
          <div className="shop-hero-image-overlay absolute inset-0" />
          <div className="absolute inset-[5%] border border-white/15 [clip-path:polygon(7%_0,100%_0,100%_82%,78%_100%,0_89%,0_21%)]" />
          <p className="absolute right-8 top-8 hidden font-sans text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/65 md:block">
            Featured product / {leadProduct.departmentName || leadProduct.series}
          </p>
        </motion.div>
      ) : null}

      <div className="shop-hero-fade pointer-events-none absolute inset-x-0 bottom-0 h-[58%]" aria-hidden="true" />

      <span
        className="pointer-events-none absolute -bottom-10 right-[2%] hidden select-none font-serif text-[clamp(7rem,16vw,13rem)] uppercase leading-none text-foreground/[0.035] md:block"
        aria-hidden="true"
      >
        Archive
      </span>

      <motion.div
        className="relative z-10 w-full max-w-[52rem] transform-gpu md:pl-[4vw]"
        style={{ opacity: copyOpacity, y: copyY }}
      >
        <div className="mb-5 flex items-center gap-4 md:mb-7">
          <span className="h-px w-10 bg-couture-red" aria-hidden="true" />
          <p className="font-sans text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-foreground/70">
            Synarava shop · Curated goods
          </p>
        </div>

        <h1 className="max-w-[9ch] text-balance font-serif text-[clamp(3.5rem,9vw,6rem)] uppercase leading-[0.84] tracking-[-0.035em] text-foreground">
          Curated <span className="font-light italic text-couture-red">shop</span>
        </h1>

        <p className="mt-6 max-w-[40rem] text-pretty font-sans text-sm font-medium leading-relaxed text-muted md:mt-8 md:text-base">
          Jewelry, pet accessories, creative products for kids, and tools for making by hand.
        </p>

        <nav className="mt-7 grid max-w-[42rem] grid-cols-2 gap-px border border-foreground/14 bg-foreground/14 sm:grid-cols-4" aria-label="Shop by department">
          {SHOP_DEPARTMENTS.map((department) => (
            <ArtifactLink
              key={department.slug}
              href={`/shop?department=${department.slug}`}
              variant="inverse"
              size="sm"
              className="min-h-12 border-0 px-3 text-[0.66rem] tracking-[0.13em]"
            >
              {department.name}
            </ArtifactLink>
          ))}
        </nav>

        <div className="mt-6 flex flex-wrap gap-x-10 gap-y-3 border-t border-foreground/12 pt-5 font-sans text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-foreground/55 md:mt-7">
          <span><strong className="mr-2 text-couture-red">{String(archiveCount).padStart(2, "0")}</strong> products available</span>
          <span>Selected / useful / made to last</span>
        </div>
      </motion.div>
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

const DIM: Record<keyof ShopFilters, string> = {
  q: "Search", department: "Department", category: "Category", collection: "Collection", tag: "Tag",
  material: "Material", finish: "Finish", origin: "Origin", certified: "Certification", sort: "Sort",
};

function EmptyState({ filters, departments = [], categories, collections, tags }: EmptyStateProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const isDepartmentLanding = Boolean(filters.department) && ![
    filters.q,
    filters.category,
    filters.collection,
    filters.tag,
    filters.material,
    filters.finish,
    filters.origin,
    filters.certified,
  ].some(Boolean);
  const departmentName = filters.department ? labelOf(filters.department, departments) : "This department";

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
        <p className="label-mono mb-3 text-couture-red">{isDepartmentLanding ? "Department preview" : "0 products found"}</p>
        <h2 className="font-serif text-[1.8rem] md:text-[2.2rem]">
          {isDepartmentLanding ? `${departmentName} is coming soon.` : "No products matched."}
        </h2>
        <p className="mt-3 max-w-xl text-base leading-[1.85] text-foreground/55">
          {isDepartmentLanding
            ? "We are selecting the first objects for this department. Until then, explore the pieces already available in the shop."
            : "The combination you selected returned no results. Try removing one filter at a time, or clear everything to browse the full archive."}
        </p>
      </div>

      {/* Active filter pills with individual remove */}
      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-mono text-[0.7rem] text-muted/60 mr-1">Active:</span>
          {active.map((f) => (
            <Link
              key={f.key}
              href={f.removeHref}
              className="inline-flex items-center gap-0 border border-stroke overflow-hidden transition-colors hover:border-foreground/30 group"
            >
              <span className="label-mono text-[0.65rem] text-muted/50 px-2 py-1.5 border-r border-stroke">
                {DIM[f.key]}
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
      <PrimaryCtaButton href="/shop">
        {isDepartmentLanding ? "Browse available pieces" : "Show all pieces"}
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
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <div
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
          Explore the world behind the pieces
        </motion.p>

        <motion.h2
          className="max-w-xl font-serif leading-[1.05]"
          style={{ fontSize: "clamp(1.8rem,4vw,3.2rem)" }}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.85, ease, delay: 0.18 }}
        >
          Browse the Collections
        </motion.h2>

        <motion.div
          className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5"
          initial={{ opacity: 0, y: 14 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease, delay: 0.28 }}
        >
          <PrimaryCtaButton href="/collections">
            View collections
          </PrimaryCtaButton>

          <Link
            href="/about"
            className="label-mono border-b border-foreground/20 pb-1 text-foreground/60 transition-colors hover:border-couture-red hover:text-couture-red"
          >
            Our story
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
    <main
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
