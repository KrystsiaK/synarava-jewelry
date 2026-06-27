/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
} from "motion/react";
import Link from "next/link";
import { EditorialSplitFeature } from "@/components/ui";
import type { CollectionSummary, ProductSummary } from "@/lib/content/catalog";

const ease = [0.22, 1, 0.36, 1] as const;

type CollectionDetail = CollectionSummary & {
  manifesto: string;
  symbolismLabel: string;
  symbolismTitle: string;
  symbolismBody: string;
  symbolismBody2: string;
};

/* ─── Hero ───────────────────────────────────────────────────────── */
function DetailHero({ collection }: { collection: CollectionDetail }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.7], [0.52, 0.78]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);

  const words = collection.name.split(" ");

  return (
    <motion.header
      ref={ref}
      className="relative flex h-[90vh] min-h-[600px] w-full items-end overflow-hidden pb-16 md:h-screen md:pb-20"
    >
      {/* Parallax image */}
      <motion.div className="absolute inset-0 scale-110" style={{ y: imgY }}>
        <img
          alt={collection.name}
          src={collection.heroImage}
          className="h-full w-full object-cover brightness-90"
        />
      </motion.div>

      {/* Gradient overlay */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/30 to-transparent"
        style={{ opacity: overlayOpacity }}
      />

      {/* Red side accent */}
      <div className="pointer-events-none absolute right-0 top-0 h-full w-1 bg-couture-red/40" />


      {/* Breadcrumb */}
      <motion.div
        className="absolute left-0 right-0 top-28 z-20 px-5 md:px-16"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease, delay: 0.3 }}
      >
        <div className="flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-white/50">
          <Link href="/" className="transition-colors hover:text-white/80">Home</Link>
          <span>/</span>
          <Link href="/collections" className="transition-colors hover:text-white/80">Collections</Link>
          <span>/</span>
          <span className="text-white/80">{collection.name}</span>
        </div>
      </motion.div>

      <motion.div
        className="relative z-20 px-5 md:px-16"
        style={{ y: textY, opacity: textOpacity }}
      >
        <motion.span
          className="label-mono mb-5 block text-couture-red"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease }}
        >
          {collection.eyebrow}
        </motion.span>

        <h1
          className="max-w-3xl font-serif leading-[0.9] tracking-tight text-background"
          style={{ fontSize: "clamp(3rem,8vw,7rem)" }}
        >
          {words.map((word, i) => (
            <span key={i} className="mr-[0.2em] inline-block overflow-hidden last:mr-0">
              <motion.span
                className="inline-block"
                initial={{ y: "110%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 1, ease, delay: 0.15 + i * 0.12 }}
              >
                {word}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p
          className="mt-8 max-w-lg text-base leading-[1.9] text-background/65 md:text-lg"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.6, ease }}
        >
          {collection.summary}
        </motion.p>

        {/* CTA */}
        <motion.div
          className="mt-10 flex items-center gap-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.85, ease }}
        >
          <Link
            href="/shop"
            className="group inline-flex cursor-pointer items-center gap-3 bg-couture-red px-8 py-4 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition-colors duration-500 hover:bg-[#8f1325]"
          >
            Shop products
            <svg className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 12 12" fill="none">
              <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <Link
            href="/collections"
            className="label-mono border-b border-background/30 pb-1 text-background/60 transition-colors hover:border-background/60 hover:text-background/90"
          >
            All collections
          </Link>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-10 right-12 hidden flex-col items-center gap-4 md:flex"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.9 }}
      >
        <div className="relative h-20 w-px overflow-hidden bg-background/20">
          <motion.div
            className="absolute top-0 h-1/2 w-full bg-couture-red"
            animate={{ y: ["0%", "200%"] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <span className="label-mono text-[0.62rem] text-background/35 [writing-mode:vertical-rl]">Scroll</span>
      </motion.div>
    </motion.header>
  );
}

/* ─── Manifesto Strip ────────────────────────────────────────────── */
function ManifestoStrip({ manifesto }: { manifesto: string }) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-12%" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const bgScale = useTransform(scrollYProgress, [0, 1], [0.88, 1.06]);

  return (
    <section ref={ref} className="relative overflow-hidden bg-foreground py-20 md:py-40">
      {/* Ghost text background */}
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
        style={{ scale: bgScale }}
      >
        <span
          className="select-none text-center font-serif leading-none text-background"
          style={{ fontSize: "clamp(4rem,15vw,13rem)", opacity: 0.03, whiteSpace: "nowrap" }}
        >
          MANIFESTO
        </span>
      </motion.div>

      <div className="site-shell relative z-10">
        <motion.p
          className="label-mono mb-10 text-couture-red md:mb-14"
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease }}
        >
          Collection Manifesto
        </motion.p>

        <motion.blockquote
          className="max-w-5xl font-serif italic leading-[1.4] text-background"
          style={{ fontSize: "clamp(1.5rem,3vw,2.8rem)" }}
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.85, ease, delay: 0.15 }}
        >
          {manifesto}
        </motion.blockquote>

        <motion.div
          className="mt-12 flex items-center gap-5"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.9 }}
        >
          <motion.div
            className="h-px w-14 bg-background/20"
            initial={{ scaleX: 0 }}
            animate={isInView ? { scaleX: 1 } : {}}
            transition={{ duration: 0.8, delay: 1 }}
            style={{ transformOrigin: "left" }}
          />
          <div className="h-2 w-2 rotate-45 border border-couture-red" />
          <motion.div
            className="h-px w-14 bg-background/20"
            initial={{ scaleX: 0 }}
            animate={isInView ? { scaleX: 1 } : {}}
            transition={{ duration: 0.8, delay: 1.1 }}
            style={{ transformOrigin: "right" }}
          />
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Collection Story ───────────────────────────────────────────── */
function CollectionStory({ collection }: { collection: CollectionDetail }) {
  return (
    <section className="bg-background py-20 md:py-40">
      <div className="site-shell">
        <EditorialSplitFeature
          showDivider={false}
          imageSrc={collection.heroImage}
          imageAlt={`${collection.name} detail`}
          imagePanelClassName="md:col-span-5"
          contentPanelClassName="md:col-span-6 md:col-start-7"
          imageFrameClassName="aspect-[3/4] md:min-h-[36rem]"
          imageClassName="transition-transform duration-700 hover:scale-[1.03]"
          topMeta={<span className="label-mono block text-couture-red">Collection Story</span>}
          title={(
            <h2 className="font-serif" style={{ fontSize: "clamp(1.8rem,3vw,2.6rem)" }}>
              A world with a clear visual logic
            </h2>
          )}
          description={collection.summary}
          imageOverlay={(
            <>
              <div className="absolute left-4 top-4 h-10 w-10 border-l border-t border-couture-red/60" />
              <div className="absolute bottom-4 right-4 h-10 w-10 border-b border-r border-couture-red/60" />
              <div className="absolute -bottom-5 -right-4 hidden items-center justify-center border border-foreground/[0.07] bg-stone-beige/90 p-5 backdrop-blur-sm sm:flex md:-right-8 md:p-7">
                <span className="text-center font-mono text-[0.72rem] uppercase tracking-[0.14em]">
                  {collection.accent}
                  <br />
                  <span className="text-couture-red">accent code</span>
                </span>
              </div>
            </>
          )}
          action={<div className="h-px w-24 bg-couture-red" />}
          footer={(
            <div className="space-y-6">
              <div className="border-l-2 border-couture-red/30 pl-6 md:pl-8">
                <p className="label-caps mb-3 text-couture-red">{collection.symbolismLabel}</p>
                <p className="mb-2 font-serif" style={{ fontSize: "clamp(1.1rem,1.8vw,1.4rem)" }}>
                  {collection.symbolismTitle}
                </p>
                <p className="text-sm leading-[1.9] text-foreground/65 md:text-base">
                  {collection.symbolismBody}
                </p>
              </div>
              {collection.symbolismBody2 ? (
                <p className="text-sm leading-[1.9] text-foreground/55 md:text-base">
                  {collection.symbolismBody2}
                </p>
              ) : null}
            </div>
          )}
        />
      </div>
    </section>
  );
}

/* ─── Products Grid ──────────────────────────────────────────────── */
function ProductCard({
  product,
  index,
  isParentInView,
}: {
  product: ProductSummary;
  index: number;
  isParentInView: boolean;
}) {
  const isOffset = index === 1;

  return (
    <motion.div
      className={isOffset ? "md:mt-24" : ""}
      initial={{ opacity: 0, y: 52 }}
      animate={isParentInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.9, ease, delay: 0.08 + index * 0.12 }}
    >
      <Link href={`/products/${product.slug}`} className="group block cursor-pointer">
        <motion.div
          className={`relative mb-5 overflow-hidden bg-stone-beige ${isOffset ? "aspect-[4/5]" : "aspect-square"}`}
          initial="rest"
          whileHover="hover"
          animate="rest"
        >
          <motion.img
            alt={product.title}
            className="h-full w-full object-cover will-change-transform"
            src={product.image}
            variants={{
              rest: { scale: 1, filter: "grayscale(1) brightness(0.8)" },
              hover: { scale: 1.06, filter: "grayscale(0) brightness(0.9)" },
            }}
            transition={{ type: "spring", stiffness: 240, damping: 30 }}
          />

          {/* Overlay reveal */}
          <motion.div
            className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-foreground/75 via-foreground/25 to-transparent p-5"
            variants={{
              rest: { opacity: 0, y: "30%" },
              hover: { opacity: 1, y: "0%" },
            }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
          >
            <p className="label-mono mb-1 text-[0.65rem] text-white/75">{product.series}</p>
            <div className="flex items-end justify-between gap-2">
              <p
                className="font-serif leading-tight text-white"
                style={{ fontSize: "clamp(1rem,1.4vw,1.2rem)" }}
              >
                {product.title}
              </p>
              <span className="label-mono shrink-0 text-[0.68rem] text-couture-red">{product.price}</span>
            </div>
          </motion.div>

          {/* Bottom sweep */}
          <motion.div
            className="absolute bottom-0 left-0 h-0.5 bg-couture-red"
            variants={{ rest: { width: "0%" }, hover: { width: "100%" } }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          />
        </motion.div>

        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="label-mono mb-1 text-[0.72rem] text-muted-ink">{product.materialLine}</p>
            <h3
              className="font-serif transition-colors duration-300 group-hover:text-couture-red"
              style={{ fontSize: "clamp(1.1rem,1.6vw,1.4rem)" }}
            >
              {product.title}
            </h3>
          </div>
          <span className="label-mono shrink-0 text-muted-ink transition-colors duration-300 group-hover:text-couture-red">
            {product.price}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

function ProductsSection({
  products,
  collectionName,
}: {
  products: ProductSummary[];
  collectionName: string;
}) {
  const headerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(headerRef, { once: true, margin: "-8%" });

  return (
    <section className="bg-surface py-20 md:py-36">
      <div className="site-shell">
        <div
          ref={headerRef}
          className="mb-14 flex flex-col gap-4 md:mb-20 md:flex-row md:items-end md:justify-between"
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <Link
              href="/shop"
              className="group inline-flex cursor-pointer items-center gap-2 label-caps border-b border-foreground/25 pb-1.5 transition-all hover:border-couture-red hover:text-couture-red"
            >
              View all products
              <svg className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 12 12" fill="none">
                <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </motion.div>
        </div>

        {products.length === 0 ? (
          <motion.div
            className="flex flex-col items-center gap-4 py-16 text-center"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
          >
            <p className="text-muted-ink">No products in this collection yet.</p>
            <Link href="/shop" className="label-caps border-b border-foreground/25 pb-1 hover:border-couture-red hover:text-couture-red">
              Browse all products
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:items-start md:gap-8">
            {products.map((product, i) => (
              <ProductCard
                key={product.slug}
                product={product}
                index={i}
                isParentInView={isInView}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── Next Collection Teaser ─────────────────────────────────────── */
function NextCollectionTeaser({ collection }: { collection: CollectionDetail }) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);

  return (
    <section ref={ref} className="relative overflow-hidden bg-foreground py-0">
      {/* Parallax background */}
      <motion.div className="absolute inset-0 opacity-25" style={{ y: bgY }}>
        <img
          alt="backdrop"
          src={collection.heroImage}
          className="h-full w-full scale-110 object-cover grayscale"
        />
        <div className="absolute inset-0 bg-foreground/75" />
      </motion.div>

      {/* Pulsing orb */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute left-1/2 top-1/2 h-[50vw] w-[50vw] max-w-[450px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(166,25,46,0.14) 0%, transparent 70%)" }}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative z-10 flex min-h-[50vh] items-center justify-center py-20 md:py-32">
        <div className="site-shell text-center text-background">
          <motion.p
            className="label-mono mb-8 text-couture-red"
            initial={{ opacity: 0, y: 16 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease }}
          >
            Explore more
          </motion.p>
          <motion.h2
            className="mx-auto mb-10 max-w-2xl font-serif leading-[1.05]"
            style={{ fontSize: "clamp(2rem,5vw,4.5rem)" }}
            initial={{ opacity: 0, y: 28 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.9, ease, delay: 0.1 }}
          >
            Browse all collections
          </motion.h2>
          <motion.div
            className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-5"
            initial={{ opacity: 0, y: 16 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease, delay: 0.22 }}
          >
            <Link
              href="/collections"
              className="group relative inline-flex cursor-pointer items-center gap-3 overflow-hidden border border-background/20 px-8 py-4 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-background transition-colors hover:border-couture-red hover:text-couture-red"
            >
              All collections
              <svg className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 12 12" fill="none">
                <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              href="/shop"
              className="group relative inline-flex cursor-pointer items-center gap-3 overflow-hidden bg-couture-red px-8 py-4 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white"
            >
              <span className="relative z-10">Shop all products</span>
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
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ─── Root Export ────────────────────────────────────────────────── */
export function CollectionDetail({
  collection,
  products,
}: {
  collection: CollectionDetail;
  products: ProductSummary[];
}) {
  return (
    <main className="artifact-shell overflow-x-hidden">
      <DetailHero collection={collection} />
      {collection.manifesto && <ManifestoStrip manifesto={collection.manifesto} />}
      <CollectionStory collection={collection} />
      <ProductsSection products={products} collectionName={collection.name} />
      <NextCollectionTeaser collection={collection} />
    </main>
  );
}
