"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import Link from "next/link";

import { PageHero } from "@/components/ui/page-hero";
import { ProductCard } from "@/components/ui/product-card";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { FilterBar, type FilterBarProps } from "./filter-bar";
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
function EmptyState() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  return (
    <motion.div
      ref={ref}
      className="panel flex flex-col items-start gap-6 p-8 md:p-12"
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
        <h2 className="font-serif text-[1.8rem] md:text-[2.2rem]">No pieces matched.</h2>
        <p className="mt-3 max-w-xl text-base leading-[1.85] text-foreground/65">
          Try a broader search or clear one of the active filters.
        </p>
      </div>

      <Link
        href="/shop"
        className="group inline-flex items-center gap-3 label-caps border-b border-foreground/20 pb-1.5 transition-colors hover:border-couture-red hover:text-couture-red"
      >
        Clear all filters
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
      className="grid grid-cols-2 gap-x-4 gap-y-12 md:gap-x-6 md:gap-y-20 lg:grid-cols-3"
    >
      {products.map((product, index) => {
        const isFeatured = index === 0;
        return (
          <div
            key={product.slug}
            className={`${isFeatured ? "col-span-2 lg:col-span-2" : ""} ${offsetClass(index) ?? ""}`}
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
                backgroundImage: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.14) 50%, transparent 70%)",
                backgroundSize: "200% 100%",
                animation: "shiny-sweep 2.5s infinite linear",
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
            <EmptyState />
          ) : (
            <ProductGrid products={products} />
          )}
        </div>
      </div>

      <ShopFooter />
    </main>
  );
}