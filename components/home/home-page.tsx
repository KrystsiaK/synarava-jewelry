/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform, useInView } from "motion/react";
import Link from "next/link";

/* ─── Types ──────────────────────────────────────────────────────── */
export interface CollectionItem {
  series: string;
  title: string;
  price: string;
  image: string;
  href: string;
}

export interface HomePageProps {
  title?: string;
  excerpt?: string;
  content?: Record<string, string>;
  collections: CollectionItem[];
}

/* ─── Helpers ────────────────────────────────────────────────────── */
function useCountUp(target: number, inView: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const duration = 2200;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const p = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target]);
  return value;
}

const ease = [0.22, 1, 0.36, 1] as const;

/* ─── HERO ───────────────────────────────────────────────────────── */
const MARQUEE_ITEMS = [
  "Handcrafted Jewelry", "◆", "Belarusian Folk Couture", "◆",
  "Lava Stone", "◆", "Oak Wood", "◆", "White Ceramic", "◆",
  "Artisan Made", "◆", "Since 2024", "◆",
];

const MATERIALS = [
  {
    label: "Oak Wood",
    description:
      "Sourced from fallen trees in the Belarusian hinterlands. Stabilized for eternity, retaining the memory of the forest.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCeoC4s0GytU2DJHgrs3Y0VtvzJzV8XnZqdlM-zu7Pj5SOSNmgf2fH0UUWquiyWXIKpNLyYe7uIZO3_8XVObSjX88ucZFaSmB7RmcgsRhsPnG7tPGc0n0_G6K7x3a5mstC1CRokMdByQ5QzcXX2nFedtwx42wOm2YsJwOSo6OzbspMc5J8qdpMsI2dZi4z_wUwpmA0QdXlFyhLvOkujl25D4nxEsU7IcGhDLxyZA3K6CO9_k9Sx1YFGtL1eqQjnZEl_HFLyG9-8uxkN",
  },
  {
    label: "Basalt Lava",
    description:
      "A symbol of earth's inner heat. Porous, raw, grounding. Each stone hand-picked for its textural narrative.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuB3bC6VRl2dzJVp1zDJ6F8LIDDaDFjwENBdbLjc5V2HyeQtnfTBNXAnOIKy0hoaL6h__BXybYEv5shYBB_miy09TC6ZVM-f9lUfrO9JOTSxhjtxl-gHz2-hWOBoerCpdanN9qPwdZpiYbcHMYvvAjywffeHeMvC421vpXHTVGgwGsYQzA-PVG_gPvPmpBYeE80XCwL9ifkN2H-IZDB9zpkEr7GBI3CQdSKYAHtXO06qS8aYl7NcL9UeS9d1GYTuH2oO9y1A4a9ZgwIU",
  },
  {
    label: "White Ceramic",
    description:
      "Fired at extreme temperatures. Each piece a canvas for traditional geometric symbols of protection.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDo0brMJO6QweYPgvVPClZ6gtXoEsD6e-ZxScM4lJ6vtH__edq9seA-CR7YVps8U1JzWeHTcIT_cpKq9MWv9wpXHmjUgemr7Ahuoai7FwxfiSTOLBCHw_dof0JzrUChWIiHy4T0T73Wh3m-mkmPrC0c2FokJ2WF9niHU5SmYy5qiSzxhcQZgC6qiZxqxNh9GQ10szMB9Te3bbw3PdffbHjIDGTZeOL6UCQ3nDKwZTdj3kOe5jQaoYsvOVaZM_SJN5oBviQ6gSa-ghUm",
  },
];

const STATS = [
  { value: 47, suffix: "", label: "Unique Pieces Crafted" },
  { value: 3, suffix: "", label: "Heritage Materials" },
  { value: 100, suffix: "%", label: "Hand-Finished" },
];

const SYMBOLISM = [
  { color: "bg-couture-red", label: "The Sun (Kola) — Energy & Life" },
  { color: "bg-charcoal", label: "The Earth (Ziamla) — Fertility & Origin" },
  { color: "bg-stone-beige", label: "The Ancestors (Dziedy) — Wisdom & Continuity" },
];

/* ─── Hero Section ───────────────────────────────────────────────── */
function HeroSection({ title, excerpt, content }: Pick<HomePageProps, "title" | "excerpt" | "content">) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);

  const headline = title ?? "Ethereal Artifacts";
  const words = headline.split(" ");

  return (
    <motion.header
      ref={ref}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background pt-20"
      style={{ opacity: textOpacity }}
    >
      {/* Grain */}
      <div
        className="pointer-events-none absolute inset-0 z-0 mix-blend-multiply opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px",
        }}
      />

      {/* Ambient red glow */}
      <div className="pointer-events-none absolute -right-40 -top-40 h-[60vw] w-[60vw] max-w-[800px] rounded-full opacity-[0.07]"
        style={{ background: "radial-gradient(circle, #a6192e 0%, transparent 65%)" }}
      />

      {/* Background wordmark */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-0 hidden justify-center overflow-hidden md:flex">
        <motion.span
          className="select-none font-serif leading-none tracking-widest text-foreground"
          style={{ fontSize: "clamp(4rem,18vw,15rem)", opacity: 0.025 }}
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 0.025 }}
          transition={{ duration: 2, ease, delay: 1 }}
        >
          SYNARAVA
        </motion.span>
      </div>

      <div
        className="pointer-events-none absolute inset-y-24 right-0 z-0 flex items-center overflow-hidden md:hidden"
        aria-hidden="true"
      >
        <motion.span
          className="select-none font-serif leading-none tracking-[0.14em] text-foreground [writing-mode:vertical-rl]"
          style={{ fontSize: "clamp(4rem,16vw,6rem)", opacity: 0.04 }}
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 0.04 }}
          transition={{ duration: 1.4, ease, delay: 0.75 }}
        >
          SYNARAVA
        </motion.span>
      </div>

      <div className="site-shell relative z-10 grid grid-cols-12 items-center gap-y-20 px-7 pb-4 pt-6 md:gap-y-20 md:px-0 md:pb-0 md:pt-0">
        {/* Text */}
        <div className="col-span-12 space-y-12 pt-8 md:col-span-6 md:space-y-14 md:pt-8">
          <motion.p
            className="label-mono text-couture-red"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease }}
          >
            {content?.eyebrow ?? "Couture Collection №01"}
          </motion.p>

          <h1
            className="max-w-[8ch] font-serif leading-[0.9] tracking-tight md:max-w-[9ch]"
            style={{ fontSize: "clamp(3rem,7.5vw,7rem)" }}
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
            className="max-w-lg pt-4 text-[1.03rem] leading-[2.1] text-muted-ink md:pt-4 md:text-[1.0625rem] md:leading-[2.05]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.65, ease }}
          >
            {excerpt ?? "Handcrafted jewelry that bridges ancient Slavic mysticism and contemporary architectural avant-garde."}
          </motion.p>

          <motion.div
            className="flex flex-col gap-6 pt-6 sm:flex-row sm:items-center sm:gap-6 md:pt-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.85, ease }}
          >
            <Link
              href={content?.ctaHref ?? "/shop"}
              className="group inline-flex cursor-pointer items-center gap-3 bg-couture-red px-8 py-4 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition-all duration-500 hover:bg-[#8f1325] active:bg-[#7a0f1f]"
            >
              <span>{content?.ctaLabel ?? "Explore Archive"}</span>
              <svg className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 12 12" fill="none">
                <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </motion.div>
        </div>

        {/* Image */}
        <div className="relative col-span-12 -mx-5 md:mx-0 md:col-span-6">
          <motion.div
            className="relative aspect-[4/5] w-full max-w-none md:mx-auto"
            style={{ y: imageY }}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.3, delay: 0.35, ease }}
          >
            <img
              alt="SYNARAVA artisan bracelet"
              className="h-full w-full object-cover brightness-[0.88] contrast-110"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDnsVq-0rj6MUqa5fbd7AAEe7cTiEGdTbjaX0-QqyRfQDJrorZweFoBNZ9jrp4c5G9YxZY1YWEUDZj3h6LEwB8covlq0TcBcRfzSY4jFtqnYKLYse3lFNPVEc424F0tMy1wYDp092U7vCp5UzzIntBvw7JQ59n6WrUHpbCWeChOdTgF_4v06jNFD2JXKrfMDAkHrNMfBf0IPjfNxpQZ6r8uZbhg3XInDox3KcDlWb6Aph9_5uCM04fmHM8cLz5jVaCrlmvjRqx1YyIr"
            />
            <div className="pointer-events-none absolute -inset-5 border border-foreground/[0.07] md:-inset-8" />
          </motion.div>

          {/* Floating diamond */}
          <motion.div
            className="absolute -right-3 top-6 hidden h-28 w-28 items-center justify-center md:-right-14 md:-top-10 md:flex md:h-40 md:w-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: [0, -12, 0] }}
            transition={{
              opacity: { duration: 1, delay: 0.5 },
              y: { duration: 5, repeat: Infinity, ease: "easeInOut" },
            }}
          >
            <div className="flex h-full w-full items-center justify-center border border-foreground/[0.09]">
              <div className="flex h-[62%] w-[62%] rotate-45 items-center justify-center border border-couture-red/50">
                <div className="-rotate-45 h-[40%] w-[40%] border border-foreground/15" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-10 left-1/2 hidden w-16 -translate-x-1/2 flex-col items-center gap-4 text-center md:flex"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.9 }}
      >
        <span className="label-mono text-foreground/35">Scroll</span>
        <div className="relative h-20 w-px overflow-hidden bg-foreground/15">
          <motion.div
            className="absolute top-0 h-1/2 w-full bg-couture-red"
            animate={{ y: ["0%", "200%"] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </motion.header>
  );
}

/* ─── Marquee Strip ──────────────────────────────────────────────── */
function MarqueeStrip() {
  const doubled = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="overflow-hidden bg-foreground py-[1.1rem]">
      <motion.div
        className="flex whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 36, repeat: Infinity, ease: "linear" }}
      >
        {doubled.map((item, i) => (
          <span
            key={i}
            className={`mx-7 font-mono text-[0.68rem] uppercase tracking-[0.28em] ${
              item === "◆" ? "text-couture-red" : "text-background/55"
            }`}
          >
            {item}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/* ─── Manifesto ──────────────────────────────────────────────────── */
function ManifestoSection({ content }: { content?: Record<string, string> }) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-12%" });

  const quote =
    content?.quote ??
    "We do not create accessories. We archive the soul of materials — wood that has witnessed centuries, stone that holds the earth's heat, and the silent rhythm of folk geometry.";
  const words = quote.split(" ");

  return (
    <section ref={ref} className="relative overflow-hidden bg-background py-24 md:py-44">
      <div className="site-shell text-center md:text-left">
        <motion.span
          className="label-caps mb-10 block text-couture-red md:mb-14"
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease }}
        >
          The Manifesto
        </motion.span>

        <blockquote
          className="mx-auto max-w-5xl font-serif italic leading-[1.4] md:mx-0"
          style={{ fontSize: "clamp(1.6rem,3.2vw,3rem)" }}
        >
          {words.map((word, i) => (
            <span key={i} className="mb-1 mr-[0.3em] inline-block overflow-hidden last:mr-0">
              <motion.span
                className="inline-block"
                initial={{ y: "110%", opacity: 0 }}
                animate={isInView ? { y: 0, opacity: 1 } : {}}
                transition={{ duration: 0.75, ease, delay: i * 0.022 }}
              >
                {word}
              </motion.span>
            </span>
          ))}
        </blockquote>

        <motion.footer
          className="mt-12 flex flex-col items-center justify-center gap-4 md:mt-16 md:items-start md:justify-start md:gap-5"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 1 }}
        >
          <span className="label-mono text-muted-ink">Synarava Studio, 2024</span>
          <div className="flex items-center justify-center gap-5">
            <div className="h-px w-14 bg-stone-beige" />
            <div className="h-2 w-2 rotate-45 border border-couture-red" />
            <div className="h-px w-14 bg-stone-beige" />
          </div>
        </motion.footer>
      </div>

      <div
        className="pointer-events-none absolute -right-8 top-1/2 hidden -translate-y-1/2 select-none overflow-hidden md:block"
        style={{ writingMode: "vertical-rl" }}
      >
        <span
          className="font-serif leading-none text-foreground"
          style={{ fontSize: "clamp(5rem,12vw,10rem)", opacity: 0.025 }}
        >
          FOLK COUTURE
        </span>
      </div>
    </section>
  );
}

/* ─── Collections Grid ───────────────────────────────────────────── */
function CollectionsSection({ collections, content }: Pick<HomePageProps, "collections" | "content">) {
  const headerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(headerRef, { once: true, margin: "-8%" });

  return (
    <section className="bg-surface py-20 md:py-36">
      <div className="site-shell">
        {/* Header */}
        <div ref={headerRef} className="mb-14 flex flex-col gap-4 md:mb-20 md:flex-row md:items-end md:justify-between">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease }}
          >
            <p className="label-mono mb-3 text-muted-ink">Collections 2024</p>
            <h3 className="font-serif" style={{ fontSize: "clamp(2rem,4vw,3rem)" }}>
              {content?.secondaryTitle ?? "Current Archive"}
            </h3>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.7, delay: 0.25 }}
          >
            <Link
              href="/collections"
              className="group inline-flex cursor-pointer items-center gap-2 label-caps border-b border-foreground/25 pb-1.5 transition-all hover:border-couture-red hover:text-couture-red"
            >
              View All Series
              <svg className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 12 12" fill="none">
                <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </motion.div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8 md:items-start">
          {collections.map((item, i) => (
            <CollectionCard key={item.series} item={item} index={i} isParentInView={isInView} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CollectionCard({
  item,
  index,
  isParentInView,
}: {
  item: CollectionItem;
  index: number;
  isParentInView: boolean;
}) {
  const offsetClass = index === 1 ? "md:mt-14" : index === 2 ? "md:-mt-6" : "";
  return (
    <motion.div
      className={offsetClass}
      initial={{ opacity: 0, y: 52 }}
      animate={isParentInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.9, ease, delay: 0.1 + index * 0.13 }}
    >
      <Link href={item.href} className="group block cursor-pointer">
        <div className="relative mb-5 aspect-[3/4] overflow-hidden bg-stone-beige">
          <img
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-700 will-change-transform group-hover:scale-105"
            src={item.image}
          />
          <div className="absolute inset-0 bg-foreground/0 transition-colors duration-500 group-hover:bg-foreground/[0.08]" />
          {/* Hover price badge */}
          <div className="absolute bottom-4 right-4 translate-y-2 bg-background px-4 py-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <span className="label-mono text-foreground">{item.price}</span>
          </div>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <p className="label-mono mb-1 text-muted-ink">{item.series}</p>
            <h4
              className="font-serif transition-colors duration-300 group-hover:text-couture-red"
              style={{ fontSize: "clamp(1.2rem,1.8vw,1.5rem)" }}
            >
              {item.title}
            </h4>
          </div>
          <span className="label-mono text-muted-ink transition-colors duration-300 group-hover:text-couture-red">
            {item.price}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

/* ─── Materials ──────────────────────────────────────────────────── */
function MaterialsSection() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <section ref={ref} className="bg-foreground py-20 text-background md:py-36">
      <div className="site-shell">
        <motion.div
          className="mb-14 md:mb-20"
          initial={{ opacity: 0, y: 28 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease }}
        >
          <p className="label-mono mb-4 text-couture-red">02 // Materials</p>
          <h3
            className="max-w-lg font-serif"
            style={{ fontSize: "clamp(2rem,4vw,3rem)" }}
          >
            From Earth to Form
          </h3>
        </motion.div>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
          {MATERIALS.map((mat, i) => (
            <motion.div
              key={mat.label}
              className={`group${i === 1 ? " md:mt-16" : ""}`}
              initial={{ opacity: 0, y: 44 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.85, ease, delay: i * 0.14 }}
            >
              <div className="mb-6 aspect-[4/5] w-full overflow-hidden">
                <img
                  alt={mat.label}
                  className="h-full w-full object-cover grayscale transition-all duration-700 will-change-transform group-hover:scale-[1.04] group-hover:grayscale-0"
                  src={mat.image}
                />
              </div>
              <p className="label-caps mb-3 text-couture-red">{mat.label}</p>
              <p className="text-sm leading-[1.9] text-background/65 md:text-base">{mat.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Stats ──────────────────────────────────────────────────────── */
function StatItem({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-20%" });
  const count = useCountUp(value, isInView);

  return (
    <div ref={ref} className="flex flex-col items-center gap-3 text-center">
      <motion.span
        className="font-serif leading-none text-background"
        style={{ fontSize: "clamp(3.5rem,7vw,6rem)" }}
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, ease }}
      >
        {count}
        {suffix}
      </motion.span>
      <motion.p
        className="label-mono text-background/45"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        {label}
      </motion.p>
    </div>
  );
}

function StatsSection() {
  return (
    <section className="border-y border-foreground/10 bg-foreground py-16 md:py-24">
      <div className="site-shell">
        <div className="grid grid-cols-1 gap-14 md:grid-cols-3 md:gap-8">
          {STATS.map((s) => (
            <StatItem key={s.label} value={s.value} suffix={s.suffix} label={s.label} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Heritage ───────────────────────────────────────────────────── */
function HeritageSection() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <section ref={ref} className="bg-background py-20 md:py-40">
      <div className="site-shell">
        <div className="flex flex-col items-start gap-0 md:flex-row">
          {/* Image */}
          <motion.div
            className="w-full md:w-1/2"
            initial={{ opacity: 0, x: -32 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 1, ease }}
          >
            <img
              alt="Traditional craft"
              className="aspect-square w-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCeoC4s0GytU2DJHgrs3Y0VtvzJzV8XnZqdlM-zu7Pj5SOSNmgf2fH0UUWquiyWXIKpNLyYe7uIZO3_8XVObSjX88ucZFaSmB7RmcgsRhsPnG7tPGc0n0_G6K7x3a5mstC1CRokMdByQ5QzcXX2nFedtwx42wOm2YsJwOSo6OzbspMc5J8qdpMsI2dZi4z_wUwpmA0QdXlFyhLvOkujl25D4nxEsU7IcGhDLxyZA3K6CO9_k9Sx1YFGtL1eqQjnZEl_HFLyG9-8uxkN"
            />
          </motion.div>

          {/* Glass card */}
          <motion.div
            className="etched-glass relative z-10 w-full border border-charcoal/5 p-8 md:-ml-24 md:mt-36 md:w-1/2 md:p-14"
            initial={{ opacity: 0, x: 32 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 1, ease, delay: 0.15 }}
          >
            <span className="label-caps mb-6 block text-couture-red md:mb-8">03 // Symbolism</span>
            <h3 className="mb-6 font-serif md:mb-8" style={{ fontSize: "clamp(1.7rem,3vw,2.4rem)" }}>
              The Geometry of Protection
            </h3>
            <p className="mb-8 text-base leading-[1.85] text-foreground/70 md:mb-10 md:text-[1.0625rem]">
              Every pattern is a word. Every knot is a prayer. We integrate ancestral embroidery
              motifs into modern jewelry, transforming adornment into a talisman for the modern world.
            </p>
            <ul className="space-y-3.5 font-mono text-[0.76rem] uppercase tracking-[0.16em]">
              {SYMBOLISM.map((pt) => (
                <li key={pt.label} className="flex items-center gap-3.5">
                  <span className={`h-2 w-2 shrink-0 rotate-45 ${pt.color}`} />
                  <span>{pt.label}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function FolkSpiderOrnament() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="mx-auto mb-10 flex w-fit origin-top justify-center text-foreground/40 dark:text-background/84 md:mb-12"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.85, ease }}
    >
      <motion.svg
        aria-hidden="true"
        className="h-28 w-28 md:h-32 md:w-32"
        viewBox="0 0 160 176"
        fill="none"
        animate={
          reduceMotion
            ? undefined
            : {
                rotate: [0, 3.2, -2.2, 1.4, 0],
                y: [0, 4, -2, 2, 0],
              }
        }
        transition={
          reduceMotion
            ? undefined
            : {
                duration: 8.5,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
              }
        }
        style={{ transformOrigin: "50% 0%" }}
      >
        <path d="M80 0V18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M80 18V34" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.72" />

        <path d="M80 34L108 62L80 90L52 62L80 34Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M80 46L96 62L80 78L64 62L80 46Z" stroke="currentColor" strokeWidth="1.1" opacity="0.9" />
        <path d="M80 54L88 62L80 70L72 62L80 54Z" stroke="currentColor" strokeWidth="1" opacity="0.82" />

        <path d="M38 62H122" stroke="currentColor" strokeWidth="1" opacity="0.55" />
        <path d="M48 74H112" stroke="currentColor" strokeWidth="0.9" opacity="0.48" />
        <path d="M52 50H108" stroke="currentColor" strokeWidth="0.9" opacity="0.48" />

        <path d="M60 84L80 104L100 84" stroke="currentColor" strokeWidth="1.05" opacity="0.78" />
        <path d="M80 90V122" stroke="currentColor" strokeWidth="1.1" opacity="0.72" />

        <path d="M80 104L120 124" stroke="currentColor" strokeWidth="0.9" opacity="0.62" />
        <path d="M80 104L40 124" stroke="currentColor" strokeWidth="0.9" opacity="0.62" />
        <path d="M80 114L108 138" stroke="currentColor" strokeWidth="0.85" opacity="0.48" />
        <path d="M80 114L52 138" stroke="currentColor" strokeWidth="0.85" opacity="0.48" />

        <path d="M32 124L40 132L32 140L24 132L32 124Z" stroke="currentColor" strokeWidth="0.95" opacity="0.86" />
        <path d="M128 124L136 132L128 140L120 132L128 124Z" stroke="currentColor" strokeWidth="0.95" opacity="0.86" />
        <path d="M44 140L52 148L44 156L36 148L44 140Z" stroke="currentColor" strokeWidth="0.85" opacity="0.65" />
        <path d="M116 140L124 148L116 156L108 148L116 140Z" stroke="currentColor" strokeWidth="0.85" opacity="0.65" />

        <path d="M80 126L92 138L80 150L68 138L80 126Z" stroke="currentColor" strokeWidth="1" opacity="0.76" />
        <path d="M80 150V170" stroke="currentColor" strokeWidth="1" opacity="0.58" />
        <path d="M72 170H88" stroke="currentColor" strokeWidth="1" opacity="0.45" />

        <circle cx="80" cy="62" r="2.2" fill="currentColor" opacity="0.8" />
      </motion.svg>
    </motion.div>
  );
}

/* ─── Final CTA ──────────────────────────────────────────────────── */
function FinalCTA() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);

  return (
    <section ref={ref} className="relative overflow-hidden bg-surface py-0">
      {/* Soft background image with parallax */}
      <motion.div className="absolute inset-0 opacity-30" style={{ y: bgY }}>
        <img
          alt="Gallery space"
          className="h-full w-full scale-110 object-cover grayscale contrast-[0.9] brightness-[1.02]"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBlRjmhQRA-wxjueCOYYPh4npb_AwMuPibdeIi2xBnyzR6aYtnPozn9EXkqQs10M5j72a9Atq1kDdq_5pSYtM-T0IB5fPIEHyJeAuFNam5J8DWrxnTvLIF7IBocQHDm2RM38UDGNVZkP5F-iaJ7Ak7cEckBiQiR5WlNdz2CQAOR_HNTAVMF6Ffgge-YsqtxlAnWX_NgFcmd9MEIUgbno4x7uc6zMgiJk8mH649KBJetEKbQkt75J8_hBuYsX8S7b7_cVJ0ytra6MdMc"
        />
        <div className="absolute inset-0 bg-surface/72" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.03)_100%)]" />
      </motion.div>

      {/* Content */}
      <div className="relative z-10 flex min-h-[70vh] items-center justify-center py-24 md:py-36">
        <div className="site-shell text-center text-foreground dark:text-background">
          <FolkSpiderOrnament />
          <motion.p
            className="label-mono mb-8 text-couture-red"
            initial={{ opacity: 0, y: 16 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease }}
          >
            Ready to begin
          </motion.p>
          <motion.h2
            className="mx-auto mb-6 max-w-3xl font-serif leading-[1.05] text-foreground dark:text-background md:mb-8"
            style={{ fontSize: "clamp(2.2rem,5.5vw,5rem)" }}
            initial={{ opacity: 0, y: 28 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.9, ease, delay: 0.1 }}
          >
            Begin Your Collection
          </motion.h2>
          <motion.p
            className="mx-auto mb-12 max-w-lg text-base leading-[1.85] text-foreground/62 dark:text-background/72 md:mb-16 md:text-[1.0625rem]"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease, delay: 0.22 }}
          >
            Each piece is a singular artifact — handcrafted, numbered, and rooted in centuries of
            Belarusian heritage. Yours to carry forward.
          </motion.p>
          <motion.div
            className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-5"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease, delay: 0.34 }}
          >
            <Link
              href="/shop"
              className="group inline-flex cursor-pointer items-center gap-3 bg-couture-red px-8 py-4 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white transition-all duration-500 hover:bg-[#8f1325] active:bg-[#7a0f1f]"
            >
              <span>Shop the Collection</span>
              <svg className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 12 12" fill="none">
                <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              href="/about"
              className="inline-flex cursor-pointer items-center gap-2 border-b border-foreground/24 pb-1 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-foreground/78 transition-colors duration-300 hover:border-foreground hover:text-foreground dark:border-background/55 dark:text-background/90 dark:hover:border-background dark:hover:text-background"
            >
              Learn Our Story
            </Link>
          </motion.div>

        </div>
      </div>
    </section>
  );
}

/* ─── Root Export ────────────────────────────────────────────────── */
export function HomePage({ title, excerpt, content, collections }: HomePageProps) {
  return (
    <main className="artifact-shell min-h-screen overflow-x-hidden">
      <HeroSection title={title} excerpt={excerpt} content={content} />
      <MarqueeStrip />
      <ManifestoSection content={content} />
      <CollectionsSection collections={collections} content={content} />
      <MaterialsSection />
      <StatsSection />
      <HeritageSection />
      <FinalCTA />
    </main>
  );
}
