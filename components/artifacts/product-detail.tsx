"use client";

import { useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  useInView,
  useReducedMotion,
  AnimatePresence,
} from "motion/react";
import Link from "next/link";

import { AddToCartButton } from "@/components/commerce/add-to-cart-button";
import { PrimaryCtaButton } from "@/components/ui";
import type { ProductSummary } from "@/lib/content/catalog";

const ease = [0.22, 1, 0.36, 1] as const;

/* ─── Hero ───────────────────────────────────────────────────────── */
function ProductHero({ product }: { product: ProductSummary }) {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);
  const textY = useTransform(scrollYProgress, [0, 0.7], ["0%", "-5%"]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.62], [1, 0.14]);

  const words = product.title.split(" ");

  return (
    <motion.header
      ref={ref}
      className="relative flex min-h-[100svh] items-end overflow-hidden bg-background pt-24 text-foreground md:min-h-screen md:pt-28"
    >
      <motion.div
        className="absolute right-0 top-24 h-[48svh] w-full overflow-hidden md:right-0 md:top-28 md:h-[78vh] md:w-[68%] md:[clip-path:polygon(9%_0,100%_0,100%_100%,0_92%)]"
        style={reduceMotion ? undefined : { y: imgY }}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.25, ease, delay: 0.1 }}
      >
        <Image
          src={product.image}
          alt={product.title}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 68vw"
          className="object-cover brightness-[0.88] contrast-[1.06] saturate-[1.08]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/5 via-transparent to-background/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/5 to-transparent" />
      </motion.div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[68%] bg-gradient-to-t from-background via-background/92 to-transparent" />
      <div className="pointer-events-none absolute -right-6 bottom-[4%] hidden font-serif text-[16vw] leading-none text-foreground/[0.025] md:block [writing-mode:vertical-rl]">
        ARTIFACT
      </div>

      <div className="site-shell relative z-10 w-full pb-6 pt-[38svh] md:grid md:grid-cols-12 md:pb-[6vh] md:pt-36">
        <motion.div
          className="md:col-span-7 lg:col-span-6 xl:col-span-7"
          style={reduceMotion ? undefined : { y: textY, opacity: textOpacity }}
        >
          <motion.nav
            className="mb-2 flex items-center gap-2 text-[0.65rem] font-sans font-semibold uppercase tracking-[0.2em] text-foreground/48 md:mb-5 md:text-[0.68rem]"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease }}
          >
            <Link href="/shop" className="transition-colors hover:text-couture-red">Shop</Link>
            <span className="text-foreground/20">/</span>
            <span className="text-foreground/60">{product.series}</span>
          </motion.nav>

          <h1
            className="max-w-[12ch] text-balance font-serif text-[clamp(2.65rem,6.3vw,6rem)] leading-[0.91] tracking-[-0.035em] md:leading-[0.94]"
          >
            {words.map((word, i) => (
              <span
                key={i}
                className={`mr-[0.16em] inline-block overflow-hidden pb-[0.28em] align-bottom last:mr-0 ${
                  i === words.length - 1 ? "font-serif italic text-couture-red" : ""
                }`}
              >
                <motion.span
                  className="inline-block"
                  initial={{ y: "110%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.95, ease, delay: 0.1 + i * 0.1 }}
                >
                  {word}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            className="mt-3 max-w-lg text-pretty text-sm leading-[1.6] text-foreground/70 md:mt-7 md:text-[1.0625rem] md:leading-[1.8]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease, delay: 0.55 }}
          >
            {product.shortDescription}
          </motion.p>

          <motion.p
            className="mt-3 label-caps text-foreground/50 md:mt-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, ease, delay: 0.7 }}
          >
            {product.materialLine}
          </motion.p>

          <motion.div
            className="mt-5 md:mt-8"
          >
            <div className="flex flex-wrap items-center gap-6">
              <AddToCartButton productSlug={product.slug} />
              <span className="font-serif text-2xl text-foreground md:text-3xl">
                {product.price}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-1.5 sm:flex sm:flex-wrap md:mt-6 md:gap-y-2">
              {[
                "In stock",
                "Ships in 3–5 days",
                "Gift packaging",
                "14-day returns",
              ].map((label) => (
                <span key={label} className="flex items-center gap-1.5 label-mono text-[0.62rem] text-foreground/48">
                  <span className="inline-block h-1 w-1 rounded-full bg-couture-red/60" aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
          </motion.div>

          {product.tagNames.length > 0 && (
            <motion.div
              className="mt-6 hidden flex-wrap items-center gap-x-3 gap-y-2 sm:flex"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, ease, delay: 1 }}
            >
              {product.tagNames.map((tag, index) => (
                <span key={tag} className="contents">
                  {index > 0 && <span className="text-couture-red/55">◆</span>}
                  <span className="font-sans text-[0.65rem] uppercase tracking-[0.18em] text-foreground/42">
                    {tag}
                  </span>
                </span>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>
    </motion.header>
  );
}

/* ─── Materials strip ────────────────────────────────────────────── */
function MaterialsSection({ product }: { product: ProductSummary }) {
  const ref = useRef<HTMLElement>(null);
  const [activeMaterial, setActiveMaterial] = useState(0);
  const reduceMotion = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const trackX = useTransform(scrollYProgress, [0, 1], ["0%", "-66.6667%"]);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const next = Math.min(
      product.materials.length - 1,
      Math.round(latest * (product.materials.length - 1)),
    );
    setActiveMaterial((current) => (current === next ? current : next));
  });

  return (
    <section
      ref={ref}
      className={
        reduceMotion
          ? "relative overflow-hidden bg-surface py-20"
          : "relative h-[calc(100svh_+_164vw_+_48px)] overflow-clip bg-surface md:h-[calc(100svh_+_116vw_+_48px)] lg:h-[calc(100svh_+_88vw_+_48px)] xl:h-[calc(100svh_+_76vw_+_48px)]"
      }
    >
      <div
        className={
          reduceMotion
            ? "relative"
            : "sticky top-0 flex h-screen flex-col justify-center overflow-hidden pb-8 pt-28"
        }
      >
        <div className="site-shell mb-8 flex items-end justify-between gap-6 md:mb-10">
          <div>
            <p className="label-mono mb-3 text-couture-red">Material archive</p>
            <h2 className="text-balance font-serif text-[clamp(2rem,4vw,3.4rem)] leading-none">
              The honest material
            </h2>
          </div>
          <p className="label-mono shrink-0 text-foreground/45">
            {String(activeMaterial + 1).padStart(2, "0")} / {String(product.materials.length).padStart(2, "0")}
          </p>
        </div>

        <div className="site-shell mb-7 h-px bg-foreground/10">
          <motion.div
            className="h-full origin-left bg-couture-red"
            style={reduceMotion ? undefined : { scaleX: scrollYProgress }}
          />
        </div>

        <motion.div
          className={
            reduceMotion
              ? "site-shell grid gap-8"
              : "flex w-max gap-6 pl-5 pr-5 md:pl-[4vw] md:pr-[4vw]"
          }
          style={reduceMotion ? undefined : { x: trackX }}
        >
          {product.materials.map((item, index) => (
            <article
              key={item.title}
              className={
                reduceMotion
                  ? "grid gap-5 border-t border-foreground/10 pt-6 md:grid-cols-2"
                  : "grid h-[62vh] min-h-[31rem] w-[82vw] shrink-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-background/35 md:h-[66vh] md:w-[58vw] lg:w-[44vw] xl:w-[38vw]"
              }
            >
              <div className="artifact-hover-image-wrap relative min-h-[18rem] overflow-hidden bg-charcoal">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="(max-width: 768px) 82vw, 58vw"
                  className="artifact-hover-image object-cover grayscale contrast-[1.06] transition-[filter,transform] duration-700 hover:scale-[1.025] hover:grayscale-0"
                />
                <span className="absolute bottom-5 right-5 font-serif text-7xl leading-none text-white/15">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="flex items-start justify-between gap-8 border-t border-foreground/10 px-6 py-6 md:px-8">
                <div>
                  <h3 className="label-caps text-foreground">{item.title}</h3>
                  <p className="mt-3 max-w-md text-base leading-[1.75] text-foreground/65">
                    {item.body}
                  </p>
                </div>
                <span className="mt-1 h-2 w-2 shrink-0 rotate-45 border border-couture-red" />
              </div>
            </article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Symbolism ──────────────────────────────────────────────────── */
function SymbolismSection({ product }: { product: ProductSummary }) {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const imgScale = useTransform(scrollYProgress, [0, 1], [1.035, 0.995]);
  const materialTerms = product.symbolismTitle
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean);
  const bodyLead = product.symbolismBody.charAt(0);
  const bodyRemainder = product.symbolismBody.slice(1);

  return (
    <section ref={ref} className="overflow-clip border-y border-foreground/10 bg-surface py-24 md:py-36">
      <div className="site-shell">
        <header className="grid gap-8 border-b border-foreground/15 pb-9 md:grid-cols-12 md:items-end md:pb-12">
          <div className="md:col-span-9">
            <p className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-couture-red">
              <span className="h-2 w-2 rotate-45 border border-current" />
              {product.symbolismLabel}
            </p>
            <h2 className="text-balance font-serif text-[clamp(3.6rem,9vw,6rem)] leading-[0.84] tracking-[-0.035em]">
              КОД <span className="italic text-couture-red">РОДА</span>
            </h2>
          </div>
          <p className="max-w-xs text-pretty text-sm leading-7 text-foreground/55 md:col-span-3 md:pb-1">
            An inherited language, translated from ceremonial memory into an object worn close.
          </p>
        </header>

        <div className="grid border-b border-foreground/15 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <figure className="border-foreground/15 py-6 lg:border-r lg:py-9 lg:pr-9">
            <div className="relative aspect-[4/3] overflow-hidden md:aspect-[16/9]">
              <motion.div
                className="relative h-full w-full will-change-transform"
                style={reduceMotion ? undefined : { scale: imgScale }}
              >
                <Image
                  src={product.lookbook[0]?.src || product.image}
                  alt="Jewelry worn as a symbolic detail"
                  fill
                  sizes="(max-width: 1024px) 100vw, 75vw"
                  className="object-cover grayscale contrast-[1.08]"
                />
              </motion.div>
              <div className="pointer-events-none absolute inset-4 border border-white/25 md:inset-6" />
            </div>
            <figcaption className="mt-4 flex items-center justify-between gap-6 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-foreground/45">
              <span>Worn archive / Belarus</span>
              <span>Material carries memory</span>
            </figcaption>
          </figure>

          <aside className="grid grid-cols-3 border-t border-foreground/15 lg:grid-cols-1 lg:border-t-0">
            {materialTerms.map((term, index) => (
              <div
                key={term}
                className="flex min-h-24 items-center border-foreground/15 px-3 py-5 not-last:border-r lg:min-h-0 lg:px-7 lg:not-last:border-b lg:not-last:border-r-0"
              >
                <span className="mr-3 text-[0.62rem] font-semibold text-couture-red">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-foreground/70 md:text-xs">
                  {term}
                </span>
              </div>
            ))}
          </aside>
        </div>

        <div className="border-b border-foreground/15 py-10 md:py-14">
          <div className="flex flex-col gap-2 md:gap-0">
            {materialTerms.map((term, index) => (
              <p
                key={`${term}-display`}
                className={
                  index === 0
                    ? "font-serif text-[clamp(2.8rem,7vw,5.6rem)] leading-[0.9] tracking-[-0.035em]"
                    : index === 1
                      ? "self-end font-serif text-[clamp(3.2rem,8vw,6rem)] italic leading-[0.86] tracking-[-0.035em] text-couture-red md:pr-[8vw]"
                      : "max-w-full overflow-hidden text-[clamp(1.85rem,5vw,4.5rem)] font-light uppercase leading-none tracking-[0.08em] text-foreground/75"
                }
              >
                {term}
                <span className="text-couture-red">.</span>
              </p>
            ))}
          </div>
        </div>

        <div className="grid gap-12 pt-12 md:grid-cols-12 md:gap-8 md:pt-16">
          <div className="md:col-span-5">
            <p className="max-w-md text-pretty font-serif text-[clamp(1.75rem,3.5vw,3rem)] italic leading-[1.18] text-foreground/92">
              {product.symbolismBody2}
            </p>
          </div>
          <div className="md:col-span-6 md:col-start-7">
            <p className="max-w-2xl text-pretty text-base leading-[1.85] text-foreground/68 md:text-lg">
              {bodyLead && (
                <span className="float-left mr-3 mt-1 font-serif text-6xl leading-[0.72] text-couture-red">
                  {bodyLead}
                </span>
              )}
              {bodyRemainder}
            </p>
            <div className="mt-10 flex items-center gap-4" aria-hidden="true">
              <span className="h-px w-14 bg-foreground/20" />
              <span className="h-2 w-2 rotate-45 border border-couture-red" />
              <span className="h-px flex-1 bg-foreground/10" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Craftsmanship / Stats dark section ─────────────────────────── */
function CraftSection({ product, fitVideoSrc }: { product: ProductSummary; fitVideoSrc: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  async function toggleVideo() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      await video.play();
    } else {
      video.pause();
    }
  }

  return (
    <section className="relative overflow-clip border-y border-foreground/10 bg-[#09090a] py-24 text-foreground md:py-36">
      <div className="site-shell">
        <header className="grid gap-8 pb-10 md:grid-cols-12 md:items-end md:pb-14">
          <div className="md:col-span-8">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-couture-red">
              On the body
            </p>
            <h2 className="text-balance font-serif text-[clamp(3.3rem,7.5vw,6rem)] leading-[0.9] tracking-[-0.035em]">
              Made to be <span className="italic text-couture-red">worn.</span>
              <br />
              Not displayed.
            </h2>
          </div>
          <p className="max-w-sm text-pretty text-base leading-8 text-foreground/62 md:col-span-4 md:pb-1">
            Jewelry is understood differently once it meets the body. This film studies the piece in motion—its scale, weight, and changing silhouette against the hand.
          </p>
        </header>

        <figure className="border-y border-foreground/12 py-5 md:py-8">
          <div className="relative aspect-[4/5] overflow-hidden bg-charcoal md:aspect-[16/9]">
            <video
              ref={videoRef}
              className="h-full w-full object-cover grayscale contrast-[1.08]"
              src={fitVideoSrc}
              poster={product.process.mediaImage}
              autoPlay={!reduceMotion}
              muted
              loop
              playsInline
              preload="metadata"
              onPlay={() => setIsVideoPlaying(true)}
              onPause={() => setIsVideoPlaying(false)}
              aria-label={`${product.title} worn on the body`}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
            <div className="pointer-events-none absolute inset-4 border border-white/20 md:inset-7" />
            <p className="absolute left-7 top-7 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-white/72 md:left-11 md:top-11">
              Fit film / {product.series}
            </p>
            <button
              type="button"
              onClick={toggleVideo}
              aria-pressed={isVideoPlaying}
              aria-label={isVideoPlaying ? "Pause fit film" : "Play fit film"}
              className="absolute bottom-7 right-7 flex min-h-12 items-center gap-3 border border-white/30 bg-black/35 px-5 text-xs font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm transition-[background-color,border-color,transform] duration-200 hover:border-white/55 hover:bg-black/55 active:scale-[0.97] md:bottom-11 md:right-11"
            >
              <span className="flex h-5 w-5 items-center justify-center" aria-hidden="true">
                {isVideoPlaying ? (
                  <span className="flex gap-1">
                    <span className="h-3.5 w-0.5 bg-current" />
                    <span className="h-3.5 w-0.5 bg-current" />
                  </span>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </span>
              {isVideoPlaying ? "Pause" : "Play"}
            </button>
          </div>
          <figcaption className="grid gap-6 pt-5 md:grid-cols-12 md:items-start md:pt-7">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/42 md:col-span-3">
              Movement study
            </p>
            <p className="max-w-2xl text-pretty font-serif text-[clamp(1.45rem,2.6vw,2.25rem)] italic leading-[1.25] text-foreground/86 md:col-span-6">
              The layered construction changes with every gesture—graphic at rest, tactile in motion.
            </p>
            <p className="text-sm leading-7 text-foreground/52 md:col-span-3">
              {product.materialLine}
            </p>
          </figcaption>
        </figure>

        <div className="grid gap-8 pt-10 md:grid-cols-12 md:items-center md:pt-14">
          <div className="md:col-span-7">
            <p className="max-w-2xl text-pretty text-base leading-8 text-foreground/65">
              {product.shortDescription}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 md:col-span-5 md:justify-end">
            <span className="font-serif text-2xl text-foreground md:text-3xl">
              {product.price}
            </span>
            <AddToCartButton productSlug={product.slug} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Lookbook ───────────────────────────────────────────────────── */
function lookbookClasses(index: number, item: ProductSummary["lookbook"][number], total: number) {
  if (item.featured || index === 0) {
    return "md:col-span-2 md:row-span-2";
  }

  if (index === 1) {
    return "md:col-span-2";
  }

  if (total === 3 && index === 2) {
    return "col-span-2 md:col-span-2";
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
            className={`relative overflow-hidden bg-black/5 aspect-square md:aspect-auto ${lookbookClasses(i, item, product.lookbook.length)}`}
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
export function ProductDetail({ product, fitVideoSrc = "/videos/Man_bracelet_hero_web.mp4" }: { product: ProductSummary; fitVideoSrc?: string }) {
  const pageStyle = {
    "--color-background": "#09090a",
    "--color-foreground": "#eeeae4",
    "--color-muted": "#aaa49d",
    "--color-muted-ink": "#aaa49d",
    "--color-primary": "#d65a7d",
    "--color-surface": "#111114",
    "--color-stroke": "rgba(238,234,228,0.15)",
    backgroundColor: "#09090a",
  } as CSSProperties;

  return (
    <main
      className="product-detail-experience artifact-shell min-h-screen overflow-x-clip text-foreground"
      style={pageStyle}
    >
      <ProductHero product={product} />
      <MaterialsSection product={product} />
      <SymbolismSection product={product} />
      <CraftSection product={product} fitVideoSrc={fitVideoSrc} />
      <LookbookSection product={product} />
      <ProductFooter product={product} />
    </main>
  );
}
