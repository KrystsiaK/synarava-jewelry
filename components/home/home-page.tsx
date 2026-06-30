"use client";

import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  AnimatePresence,
} from "motion/react";
import Link from "next/link";

import { ease, GRAIN_STYLE } from "@/lib/animation";
import { useCountUp } from "@/lib/hooks/use-count-up";
import { ShinyText, PrimaryCtaButton } from "@/components/ui";
import {
  KodRoda,
  KodRodaStatic,
  Kola,
  KolaStatic,
  Ziamla,
  ZiamlaStatic,
  FolkBorder,
  FolkSpiderOrnament,
} from "@/components/ui/folk-patterns";

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

/* ─── Page-local data constants ──────────────────────────────────── */
const MARQUEE_ROW_A = [
  "Handcrafted Jewelry", "◆", "Belarusian Folk Couture", "◆",
  "Lava Stone", "◆", "Oak Wood", "◆", "White Ceramic", "◆",
  "Artisan Made", "◆", "Since 2024", "◆",
];

const ROTATING_WORDS = ["Timeless", "Sacred", "Eternal", "Ancestral", "Singular"];

const MATERIALS = [
  {
    label: "Oak Wood",
    description:
      "Sourced from fallen trees in the Belarusian hinterlands. Stabilized for eternity, retaining the memory of the forest.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCeoC4s0GytU2DJHgrs3Y0VtvzJzV8XnZqdlM-zu7Pj5SOSNmgf2fH0UUWquiyWXIKpNLyYe7uIZO3_8XVObSjX88ucZFaSmB7RmcgsRhsPnG7tPGc0n0_G6K7x3a5mstC1CRokMdByQ5QzcXX2nFedtwx42wOm2YsJwOSo6OzbspMc5J8qdpMsI2dZi4z_wUwpmA0QdXlFyhLvOkujl25D4nxEsU7IcGhDLxyZA3K6CO9_k9Sx1YFGtL1eqQjnZEl_HFLyG9-8uxkN",
    glowColor: "rgba(139,94,60,0.4)",
  },
  {
    label: "Basalt Lava",
    description:
      "A symbol of earth's inner heat. Porous, raw, grounding. Each stone hand-picked for its textural narrative.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuB3bC6VRl2dzJVp1zDJ6F8LIDDaDFjwENBdbLjc5V2HyeQtnfTBNXAnOIKy0hoaL6h__BXybYEv5shYBB_miy09TC6ZVM-f9lUfrO9JOTSxhjtxl-gHz2-hWOBoerCpdanN9qPwdZpiYbcHMYvvAjywffeHeMvC421vpXHTVGgwGsYQzA-PVG_gPvPmpBYeE80XCwL9ifkN2H-IZDB9zpkEr7GBI3CQdSKYAHtXO06qS8aYl7NcL9UeS9d1GYTuH2oO9y1A4a9ZgwIU",
    glowColor: "rgba(58,58,58,0.5)",
  },
  {
    label: "White Ceramic",
    description:
      "Fired at extreme temperatures. Each piece a canvas for traditional geometric symbols of protection.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDo0brMJO6QweYPgvVPClZ6gtXoEsD6e-ZxScM4lJ6vtH__edq9seA-CR7YVps8U1JzWeHTcIT_cpKq9MWv9wpXHmjUgemr7Ahuoai7FwxfiSTOLBCHw_dof0JzrUChWIiHy4T0T73Wh3m-mkmPrC0c2FokJ2WF9niHU5SmYy5qiSzxhcQZgC6qiZxqxNh9GQ10szMB9Te3bbw3PdffbHjIDGTZeOL6UCQ3nDKwZTdj3kOe5jQaoYsvOVaZM_SJN5oBviQ6gSa-ghUm",
    glowColor: "rgba(217,212,204,0.35)",
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

const ATELIER_STEPS = [
  {
    num: "01",
    title: "Material Selection",
    body: "We travel to source each raw material — fallen oak, volcanic basalt, kiln-fired ceramic. Only pieces with the right resonance are chosen.",
  },
  {
    num: "02",
    title: "Hand Shaping",
    body: "Every form is carved, sculpted, and shaped entirely by hand. No two pieces share the same silhouette — each bears the artist's fingerprint.",
  },
  {
    num: "03",
    title: "Symbol Inscription",
    body: "Ancient Belarusian protective motifs are engraved or painted onto the surface, infusing every piece with ancestral intention.",
  },
];

function splitHeadlineIntoAnimatedTokens(headline: string) {
  const normalized = headline.trim().replace(/\s+/g, " ");

  if (normalized.includes(" ")) {
    return normalized.split(" ");
  }

  const camelCaseChunks = normalized.match(/[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+/g);
  if (camelCaseChunks && camelCaseChunks.length > 1) {
    return camelCaseChunks;
  }

  return normalized.match(/.{1,10}/g) ?? [normalized];
}

/* ─── RotatingText ───────────────────────────────────────────────── */
function RotatingText() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % ROTATING_WORDS.length), 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="relative inline-block overflow-hidden align-middle" style={{ minWidth: "7ch" }}>
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          className="inline-block text-couture-red"
          initial={{ y: "110%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-110%", opacity: 0 }}
          transition={{ duration: 0.45, ease }}
        >
          {ROTATING_WORDS[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/* ─── Hero ───────────────────────────────────────────────────────── */
function HeroSection({
  title,
  excerpt,
  content,
}: Pick<HomePageProps, "title" | "excerpt" | "content">) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const textY = useTransform(scrollYProgress, [0, 0.5], ["0%", "-8%"]);

  const headline = title ?? "Ethereal Artifacts";
  const words = splitHeadlineIntoAnimatedTokens(headline);

  return (
    <motion.header
      ref={ref}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background pt-20"
    >
      {/* Grain */}
      <div
        className="pointer-events-none absolute inset-0 z-0 mix-blend-multiply opacity-[0.04]"
        style={GRAIN_STYLE}
      />

      {/* KodRoda ghost pattern */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-end overflow-hidden opacity-[0.04]">
        <KodRodaStatic className="h-[80vw] w-[80vw] max-h-[720px] max-w-[720px] translate-x-[20%] text-foreground" />
      </div>

      {/* Ambient glows */}
      <div
        className="pointer-events-none absolute -right-60 -top-60 h-[70vw] w-[70vw] max-w-[900px] rounded-full"
        style={{
          background: "radial-gradient(circle, #a6192e 0%, transparent 65%)",
          opacity: 0.09,
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -left-40 h-[50vw] w-[50vw] max-w-[600px] rounded-full"
        style={{
          background: "radial-gradient(circle, #c78f73 0%, transparent 65%)",
          opacity: 0.05,
        }}
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

      {/* Mobile vertical wordmark */}
      <div className="pointer-events-none absolute inset-y-24 right-0 z-0 flex items-center overflow-hidden md:hidden" aria-hidden="true">
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

      <motion.div
        className="site-shell relative z-10 grid grid-cols-12 items-center gap-y-20 px-7 pb-4 pt-6 md:gap-y-20 md:px-0 md:pb-0 md:pt-0"
        style={{ opacity: textOpacity, y: textY }}
      >
        {/* Text */}
        <div className="col-span-12 space-y-10 pt-8 md:col-span-6 md:space-y-12 md:pt-8">
          <motion.p
            className="label-mono text-couture-red"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease }}
          >
            {content?.eyebrow ?? "Couture Collection №01"}
          </motion.p>

          <div>
            <h1
              className="max-w-[10ch] text-balance font-serif leading-[0.92] tracking-tight [overflow-wrap:anywhere]"
              style={{ fontSize: "clamp(2.8rem,7vw,6.5rem)" }}
            >
              {words.map((word, i) => (
                <span key={`${word}-${i}`} className="mr-[0.2em] inline-block max-w-full overflow-hidden last:mr-0">
                  <motion.span
                    className="inline-block max-w-full"
                    initial={{ y: "110%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 1, ease, delay: 0.15 + i * 0.12 }}
                  >
                    <ShinyText>{word}</ShinyText>
                  </motion.span>
                </span>
              ))}
            </h1>

            <motion.div
              className="mt-4 font-serif italic leading-none"
              style={{ fontSize: "clamp(1.3rem,2.8vw,2.6rem)", opacity: 0.72 }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 0.72, y: 0 }}
              transition={{ duration: 0.9, delay: 0.85, ease }}
            >
              <RotatingText />
            </motion.div>
          </div>

          <motion.p
            className="max-w-lg text-[1.03rem] leading-[2.1] text-muted-ink"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.65, ease }}
          >
            {excerpt ??
              "Handcrafted jewelry that bridges ancient Slavic mysticism and contemporary architectural avant-garde."}
          </motion.p>

          <motion.div
            className="flex flex-col gap-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.9, ease }}
          >
            <PrimaryCtaButton href={content?.ctaHref ?? "/shop"} className="self-start">
              {content?.ctaLabel ?? "All products"}
            </PrimaryCtaButton>
          </motion.div>
        </div>

        {/* Image */}
        <div className="relative col-span-12 -mx-5 md:mx-0 md:col-span-6">
          <motion.div
            className="relative aspect-[4/5] w-full max-w-none md:mx-auto"
            style={{ y: imageY }}
            initial={{ opacity: 0, scale: 0.93 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.4, delay: 0.3, ease }}
          >
            <Image
              fill
              priority
              alt="SYNARAVA artisan bracelet"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDnsVq-0rj6MUqa5fbd7AAEe7cTiEGdTbjaX0-QqyRfQDJrorZweFoBNZ9jrp4c5G9YxZY1YWEUDZj3h6LEwB8covlq0TcBcRfzSY4jFtqnYKLYse3lFNPVEc424F0tMy1wYDp092U7vCp5UzzIntBvw7JQ59n6WrUHpbCWeChOdTgF_4v06jNFD2JXKrfMDAkHrNMfBf0IPjfNxpQZ6r8uZbhg3XInDox3KcDlWb6Aph9_5uCM04fmHM8cLz5jVaCrlmvjRqx1YyIr"
              className="object-cover brightness-[0.86] contrast-[1.12]"
              sizes="(max-width: 768px) 100vw, 50vw"
            />

            {/* Red bottom vignette */}
            <div
              className="pointer-events-none absolute bottom-0 left-0 right-0 h-1/3"
              style={{ background: "linear-gradient(to top, rgba(166,25,46,0.2) 0%, transparent 100%)" }}
            />

            {/* Frame */}
            <div className="pointer-events-none absolute -inset-5 border border-foreground/[0.07] md:-inset-8" />

            {/* Corner accents */}
            <motion.div
              className="absolute left-4 top-4 h-10 w-10 border-l border-t border-couture-red/60"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 1.3, ease }}
            />
            <motion.div
              className="absolute bottom-4 right-4 h-10 w-10 border-b border-r border-couture-red/60"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 1.45, ease }}
            />

          </motion.div>

          {/* Floating diamond */}
          <motion.div
            className="absolute -right-3 top-6 hidden h-28 w-28 items-center justify-center md:-right-14 md:-top-10 md:flex md:h-40 md:w-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
          >
            <div className="flex h-full w-full items-center justify-center border border-foreground/[0.09]">
              <div className="flex h-[62%] w-[62%] rotate-45 items-center justify-center border border-couture-red/50">
                <div className="-rotate-45 h-[40%] w-[40%] border border-foreground/15" />
              </div>
            </div>
          </motion.div>

          {/* Pieces badge */}
          <motion.div
            className="absolute -left-2 bottom-10 hidden min-w-[9.5rem] flex-col gap-1 border border-foreground/[0.08] bg-background/85 px-4 py-3 backdrop-blur-sm md:flex lg:-left-4 lg:bottom-16"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 1.6, ease }}
          >
            <span className="font-serif text-2xl leading-none">47</span>
            <span className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-ink lg:text-[0.65rem] lg:tracking-[0.2em]">
              <span className="block whitespace-pre-line leading-[1.22]">
                Pieces crafted
              </span>
            </span>
          </motion.div>
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-10 left-1/2 hidden w-16 -translate-x-1/2 flex-col items-center gap-4 text-center md:flex"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.9, duration: 0.9 }}
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

/* ─── Dual Marquee ───────────────────────────────────────────────── */
function MarqueeStrip() {
  const dA = [...MARQUEE_ROW_A, ...MARQUEE_ROW_A];

  return (
    <div className="overflow-hidden bg-foreground">
      <div className="overflow-hidden border-b border-background/[0.06] py-[0.85rem]">
        <motion.div
          className="flex whitespace-nowrap"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 36, repeat: Infinity, ease: "linear" }}
        >
          {dA.map((item, i) => (
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
    </div>
  );
}

/* ─── Manifesto ──────────────────────────────────────────────────── */
function ManifestoSection({ content }: { content?: Record<string, string> }) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-12%" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const bgScale = useTransform(scrollYProgress, [0, 1], [0.88, 1.06]);

  const quote =
    content?.quote ??
    "We do not create accessories. We archive the soul of materials — wood that has witnessed centuries, stone that holds the earth's heat, and the silent rhythm of folk geometry.";

  return (
    <section ref={ref} className="relative overflow-hidden bg-background py-24 md:py-52">
      {/* Background kinetic text */}
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{ scale: bgScale }}
      >
        <span
          className="select-none text-center font-serif leading-none text-foreground"
          style={{ fontSize: "clamp(4rem,18vw,16rem)", opacity: 0.022, whiteSpace: "nowrap" }}
        >
          MANIFESTO
        </span>
      </motion.div>

      {/* Ghost Kola */}
      <div className="pointer-events-none absolute left-0 top-1/2 -translate-x-1/3 -translate-y-1/2 opacity-[0.038]">
        <KolaStatic className="h-[55vw] w-[55vw] max-h-[560px] max-w-[560px] text-foreground" />
      </div>

      <div className="site-shell relative z-10 text-center md:text-left">
        <motion.span
          className="label-caps mb-10 block text-couture-red md:mb-14"
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease }}
        >
          The Manifesto
        </motion.span>

        {/* Single block quote animation instead of per-word */}
        <motion.blockquote
          className="mx-auto max-w-5xl font-serif italic leading-[1.4] md:mx-0"
          style={{ fontSize: "clamp(1.6rem,3.2vw,3rem)" }}
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, ease, delay: 0.15 }}
        >
          {quote}
        </motion.blockquote>

        <motion.footer
          className="mt-12 flex flex-col items-center justify-center gap-4 md:mt-16 md:items-start md:justify-start md:gap-5"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.55 }}
        >
          <span className="label-mono text-muted-ink">
            Synarava Studio, 2024
          </span>
          <div className="flex items-center justify-center gap-5">
            <motion.div
              className="h-px w-14 bg-stone-beige"
              initial={{ scaleX: 0 }}
              animate={isInView ? { scaleX: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.65 }}
              style={{ transformOrigin: "left" }}
            />
            <div className="h-2 w-2 rotate-45 border border-couture-red" />
            <motion.div
              className="h-px w-14 bg-stone-beige"
              initial={{ scaleX: 0 }}
              animate={isInView ? { scaleX: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.75 }}
              style={{ transformOrigin: "right" }}
            />
          </div>
        </motion.footer>
      </div>

      <div className="site-shell relative z-10 mt-16 md:mt-24">
        <FolkBorder className="w-full text-foreground/20" />
      </div>
    </section>
  );
}

/* ─── Collections Grid ───────────────────────────────────────────── */
function CollectionsSection({
  collections,
  content,
}: Pick<HomePageProps, "collections" | "content">) {
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
            <p className="label-mono mb-3 text-muted-ink">
              Collections 2024
            </p>
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
              <svg
                className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M1 6h10M7 2l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:items-start md:gap-8">
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <motion.div
          className="relative mb-5 aspect-[3/4] overflow-hidden bg-stone-beige"
          initial="rest"
          whileHover="hover"
          animate="rest"
        >
          <motion.img
            alt={item.title}
            className="h-full w-full object-cover will-change-transform"
            src={item.image}
            variants={{
              rest: { scale: 1 },
              hover: { scale: 1.07 },
            }}
            transition={{ type: "spring", stiffness: 260, damping: 32 }}
          />

          <motion.div
            className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-foreground/75 via-foreground/30 to-transparent p-5"
            variants={{
              rest: { opacity: 0, y: "30%" },
              hover: { opacity: 1, y: "0%" },
            }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            <p className="label-mono mb-1 text-[0.65rem] text-white/80">{item.series}</p>
            <div className="flex items-center justify-between">
              <p
                className="font-serif text-white"
                style={{ fontSize: "clamp(1rem,1.5vw,1.25rem)" }}
              >
                {item.title}
              </p>
              <span className="label-mono text-[0.68rem] text-couture-red">{item.price}</span>
            </div>
          </motion.div>

          <motion.div
            className="absolute bottom-0 left-0 h-0.5 bg-couture-red"
            variants={{
              rest: { width: "0%" },
              hover: { width: "100%" },
            }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          />
        </motion.div>

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

/* ─── The Atelier ────────────────────────────────────────────────── */
function AtelierSection() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const lineScaleX = useTransform(scrollYProgress, [0.05, 0.65], [0, 1]);

  return (
    <section ref={ref} className="relative overflow-hidden bg-background py-20 md:py-44">
      {/* Ghost number */}
      <div className="pointer-events-none absolute right-0 top-0 select-none overflow-hidden">
        <span
          className="font-serif text-foreground"
          style={{ fontSize: "clamp(8rem,22vw,20rem)", opacity: 0.025, lineHeight: 0.85 }}
        >
          02
        </span>
      </div>

      {/* Ziamla ghost */}
      <div className="pointer-events-none absolute left-0 top-1/2 -translate-x-1/4 -translate-y-1/2 opacity-[0.04]">
        <ZiamlaStatic className="h-[60vw] w-[60vw] max-h-[580px] max-w-[580px] text-foreground" />
      </div>

      <div className="site-shell">
        <motion.div
          className="mb-16 md:mb-24"
          initial={{ opacity: 0, y: 28 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease }}
        >
          <p className="label-mono mb-4 text-couture-red">02 // The Atelier</p>
          <h3 className="max-w-xl font-serif" style={{ fontSize: "clamp(2rem,4vw,3rem)" }}>
            The Making
          </h3>
        </motion.div>

        {/* Progress timeline bar */}
        <div className="relative mb-0 hidden h-px bg-foreground/[0.08] md:block">
          <motion.div
            className="absolute left-0 top-0 h-full origin-left bg-couture-red"
            style={{ scaleX: lineScaleX }}
          />
        </div>

        <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-0">
          {ATELIER_STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              className="relative border-t border-foreground/10 pt-8 md:pr-16"
              initial={{ opacity: 0, y: 44 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.85, ease, delay: 0.1 + i * 0.18 }}
            >
              <motion.div
                className="absolute -top-[5px] left-0 hidden h-2.5 w-2.5 rounded-full bg-couture-red md:block"
                initial={{ scale: 0 }}
                animate={isInView ? { scale: 1 } : {}}
                transition={{
                  duration: 0.4,
                  delay: 0.45 + i * 0.2,
                  type: "spring",
                  stiffness: 400,
                }}
              />
              <p className="label-mono mb-5 text-couture-red">{step.num}</p>
              <h4 className="mb-4 font-serif" style={{ fontSize: "clamp(1.3rem,2vw,1.7rem)" }}>
                {step.title}
              </h4>
              <p className="text-sm leading-[1.9] text-muted-ink md:text-base">
                {step.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Folk Pattern Interlude ─────────────────────────────────────── */
function PatternInterlude() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-8%" });

  const patterns = [
    {
      Svg: KodRoda,
      name: "Kod Roda",
      sub: "Ancestral Cipher",
      desc: "A diamond lattice encoding lineage and protection. Found on ceremonial linens for centuries.",
    },
    {
      Svg: Kola,
      name: "Kola",
      sub: "Solar Wheel",
      desc: "The ancient 8-spoked sun symbol — energy, life force, and the cyclical nature of time.",
    },
    {
      Svg: Ziamla,
      name: "Ziamla",
      sub: "Earth Grid",
      desc: "Nested squares anchoring the wearer — symbol of fertility, material origin, and permanence.",
    },
  ] as const;

  return (
    <section ref={ref} className="relative overflow-hidden bg-foreground py-20 text-background md:py-32">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <span className="select-none font-serif leading-none text-background"
          style={{ fontSize: "clamp(5rem,18vw,15rem)", opacity: 0.022, whiteSpace: "nowrap", letterSpacing: "0.06em" }}>
          УЗОРЫ
        </span>
      </div>

      <div className="site-shell relative z-10">
        <motion.div
          className="mb-14 text-center md:mb-20"
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease }}
        >
          <p className="label-mono mb-3 text-couture-red">Folk Geometry</p>
          <h3 className="font-serif" style={{ fontSize: "clamp(1.8rem,3.5vw,2.8rem)" }}>
            The Symbols We Carry
          </h3>
        </motion.div>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
          {patterns.map(({ Svg, name, sub, desc }, i) => (
            <motion.div
              key={name}
              className="group text-center"
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.85, ease, delay: i * 0.16 }}
            >
              <div className="relative mb-8 flex items-center justify-center">
                <Svg className="h-44 w-44 text-background/65 transition-colors duration-700 group-hover:text-couture-red md:h-48 md:w-48" />
              </div>
              <motion.div
                className="mx-auto mb-6 h-px bg-background/15"
                initial={{ scaleX: 0 }}
                animate={isInView ? { scaleX: 1 } : {}}
                transition={{ duration: 1, ease, delay: 0.4 + i * 0.16 }}
                style={{ transformOrigin: "center" }}
              />
              <p className="label-caps mb-1 text-couture-red">{name}</p>
              <p className="label-mono mb-4 text-background/40">{sub}</p>
              <p className="text-sm leading-[1.9] text-background/55 md:text-base">
                {desc}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="mt-16 md:mt-24">
          <FolkBorder className="w-full text-background/25" />
        </div>
      </div>
    </section>
  );
}

/* ─── Materials ──────────────────────────────────────────────────── */
function MaterialsSection() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <section ref={ref} className="bg-foreground py-20 text-background md:py-40">
      <div className="site-shell">
        <motion.div
          className="mb-14 md:mb-24"
          initial={{ opacity: 0, y: 28 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease }}
        >
          <p className="label-mono mb-4 text-couture-red">03 // Materials</p>
          <h3 className="max-w-lg font-serif" style={{ fontSize: "clamp(2rem,4vw,3rem)" }}>
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="relative mb-6 aspect-[4/5] w-full overflow-hidden">
                <motion.img
                  alt={mat.label}
                  className="h-full w-full object-cover will-change-transform"
                  src={mat.image}
                  initial={{ filter: "grayscale(1) brightness(0.72)" }}
                  whileHover={{ filter: "grayscale(0) brightness(0.88)", scale: 1.04 }}
                  transition={{ duration: 0.65 }}
                />
                <div
                  className="pointer-events-none absolute bottom-0 left-0 right-0 h-1/2 opacity-0 transition-opacity duration-700 group-hover:opacity-100"
                  style={{
                    background: `linear-gradient(to top, ${mat.glowColor} 0%, transparent 100%)`,
                  }}
                />
              </div>
              <p className="label-caps mb-3 text-couture-red">{mat.label}</p>
              <p className="text-sm leading-[1.9] text-background/60 md:text-base">
                {mat.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Stats ──────────────────────────────────────────────────────── */
function StatItem({
  value,
  suffix,
  label,
  index,
}: {
  value: number;
  suffix: string;
  label: string;
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-20%" });
  const count = useCountUp(value, isInView);

  return (
    <motion.div
      ref={ref}
      className="flex flex-col items-center gap-3 text-center"
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease, delay: index * 0.12 }}
    >
      <span
        className="font-serif leading-none text-background"
        style={{
          fontSize: "clamp(3.5rem,7vw,6rem)",
          textShadow: isInView ? "0 0 48px rgba(166,25,46,0.55)" : "none",
          transition: "text-shadow 1.2s ease",
        }}
      >
        {count}
        {suffix}
      </span>
      <p className="label-mono text-background/45">{label}</p>
    </motion.div>
  );
}

function StatsSection() {
  return (
    <section className="border-y border-foreground/10 bg-foreground py-16 md:py-24">
      <div className="site-shell">
        <div className="grid grid-cols-1 gap-14 md:grid-cols-3 md:gap-0">
          {STATS.map((s, i) => (
            <div key={s.label} className="relative">
              {i > 0 && (
                <div className="absolute inset-y-0 left-0 hidden w-px bg-background/[0.06] md:block" />
              )}
              <StatItem value={s.value} suffix={s.suffix} label={s.label} index={i} />
            </div>
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
        <div className="mb-14 md:mb-20">
          <FolkBorder className="w-full text-foreground/22" />
        </div>

        <div className="flex flex-col items-start gap-0 md:flex-row">
          {/* Image */}
          <motion.div
            className="w-full md:w-1/2"
            initial={{ opacity: 0, x: -32 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 1, ease }}
          >
            <div className="relative overflow-hidden">
              <Image
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCeoC4s0GytU2DJHgrs3Y0VtvzJzV8XnZqdlM-zu7Pj5SOSNmgf2fH0UUWquiyWXIKpNLyYe7uIZO3_8XVObSjX88ucZFaSmB7RmcgsRhsPnG7tPGc0n0_G6K7x3a5mstC1CRokMdByQ5QzcXX2nFedtwx42wOm2YsJwOSo6OzbspMc5J8qdpMsI2dZi4z_wUwpmA0QdXlFyhLvOkujl25D4nxEsU7IcGhDLxyZA3K6CO9_k9Sx1YFGtL1eqQjnZEl_HFLyG9-8uxkN"
                alt="Traditional craft"
                width={900}
                height={900}
                className="aspect-square w-full object-cover transition-transform duration-700 hover:scale-[1.03]"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          </motion.div>

          {/* Glass card */}
          <motion.div
            className="etched-glass relative z-10 w-full border border-charcoal/5 p-8 md:-ml-24 md:mt-36 md:w-1/2 md:p-14"
            initial={{ opacity: 0, x: 32 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 1, ease, delay: 0.15 }}
          >
            <motion.div
              className="absolute left-0 top-0 w-0.5 bg-couture-red"
              initial={{ height: 0 }}
              animate={isInView ? { height: "100%" } : {}}
              transition={{ duration: 1.2, delay: 0.45, ease }}
            />

            <span className="label-caps mb-6 block text-couture-red md:mb-8">
              04 // Symbolism
            </span>
            <h3
              className="mb-6 font-serif md:mb-8"
              style={{ fontSize: "clamp(1.7rem,3vw,2.4rem)" }}
            >
              The Geometry of Protection
            </h3>
            <p className="mb-8 text-base leading-[1.85] text-foreground/70 md:mb-10 md:text-[1.0625rem]">
              Every pattern is a word. Every knot is a prayer. We integrate ancestral embroidery motifs into modern jewelry, transforming adornment into a talisman for the modern world.
            </p>
            <ul className="space-y-3.5 font-mono text-[0.76rem] uppercase tracking-[0.16em]">
              {SYMBOLISM.map((pt, i) => (
                <motion.li
                  key={pt.label}
                  className="flex items-center gap-3.5"
                  initial={{ opacity: 0, x: 16 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.6, delay: 0.55 + i * 0.1, ease }}
                >
                  <span className={`h-2 w-2 shrink-0 rotate-45 ${pt.color}`} />
                  <span>{pt.label}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
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
      {/* Parallax background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <motion.div className="absolute inset-0 opacity-30" style={{ y: bgY }}>
        <img
          alt=""
          className="h-full w-full scale-110 object-cover grayscale contrast-[0.9] brightness-[1.02]"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBlRjmhQRA-wxjueCOYYPh4npb_AwMuPibdeIi2xBnyzR6aYtnPozn9EXkqQs10M5j72a9Atq1kDdq_5pSYtM-T0IB5fPIEHyJeAuFNam5J8DWrxnTvLIF7IBocQHDm2RM38UDGNVZkP5F-iaJ7Ak7cEckBiQiR5WlNdz2CQAOR_HNTAVMF6Ffgge-YsqtxlAnWX_NgFcmd9MEIUgbno4x7uc6zMgiJk8mH649KBJetEKbQkt75J8_hBuYsX8S7b7_cVJ0ytra6MdMc"
        />
        <div className="absolute inset-0 bg-surface/72" />
      </motion.div>

      {/* Ghost Kola */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.04]">
        <KolaStatic className="h-[65vw] w-[65vw] max-h-[600px] max-w-[600px] text-foreground" />
      </div>


      <div className="relative z-10 flex min-h-[72vh] items-center justify-center py-24 md:py-40">
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
            Each piece is a singular artifact — handcrafted, numbered, and rooted in centuries of Belarusian heritage. Yours to carry forward.
          </motion.p>
          <motion.div
            className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-5"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease, delay: 0.34 }}
          >
            <PrimaryCtaButton href="/shop">
              Shop the Collection
            </PrimaryCtaButton>

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

/* ─── Root ───────────────────────────────────────────────────────── */
export function HomePage({ title, excerpt, content, collections }: HomePageProps) {
  return (
    <main className="artifact-shell min-h-screen overflow-x-hidden">
      <HeroSection title={title} excerpt={excerpt} content={content} />
      <MarqueeStrip />
      <ManifestoSection content={content} />
      <CollectionsSection collections={collections} content={content} />
      <AtelierSection />
      <PatternInterlude />
      <MaterialsSection />
      <StatsSection />
      <HeritageSection />
      <FinalCTA />
    </main>
  );
}
