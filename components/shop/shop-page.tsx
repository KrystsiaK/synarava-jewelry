"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import Link from "next/link";

import { PageHero } from "@/components/ui/page-hero";
import { ProductCard } from "@/components/ui/product-card";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { FilterBar, type FilterBarProps } from "./filter-bar";
import { buildSearchParams, type FilterOption, type ShopFilters } from "./types";
import type { ProductSummary } from "@/lib/content/catalog";

const ease = [0.22, 1, 0.36, 1] as const;

const MARQUEE_ITEMS = [
  "Handcrafted Jewelry", "◆", "Limited Pieces", "◆",
  "Lava Stone", "◆", "Oak Wood", "◆", "White Ceramic", "◆",
  "Archive", "◆", "Folk Couture", "◆",
];

/* ─── Thin marquee ───────────────────────────────────────────────── */
function ShopMarquee() {
  const doubled = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="overflow-hidden border-y border-foreground/[0.06] bg-foreground py-[0.85rem]">
      <motion.div
        className="flex whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 36, repeat: Infinity, ease: "linear" }}
      >
        {doubled.map((item, i) => (
          <span
            key={i}
            className={`mx-7 font-mono text-[0.68rem] uppercase tracking-[0.28em] ${
              item === "◆" ? "text-couture-red" : "text-background/50"
            }`}
          >
            {item}
          </span>
        ))}
      </motion.div>
    </div>
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
  categories: FilterOption[];
  collections: FilterOption[];
  tags: FilterOption[];
};

const labelOf = (value: string, opts: FilterOption[]) =>
  opts.find((o) => o.value === value)?.label ?? value;

const DIM: Record<keyof ShopFilters, string> = {
  q: "Search", category: "Category", collection: "Collection", tag: "Tag",
};

function EmptyState({ filters, categories, collections, tags }: EmptyStateProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  /* Active filter chips with remove-one URLs */
  const active: { key: keyof ShopFilters; label: string; removeHref: string }[] = [];
  if (filters.q) {
    const next = { ...filters, q: undefined };
    active.push({ key: "q", label: `"${filters.q}"`, removeHref: `/shop?${buildSearchParams(next)}` });
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
        <p className="label-mono mb-3 text-couture-red">0 pieces found</p>
        <h2 className="font-serif text-[1.8rem] md:text-[2.2rem]">
          No pieces matched.
        </h2>
        <p className="mt-3 max-w-xl text-base leading-[1.85] text-foreground/55">
          The combination you selected returned no results. Try removing one filter at a time,
          or clear everything to browse the full archive.
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
      <Link
        href="/shop"
        className="group inline-flex items-center gap-3 bg-couture-red px-7 py-3.5 label-caps text-white transition-colors hover:bg-[#8f1325]"
      >
        Show all pieces
        <svg className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 12 12" fill="none">
          <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </motion.div>
  );
}

/* ─── Product grid ───────────────────────────────────────────────── */
function ProductGrid({ products }: { products: ProductSummary[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-6%" });

  /* Editorial offset rules matching the original grid */
  function offsetClass(index: number) {
    if (index === 2) return "lg:mt-16";
    if (index === 3) return "lg:-mt-16";
    return undefined;
  }

  return (
    <div
      ref={ref}
      className="grid grid-cols-1 gap-x-4 gap-y-10 sm:grid-cols-2 md:gap-x-6 md:gap-y-20 lg:grid-cols-3"
    >
      {products.map((product, index) => {
        const isFeatured = index === 0;
        return (
          <div
            key={product.slug}
            className={`${isFeatured ? "sm:col-span-2 lg:col-span-2" : ""} ${offsetClass(index) ?? ""}`}
          >
            <ProductCard
              product={product}
              index={index}
              isFeatured={isFeatured}
              isParentInView={isInView}
            />
          </div>
        );
      })}
    </div>
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
          <MagneticButton
            href="/collections"
            className="group relative inline-flex cursor-pointer items-center gap-3 overflow-hidden bg-couture-red px-8 py-4 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white"
          >
            <span className="relative z-10">View collections</span>
            <svg className="relative z-10 h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 12 12" fill="none">
              <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.14) 50%, transparent 70%)",
                animation: "shiny-sweep 2.5s infinite linear",
                willChange: "transform",
              }}
            />
          </MagneticButton>

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
  filterProps: Omit<FilterBarProps, "totalCount">;
};

export function ShopPage({ products, filterProps }: ShopPageProps) {
  return (
    <main className="artifact-shell min-h-screen overflow-x-hidden">
      <PageHero
        eyebrow="Archive"
        title="Curated Archive"
        badge={`${products.length} ${products.length === 1 ? "piece" : "pieces"} available`}
        description="Each piece in our catalogue is a dialogue between the tactile history of Belarusian soil and the refined precision of modern couture."
        ghostText="ARCHIVE"
      />

      <ShopMarquee />

      <div className="bg-background pb-16 pt-10 md:pb-24 md:pt-14">
        <div className="site-shell">
          <FilterSection filterProps={filterProps} totalCount={products.length} />

          {products.length === 0 ? (
            <EmptyState
              filters={filterProps.initialFilters}
              categories={filterProps.categories}
              collections={filterProps.collections}
              tags={filterProps.tags}
            />
          ) : (
            <ProductGrid products={products} />
          )}
        </div>
      </div>

      <ShopFooter />
    </main>
  );
}
