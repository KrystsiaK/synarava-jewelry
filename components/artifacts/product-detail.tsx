"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  useReducedMotion,
  AnimatePresence,
} from "motion/react";
import Link from "next/link";

import { AddToCartButton } from "@/components/commerce/add-to-cart-button";
import { PrimaryCtaButton, ShinyText } from "@/components/ui";
import type { ProductSummary } from "@/lib/content/catalog";

const ease = [0.22, 1, 0.36, 1] as const;

/* ─── Inline SVG folk patterns ───────────────────────────────────── */
function SvgKodRodaMini({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-5%" });
  const reduce = useReducedMotion();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = (delay: number): any => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: isInView ? { pathLength: 1, opacity: 1 } : {},
    transition: { duration: reduce ? 0 : 1.4, ease: "easeInOut", delay },
  });

  return (
    <motion.svg
      ref={ref}
      viewBox="0 0 200 200"
      fill="none"
      className={className}
      animate={reduce ? undefined : isInView ? { rotate: [0, 1.5, -1, 0] } : {}}
      transition={{ duration: 14, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
    >
      <motion.path d="M100 8 L192 100 L100 192 L8 100 Z" stroke="currentColor" strokeWidth="1.2" {...d(0)} />
      <motion.path d="M100 42 L158 100 L100 158 L42 100 Z" stroke="currentColor" strokeWidth="1" {...d(0.2)} />
      <motion.path d="M100 68 L132 100 L100 132 L68 100 Z" stroke="currentColor" strokeWidth="0.85" {...d(0.4)} />
      <motion.path d="M100 8 L100 192" stroke="currentColor" strokeWidth="0.6" opacity={0.4} {...d(0.55)} />
      <motion.path d="M8 100 L192 100" stroke="currentColor" strokeWidth="0.6" opacity={0.4} {...d(0.55)} />
      <motion.circle cx="100" cy="100" r="4" fill="currentColor"
        initial={{ scale: 0, opacity: 0 }}
        animate={isInView ? { scale: 1, opacity: 1 } : {}}
        transition={{ duration: 0.5, delay: 1.2, type: "spring", stiffness: 400 }}
      />
    </motion.svg>
  );
}

function SvgKolaMini({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-5%" });
  const reduce = useReducedMotion();

  return (
    <motion.svg
      ref={ref}
      viewBox="0 0 200 200"
      fill="none"
      className={className}
      animate={reduce ? undefined : isInView ? { rotate: 360 } : {}}
      transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
    >
      {[88, 60, 28].map((r, i) => (
        <motion.circle key={r} cx="100" cy="100" r={r} stroke="currentColor"
          strokeWidth={i === 0 ? "1" : "0.8"} opacity={i === 1 ? 0.6 : 1}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={isInView ? { pathLength: 1, opacity: i === 1 ? 0.6 : 1 } : {}}
          transition={{ duration: 1.6 - i * 0.2, ease: "easeInOut", delay: i * 0.25 }}
        />
      ))}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <motion.line key={angle}
            x1={100 + 28 * Math.cos(rad)} y1={100 + 28 * Math.sin(rad)}
            x2={100 + 88 * Math.cos(rad)} y2={100 + 88 * Math.sin(rad)}
            stroke="currentColor" strokeWidth={i % 2 === 0 ? "1" : "0.55"} opacity={i % 2 === 0 ? 1 : 0.45}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={isInView ? { pathLength: 1, opacity: i % 2 === 0 ? 1 : 0.45 } : {}}
            transition={{ duration: 1, ease: "easeInOut", delay: 0.8 + i * 0.07 }}
          />
        );
      })}
    </motion.svg>
  );
}

/* ─── Hero ───────────────────────────────────────────────────────── */
function ProductHero({ product }: { product: ProductSummary }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const textY = useTransform(scrollYProgress, [0, 0.6], ["0%", "-8%"]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const words = product.title.split(" ");

  return (
    <motion.header
      ref={ref}
      className="relative min-h-screen overflow-hidden bg-background pt-24 md:pt-28"
    >
      {/* Grain */}
      <div
        className="pointer-events-none absolute inset-0 z-0 mix-blend-multiply opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px",
        }}
      />

      {/* Ghost pattern */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-end overflow-hidden opacity-[0.035]">
        <SvgKodRodaMini className="h-[85vw] w-[85vw] max-h-[720px] max-w-[720px] translate-x-1/4 text-foreground" />
      </div>

      {/* Red ambient glow */}
      <div
        className="pointer-events-none absolute -left-32 top-20 h-[50vw] w-[50vw] max-w-[600px] rounded-full"
        style={{
          background: "radial-gradient(circle, #a6192e 0%, transparent 65%)",
          opacity: 0.06,
        }}
      />

      <div className="site-shell relative z-10 grid min-h-[calc(100vh-7rem)] grid-cols-1 items-center gap-12 pb-16 pt-8 lg:grid-cols-12">
        {/* Left — text */}
        <motion.div
          className="space-y-8 lg:col-span-5"
          style={{ y: textY, opacity: textOpacity }}
        >
          {/* Breadcrumb */}
          <motion.nav
            className="flex items-center gap-2 text-[0.72rem] font-mono uppercase tracking-[0.2em] text-foreground/40"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease }}
          >
            <Link href="/shop" className="transition-colors hover:text-couture-red">Shop</Link>
            <span className="text-foreground/20">/</span>
            <span className="text-foreground/60">{product.series}</span>
          </motion.nav>

          <h1
            className="font-serif leading-[0.88] tracking-tight"
            style={{ fontSize: "clamp(2.6rem,5.5vw,5.2rem)" }}
          >
            {words.map((word, i) => (
              <span key={i} className="mr-[0.18em] inline-block overflow-hidden last:mr-0">
                <motion.span
                  className="inline-block"
                  initial={{ y: "110%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.95, ease, delay: 0.1 + i * 0.1 }}
                >
                  <ShinyText>{word}</ShinyText>
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            className="max-w-md text-base leading-[2] text-foreground/65 md:text-[1.0625rem]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease, delay: 0.55 }}
          >
            {product.shortDescription}
          </motion.p>

          <motion.p
            className="label-caps text-foreground/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, ease, delay: 0.7 }}
          >
            {product.materialLine}
          </motion.p>

          {/* Price + CTA */}
          <motion.div
            className="space-y-5 pt-2"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease, delay: 0.85 }}
          >
            <div className="flex flex-wrap items-center gap-6">
              <AddToCartButton productSlug={product.slug} />
              <span className="font-mono text-[0.85rem] uppercase tracking-[0.18em] text-foreground/70">
                {product.price}
              </span>
            </div>

            {/* Trust strip */}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-foreground/[0.07] pt-4">
              {[
                { icon: "M5 12l5-5 5 5", label: "In stock" },
                { icon: "M3 8h2l2-5 4 10 2-5h2", label: "Ships in 3–5 days" },
                { icon: "M20 7H4a1 1 0 00-1 1v8a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1z", label: "Gift packaging" },
                { icon: "M4 4l16 16M4 20L20 4", label: "14-day returns" },
              ].map(({ label }) => (
                <span key={label} className="flex items-center gap-1.5 label-mono text-[0.65rem] text-foreground/40">
                  <span className="inline-block h-1 w-1 rounded-full bg-couture-red/60" aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Tags */}
          {product.tagNames.length > 0 && (
            <motion.div
              className="flex flex-wrap gap-2 pt-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, ease, delay: 1 }}
            >
              {product.tagNames.map((tag) => (
                <span
                  key={tag}
                  className="border border-foreground/10 px-3 py-1 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-foreground/40 transition-colors duration-300 hover:border-couture-red/40 hover:text-couture-red"
                >
                  {tag}
                </span>
              ))}
            </motion.div>
          )}
        </motion.div>

        {/* Right — image */}
        <div className="relative lg:col-span-7">
          <motion.div
            className="relative mx-auto max-w-xl overflow-hidden lg:max-w-none"
            initial={{ opacity: 0, scale: 0.93 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.4, ease, delay: 0.2 }}
          >
            <motion.div
              className="relative aspect-[4/5] w-full"
              style={{ y: imgY }}
            >
              <Image
                src={product.image}
                alt={product.title}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 58vw"
                className="object-cover brightness-[0.9] contrast-[1.08]"
              />
            </motion.div>

            {/* Mirror fragment */}
            <div className="pointer-events-none absolute inset-y-0 right-0 w-2/5 overflow-hidden">
              <Image
                aria-hidden="true"
                src={product.image}
                alt=""
                fill
                sizes="24vw"
                className="!-right-full !left-auto !w-[200%] scale-x-[-1] object-cover opacity-40"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-background/10 to-background/40" />
            </div>

            {/* Red vignette bottom */}
            <div
              className="pointer-events-none absolute bottom-0 left-0 right-0 h-2/5"
              style={{ background: "linear-gradient(to top, rgba(166,25,46,0.14) 0%, transparent 100%)" }}
            />

            {/* Corner accents */}
            <motion.div
              className="absolute left-4 top-4 h-10 w-10 border-l border-t border-couture-red/60"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 1.1, ease }}
            />
            <motion.div
              className="absolute bottom-4 right-4 h-10 w-10 border-b border-r border-couture-red/60"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 1.25, ease }}
            />

            {/* Series badge */}
            <motion.div
              className="absolute -left-4 bottom-14 hidden lg:block"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease, delay: 1.4 }}
            >
              <div className="border border-foreground/10 bg-background/90 px-4 py-3 backdrop-blur-sm">
                <p className="label-mono text-[0.6rem] text-muted-ink">{product.collectionName}</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.6 }}
      >
        <motion.div
          className="flex h-10 w-6 items-start justify-center rounded-full border border-foreground/20 p-1.5"
          animate={{ borderColor: ["rgba(255,255,255,0.12)", "rgba(166,25,46,0.5)", "rgba(255,255,255,0.12)"] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        >
          <motion.div
            className="h-2 w-1 rounded-full bg-couture-red"
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </motion.div>
    </motion.header>
  );
}

/* ─── Materials strip ────────────────────────────────────────────── */
function MaterialsSection({ product }: { product: ProductSummary }) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-8%" });

  return (
    <section ref={ref} className="relative overflow-hidden bg-surface py-20 md:py-36">
      {/* Ghost Kola */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03]">
        <SvgKolaMini className="h-[80vw] w-[80vw] max-h-[700px] max-w-[700px] text-foreground" />
      </div>

      <div className="site-shell relative z-10">
        <motion.div
          className="mb-16 text-center md:mb-24"
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease }}
        >
          <p className="label-mono mb-4 text-couture-red">Materials</p>
          <h2 className="font-serif" style={{ fontSize: "clamp(1.8rem,3.5vw,2.8rem)" }}>
            The Honest Material
          </h2>
          {/* Animated separator */}
          <motion.div
            className="mx-auto mt-6 h-px bg-couture-red/40"
            initial={{ width: 0 }}
            animate={isInView ? { width: 80 } : {}}
            transition={{ duration: 0.8, ease, delay: 0.3 }}
          />
        </motion.div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 md:gap-6">
          {product.materials.map((item, i) => (
            <motion.article
              key={item.title}
              className="group space-y-5"
              initial={{ opacity: 0, y: 36 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, ease, delay: i * 0.14 }}
            >
              <div className="artifact-hover-image-wrap relative aspect-square bg-charcoal">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="artifact-hover-image object-cover opacity-80 contrast-[1.05] transition-all duration-700 group-hover:scale-110 group-hover:opacity-90"
                />
                {/* Hover red overlay */}
                <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{ background: "linear-gradient(to top, rgba(166,25,46,0.18) 0%, transparent 60%)" }} />
                {/* Bottom sweep line */}
                <motion.div
                  className="absolute bottom-0 left-0 h-0.5 bg-couture-red"
                  initial={{ width: 0 }}
                  whileHover={{ width: "100%" }}
                  transition={{ duration: 0.45, ease }}
                />
              </div>
              <div className="space-y-2">
                <h3 className="label-caps">{item.title}</h3>
                <p className="text-base leading-[1.85] text-foreground/65">{item.body}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Symbolism ──────────────────────────────────────────────────── */
function SymbolismSection({ product }: { product: ProductSummary }) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const imgScale = useTransform(scrollYProgress, [0, 1], [1.06, 0.98]);

  return (
    <section ref={ref} className="site-shell overflow-hidden py-20 md:py-40">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
        {/* Image */}
        <motion.div
          className="relative lg:col-span-7 lg:col-start-1"
          initial={{ opacity: 0, x: -24 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 1, ease }}
        >
          {/* Ghost "КОД РОДА" */}
          <div
            className="pointer-events-none absolute -left-2 -top-8 select-none font-serif leading-none text-couture-red/10"
            style={{ fontSize: "clamp(2rem,6vw,6rem)", whiteSpace: "nowrap" }}
          >
            КОД РОДА
          </div>

          <div className="relative aspect-video overflow-hidden">
            <motion.div
              className="relative h-full w-full"
              style={{ scale: imgScale }}
            >
              <Image
                src={product.lookbook[0]?.src || product.image}
                alt="Symbolic Detail"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </motion.div>
          </div>
        </motion.div>

        {/* Text panel */}
        <motion.div
          className="etched-glass relative border border-foreground/[0.07] p-8 md:p-10 lg:col-span-5 lg:col-start-8"
          initial={{ opacity: 0, x: 24 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 1, ease, delay: 0.15 }}
        >
          {/* Animated left accent */}
          <motion.div
            className="absolute left-0 top-0 w-0.5 bg-couture-red"
            initial={{ height: 0 }}
            animate={isInView ? { height: "100%" } : {}}
            transition={{ duration: 1.2, delay: 0.4, ease }}
          />

          <motion.p
            className="label-mono mb-4 text-couture-red"
            initial={{ opacity: 0, y: 12 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease, delay: 0.3 }}
          >
            {product.symbolismLabel}
          </motion.p>

          <motion.h2
            className="mb-6 font-serif italic leading-[1.15]"
            style={{ fontSize: "clamp(1.5rem,2.8vw,2.4rem)" }}
            initial={{ opacity: 0, y: 16 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease, delay: 0.4 }}
          >
            {product.symbolismTitle}
          </motion.h2>

          <motion.p
            className="mb-4 text-base leading-[1.9] text-foreground/72 md:text-[1.0625rem]"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.8, ease, delay: 0.55 }}
          >
            {product.symbolismBody}
          </motion.p>

          <motion.p
            className="text-base leading-[1.9] text-foreground/60"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.8, ease, delay: 0.68 }}
          >
            {product.symbolismBody2}
          </motion.p>

          {/* Ornament */}
          <motion.div
            className="mt-8 flex items-center gap-4"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.7, delay: 0.8 }}
          >
            <motion.div className="h-px bg-foreground/15"
              initial={{ width: 0 }}
              animate={isInView ? { width: 40 } : {}}
              transition={{ duration: 0.7, delay: 0.9 }}
            />
            <div className="h-2 w-2 rotate-45 border border-couture-red/60" />
            <motion.div className="h-px bg-foreground/15"
              initial={{ width: 0 }}
              animate={isInView ? { width: 40 } : {}}
              transition={{ duration: 0.7, delay: 1.0 }}
            />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Craftsmanship / Stats dark section ─────────────────────────── */
function CraftSection({ product }: { product: ProductSummary }) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const bgScale = useTransform(scrollYProgress, [0, 1], [1.08, 0.96]);

  return (
    <section ref={ref} className="relative overflow-hidden bg-foreground py-20 text-background md:py-36">
      {/* Parallax ghost KodRoda */}
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{ scale: bgScale }}
      >
        <SvgKodRodaMini className="h-[75vw] w-[75vw] max-h-[650px] max-w-[650px] text-background opacity-[0.025]" />
      </motion.div>

      <div className="site-shell relative z-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Video/image block */}
          <motion.div
            className="group relative overflow-hidden"
            initial={{ opacity: 0, x: -24 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 1, ease }}
          >
            <div className="relative aspect-video cursor-pointer overflow-hidden">
              <Image
                className="artifact-hover-image object-cover opacity-50 group-hover:scale-105"
                src={product.process.mediaImage}
                alt="Craftsmanship"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              {/* Play button */}
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                whileHover={{ scale: 1.05 }}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur-sm transition-all duration-300 group-hover:border-couture-red/60 group-hover:bg-couture-red/20 md:h-20 md:w-20">
                  <svg className="ml-1 h-6 w-6 md:h-7 md:w-7" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </motion.div>

              {/* Corner accents */}
              <motion.div
                className="absolute left-3 top-3 h-8 w-8 border-l border-t border-couture-red/40"
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.6 }}
              />
              <motion.div
                className="absolute bottom-3 right-3 h-8 w-8 border-b border-r border-couture-red/40"
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.75 }}
              />
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="flex flex-col justify-center space-y-10"
            initial={{ opacity: 0, x: 24 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 1, ease, delay: 0.15 }}
          >
            <div>
              <p className="label-mono mb-4 text-couture-red">{product.process.eyebrow}</p>
              <h2 className="font-serif leading-[1.05]" style={{ fontSize: "clamp(1.8rem,3.5vw,3rem)" }}>
                {product.process.title}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {product.process.stats.map(({ value, label }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.7, ease, delay: 0.3 + i * 0.1 }}
                >
                  <p
                    className="mb-1 font-serif text-background"
                    style={{
                      fontSize: "clamp(1.8rem,3vw,2.8rem)",
                      textShadow: isInView ? "0 0 30px rgba(166,25,46,0.5)" : "none",
                      transition: "text-shadow 0.8s ease",
                    }}
                  >
                    {value}
                  </p>
                  <p className="label-mono text-background/40">{label}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ─── Lookbook ───────────────────────────────────────────────────── */
function lookbookClasses(index: number, item: ProductSummary["lookbook"][number]) {
  if (item.featured || index === 0) {
    return "md:col-span-2 md:row-span-2";
  }

  if (index === 1) {
    return "md:col-span-2";
  }

  return "";
}

function LookbookSection({ product }: { product: ProductSummary }) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-8%" });
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <section ref={ref} className="site-shell py-20 md:py-32">
      <motion.div
        className="mb-10 flex items-end justify-between md:mb-14"
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7, ease }}
      >
        <div>
          <p className="label-mono mb-2 text-couture-red">Pairing Guide</p>
          <h2 className="font-serif" style={{ fontSize: "clamp(1.6rem,3vw,2.4rem)" }}>
            The Lookbook
          </h2>
        </div>
        <p className="hidden label-mono text-foreground/35 md:block">
          {product.lookbook.length} images
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 md:h-[52rem] md:grid-cols-4 md:grid-rows-2 md:gap-4">
        {product.lookbook.map((item, i) => (
          <motion.div
            key={i}
            className={`relative overflow-hidden bg-black/5 aspect-square md:aspect-auto ${lookbookClasses(i, item)}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.85, ease, delay: i * 0.1 }}
            onHoverStart={() => setHoveredIdx(i)}
            onHoverEnd={() => setHoveredIdx(null)}
          >
            <motion.div
              className="relative h-full w-full"
              animate={{ filter: hoveredIdx === i ? "grayscale(0%) contrast(1.08)" : "grayscale(40%) contrast(1.02)" }}
              transition={{ duration: 0.5 }}
            >
              <Image
                className="object-cover"
                src={item.src}
                alt={item.label || `Lookbook ${i + 1}`}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            </motion.div>
            {/* Hover overlay */}
            <AnimatePresence>
              {hoveredIdx === i && (
                <motion.div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 55%)" }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                />
              )}
            </AnimatePresence>
            {item.label && (
              <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6">
                <motion.span
                  className="label-mono text-white/80 text-[0.7rem]"
                  initial={{ opacity: 0, y: 8 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, ease, delay: 0.5 + i * 0.1 }}
                >
                  {item.label}
                </motion.span>
              </div>
            )}
            {/* Red sweep on hover */}
            <motion.div
              className="absolute bottom-0 left-0 h-0.5 bg-couture-red"
              animate={{ width: hoveredIdx === i ? "100%" : "0%" }}
              transition={{ duration: 0.4, ease }}
            />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ─── CTA footer ─────────────────────────────────────────────────── */
function ProductFooter({ product }: { product: ProductSummary }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <div ref={ref} className="relative overflow-hidden border-t border-foreground/[0.06] bg-surface py-20 md:py-28">
      {/* Ghost text */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <span
          className="select-none font-serif leading-none text-foreground"
          style={{ fontSize: "clamp(4rem,14vw,12rem)", opacity: 0.022, whiteSpace: "nowrap" }}
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
          Part of {product.collectionName}
        </motion.p>

        <motion.h2
          className="max-w-xl font-serif leading-[1.05]"
          style={{ fontSize: "clamp(1.8rem,4vw,3rem)" }}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.85, ease, delay: 0.18 }}
        >
          Continue Exploring
        </motion.h2>

        <motion.div
          className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5"
          initial={{ opacity: 0, y: 14 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease, delay: 0.28 }}
        >
          <PrimaryCtaButton href={`/collections/${product.collectionSlug}`}>
            View collection
          </PrimaryCtaButton>

          <Link
            href="/shop"
            className="label-mono border-b border-foreground/20 pb-1 text-foreground/60 transition-colors hover:border-couture-red hover:text-couture-red"
          >
            Back to shop
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

/* ─── Root ───────────────────────────────────────────────────────── */
export function ProductDetail({ product }: { product: ProductSummary }) {
  return (
    <main className="artifact-shell min-h-screen overflow-x-hidden">
      <ProductHero product={product} />
      <MaterialsSection product={product} />
      <SymbolismSection product={product} />
      <CraftSection product={product} />
      <LookbookSection product={product} />
      <ProductFooter product={product} />
    </main>
  );
}
