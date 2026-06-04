/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  useInView,
  useMotionValue,
  useSpring,
  AnimatePresence,
} from "motion/react";
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

/* ─── Constants ──────────────────────────────────────────────────── */
const ease = [0.22, 1, 0.36, 1] as const;

const MARQUEE_ROW_A = [
  "Handcrafted Jewelry", "◆", "Belarusian Folk Couture", "◆",
  "Lava Stone", "◆", "Oak Wood", "◆", "White Ceramic", "◆",
  "Artisan Made", "◆", "Since 2024", "◆",
];
const MARQUEE_ROW_B = [
  "Slavic Mysticism", "◆", "Avant-Garde Architecture", "◆",
  "Heritage Materials", "◆", "Limited Edition", "◆",
  "Hand-Finished", "◆", "Folk Geometry", "◆", "Couture Artifacts", "◆",
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

/* ─── Helpers ────────────────────────────────────────────────────── */
function useCountUp(target: number, inView: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const duration = 2200;
    const startTime = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - startTime) / duration, 1);
      setValue(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target]);
  return value;
}

/* ─── ShinyText ──────────────────────────────────────────────────── */
function ShinyText({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-block">
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.14) 50%, transparent 70%)",
          backgroundSize: "200% 100%",
          animation: "shiny-sweep 4s infinite linear",
          mixBlendMode: "overlay",
        }}
      />
    </span>
  );
}

/* ─── MagneticButton ─────────────────────────────────────────────── */
function MagneticButton({
  children,
  className,
  href,
}: {
  children: React.ReactNode;
  className?: string;
  href: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 350, damping: 28 });
  const springY = useSpring(y, { stiffness: 350, damping: 28 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      x.set((e.clientX - (r.left + r.width / 2)) * 0.28);
      y.set((e.clientY - (r.top + r.height / 2)) * 0.28);
    },
    [x, y]
  );

  const reset = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return (
    <motion.a
      ref={ref}
      href={href}
      className={className}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={reset}
      whileTap={{ scale: 0.96 }}
    >
      {children}
    </motion.a>
  );
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
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
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
  const words = headline.split(" ");

  return (
    <motion.header
      ref={ref}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background pt-20"
    >
      {/* Grain */}
      <div
        className="pointer-events-none absolute inset-0 z-0 mix-blend-multiply opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px",
        }}
      />

      {/* KodRoda ghost pattern — top-right behind image */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-end overflow-hidden opacity-[0.04]">
        <SvgKodRoda className="h-[80vw] w-[80vw] max-h-[720px] max-w-[720px] translate-x-[20%] text-foreground" />
      </div>

      {/* Ambient glows */}
      <div
        className="pointer-events-none absolute -right-60 -top-60 h-[70vw] w-[70vw] max-w-[900px] rounded-full"
        style={{
          background: "radial-gradient(circle, #a6192e 0%, transparent 65%)",
          opacity: 0.09,
          animation: "pulse-glow 6s ease-in-out infinite",
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
              className="max-w-[10ch] font-serif leading-[0.92] tracking-tight"
              style={{ fontSize: "clamp(2.8rem,7vw,6.5rem)" }}
            >
              {words.map((word, i) => (
                <span key={i} className="mr-[0.2em] inline-block overflow-hidden last:mr-0">
                  <motion.span
                    className="inline-block"
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
            className="flex flex-col gap-5 sm:flex-row sm:items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.9, ease }}
          >
            <MagneticButton
              href={content?.ctaHref ?? "/shop"}
              className="group relative inline-flex cursor-pointer items-center gap-3 overflow-hidden bg-couture-red px-8 py-4 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white"
            >
              <span className="relative z-10">{content?.ctaLabel ?? "Explore Archive"}</span>
              <svg
                className="relative z-10 h-3 w-3 transition-transform duration-300 group-hover:translate-x-1"
                viewBox="0 0 12 12"
                fill="none"
              >
                <path
                  d="M1 6h10M7 2l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)",
                  backgroundSize: "200% 100%",
                  animation: "shiny-sweep 2.5s infinite linear",
                }}
              />
            </MagneticButton>

            <Link
              href="/about"
              className="inline-flex items-center gap-2 border-b border-foreground/20 pb-1 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-foreground/60 transition-colors duration-300 hover:border-couture-red hover:text-couture-red"
            >
              Our Manifesto
            </Link>
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
            <img
              alt="SYNARAVA artisan bracelet"
              className="h-full w-full object-cover brightness-[0.86] contrast-[1.12]"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDnsVq-0rj6MUqa5fbd7AAEe7cTiEGdTbjaX0-QqyRfQDJrorZweFoBNZ9jrp4c5G9YxZY1YWEUDZj3h6LEwB8covlq0TcBcRfzSY4jFtqnYKLYse3lFNPVEc424F0tMy1wYDp092U7vCp5UzzIntBvw7JQ59n6WrUHpbCWeChOdTgF_4v06jNFD2JXKrfMDAkHrNMfBf0IPjfNxpQZ6r8uZbhg3XInDox3KcDlWb6Aph9_5uCM04fmHM8cLz5jVaCrlmvjRqx1YyIr"
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

            {/* Scan line */}
            <motion.div
              className="pointer-events-none absolute left-0 right-0 h-px bg-couture-red/20"
              animate={{ top: ["0%", "100%", "0%"] }}
              transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
            />
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

          {/* Pieces badge */}
          <motion.div
            className="absolute -left-4 bottom-16 hidden flex-col gap-1 border border-foreground/[0.08] bg-background/85 p-4 backdrop-blur-sm md:flex"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 1.6, ease }}
          >
            <span className="font-serif text-2xl leading-none">47</span>
            <span className="label-mono text-[0.65rem] text-muted-ink">Pieces crafted</span>
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
  const dB = [...MARQUEE_ROW_B, ...MARQUEE_ROW_B];

  return (
    <div className="overflow-hidden bg-foreground">
      {/* Row A — forward */}
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

      {/* Row B — reverse */}
      <div className="overflow-hidden py-[0.85rem]">
        <motion.div
          className="flex whitespace-nowrap"
          animate={{ x: ["-50%", "0%"] }}
          transition={{ duration: 44, repeat: Infinity, ease: "linear" }}
        >
          {dB.map((item, i) => (
            <span
              key={i}
              className={`mx-7 font-mono text-[0.68rem] uppercase tracking-[0.28em] ${
                item === "◆" ? "text-couture-red" : "text-background/38"
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
  const words = quote.split(" ");

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

      {/* Ghost Kola rotating slowly */}
      <div className="pointer-events-none absolute left-0 top-1/2 -translate-x-1/3 -translate-y-1/2 opacity-[0.038]">
        <SvgKola className="h-[55vw] w-[55vw] max-h-[560px] max-w-[560px] text-foreground" />
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
                transition={{ duration: 0.7, ease, delay: i * 0.02 }}
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
          transition={{ duration: 0.8, delay: 1.1 }}
        >
          <span className="label-mono text-muted-ink">Synarava Studio, 2024</span>
          <div className="flex items-center justify-center gap-5">
            <motion.div
              className="h-px w-14 bg-stone-beige"
              initial={{ scaleX: 0 }}
              animate={isInView ? { scaleX: 1 } : {}}
              transition={{ duration: 0.8, delay: 1.2 }}
              style={{ transformOrigin: "left" }}
            />
            <div className="h-2 w-2 rotate-45 border border-couture-red" />
            <motion.div
              className="h-px w-14 bg-stone-beige"
              initial={{ scaleX: 0 }}
              animate={isInView ? { scaleX: 1 } : {}}
              transition={{ duration: 0.8, delay: 1.3 }}
              style={{ transformOrigin: "right" }}
            />
          </div>
        </motion.footer>
      </div>

      {/* Bottom folk border */}
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
              <svg
                className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1"
                viewBox="0 0 12 12"
                fill="none"
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
        {/* Card image with variants */}
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

          {/* Overlay reveal */}
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

          {/* Bottom sweep line */}
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

/* ─── The Atelier (new section) ──────────────────────────────────── */
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

      {/* Ziamla ghost — earth grid breathing in background */}
      <div className="pointer-events-none absolute left-0 top-1/2 -translate-x-1/4 -translate-y-1/2 opacity-[0.04]">
        <SvgZiamla className="h-[60vw] w-[60vw] max-h-[580px] max-w-[580px] text-foreground" />
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
              {/* Timeline dot */}
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
              <p className="text-sm leading-[1.9] text-muted-ink md:text-base">{step.body}</p>
            </motion.div>
          ))}
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
              <div className="relative mb-6 aspect-[4/5] w-full overflow-hidden">
                <motion.img
                  alt={mat.label}
                  className="h-full w-full object-cover will-change-transform"
                  src={mat.image}
                  initial={{ filter: "grayscale(1) brightness(0.72)" }}
                  whileHover={{ filter: "grayscale(0) brightness(0.88)", scale: 1.04 }}
                  transition={{ duration: 0.65 }}
                />
                {/* Color glow on hover */}
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
        {/* Top folk border divider */}
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
              <img
                alt="Traditional craft"
                className="aspect-square w-full object-cover transition-transform duration-700 hover:scale-[1.03]"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCeoC4s0GytU2DJHgrs3Y0VtvzJzV8XnZqdlM-zu7Pj5SOSNmgf2fH0UUWquiyWXIKpNLyYe7uIZO3_8XVObSjX88ucZFaSmB7RmcgsRhsPnG7tPGc0n0_G6K7x3a5mstC1CRokMdByQ5QzcXX2nFedtwx42wOm2YsJwOSo6OzbspMc5J8qdpMsI2dZi4z_wUwpmA0QdXlFyhLvOkujl25D4nxEsU7IcGhDLxyZA3K6CO9_k9Sx1YFGtL1eqQjnZEl_HFLyG9-8uxkN"
              />
              {/* Scan line */}
              <motion.div
                className="pointer-events-none absolute left-0 right-0 h-px bg-couture-red/25"
                animate={{ top: ["0%", "100%", "0%"] }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
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
            {/* Animated left border accent */}
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
              Every pattern is a word. Every knot is a prayer. We integrate ancestral embroidery
              motifs into modern jewelry, transforming adornment into a talisman for the modern world.
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

/* ─── SVG Folk Patterns ──────────────────────────────────────────── */
function SvgKodRoda({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });
  const reduce = useReducedMotion();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = (delay: number): any => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: isInView ? { pathLength: 1, opacity: 1 } : {},
    transition: { duration: reduce ? 0 : 1.6, ease: "easeInOut", delay },
  });

  return (
    <motion.svg
      ref={ref}
      viewBox="0 0 200 200"
      fill="none"
      className={className}
      animate={reduce ? undefined : isInView ? { rotate: [0, 2, -1.5, 0] } : {}}
      transition={{ duration: 12, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
    >
      <motion.path d="M100 8 L192 100 L100 192 L8 100 Z" stroke="currentColor" strokeWidth="1.2" {...d(0)} />
      <motion.path d="M100 42 L158 100 L100 158 L42 100 Z" stroke="currentColor" strokeWidth="1" {...d(0.2)} />
      <motion.path d="M100 68 L132 100 L100 132 L68 100 Z" stroke="currentColor" strokeWidth="0.85" {...d(0.4)} />
      <motion.path d="M100 8 L100 192" stroke="currentColor" strokeWidth="0.7" opacity={0.5} {...d(0.55)} />
      <motion.path d="M8 100 L192 100" stroke="currentColor" strokeWidth="0.7" opacity={0.5} {...d(0.55)} />
      <motion.path d="M42 42 L158 158" stroke="currentColor" strokeWidth="0.6" opacity={0.35} {...d(0.7)} />
      <motion.path d="M158 42 L42 158" stroke="currentColor" strokeWidth="0.6" opacity={0.35} {...d(0.7)} />
      <motion.path d="M100 8 L112 20 M100 8 L88 20" stroke="currentColor" strokeWidth="1" {...d(1)} />
      <motion.path d="M192 100 L180 112 M192 100 L180 88" stroke="currentColor" strokeWidth="1" {...d(1)} />
      <motion.path d="M100 192 L112 180 M100 192 L88 180" stroke="currentColor" strokeWidth="1" {...d(1)} />
      <motion.path d="M8 100 L20 112 M8 100 L20 88" stroke="currentColor" strokeWidth="1" {...d(1)} />
      <motion.circle cx="100" cy="100" r="3.5" fill="currentColor"
        initial={{ scale: 0, opacity: 0 }}
        animate={isInView ? { scale: 1, opacity: 1 } : {}}
        transition={{ duration: 0.5, delay: 1.4, type: "spring", stiffness: 400 }}
      />
      {[[100, 42], [158, 100], [100, 158], [42, 100]].map(([cx, cy], i) => (
        <motion.circle key={i} cx={cx} cy={cy} r="2.5" fill="currentColor"
          initial={{ scale: 0, opacity: 0 }}
          animate={isInView ? { scale: 1, opacity: 0.7 } : {}}
          transition={{ duration: 0.4, delay: 1.5 + i * 0.1, type: "spring", stiffness: 400 }}
        />
      ))}
    </motion.svg>
  );
}

function SvgKola({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });
  const reduce = useReducedMotion();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = (delay: number, opacity = 1): any => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: isInView ? { pathLength: 1, opacity } : {},
    transition: { duration: reduce ? 0 : 1.8, ease: "easeInOut", delay },
  });

  return (
    <motion.svg
      ref={ref}
      viewBox="0 0 200 200"
      fill="none"
      className={className}
      animate={reduce ? undefined : isInView ? { rotate: 360 } : {}}
      transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
    >
      <motion.circle cx="100" cy="100" r="88" stroke="currentColor" strokeWidth="1"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={isInView ? { pathLength: 1, opacity: 1 } : {}}
        transition={{ duration: 2, ease: "easeInOut", delay: 0 }}
      />
      <motion.circle cx="100" cy="100" r="60" stroke="currentColor" strokeWidth="0.85" opacity={0.6}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={isInView ? { pathLength: 1, opacity: 0.6 } : {}}
        transition={{ duration: 1.8, ease: "easeInOut", delay: 0.3 }}
      />
      <motion.circle cx="100" cy="100" r="28" stroke="currentColor" strokeWidth="1"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={isInView ? { pathLength: 1, opacity: 1 } : {}}
        transition={{ duration: 1.4, ease: "easeInOut", delay: 0.6 }}
      />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <motion.line key={angle}
            x1={100 + 28 * Math.cos(rad)} y1={100 + 28 * Math.sin(rad)}
            x2={100 + 88 * Math.cos(rad)} y2={100 + 88 * Math.sin(rad)}
            stroke="currentColor" strokeWidth={i % 2 === 0 ? "1" : "0.6"} opacity={i % 2 === 0 ? 1 : 0.5}
            {...d(0.9 + i * 0.08)}
          />
        );
      })}
      {[0, 90, 180, 270].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <motion.circle key={angle} cx={100 + 88 * Math.cos(rad)} cy={100 + 88 * Math.sin(rad)} r="3" fill="currentColor"
            initial={{ scale: 0, opacity: 0 }}
            animate={isInView ? { scale: 1, opacity: 1 } : {}}
            transition={{ duration: 0.4, delay: 1.8 + i * 0.1, type: "spring", stiffness: 400 }}
          />
        );
      })}
      <motion.circle cx="100" cy="100" r="4" fill="currentColor"
        initial={{ scale: 0, opacity: 0 }}
        animate={isInView ? { scale: 1, opacity: 1 } : {}}
        transition={{ duration: 0.5, delay: 0.5, type: "spring", stiffness: 500 }}
      />
    </motion.svg>
  );
}

function SvgZiamla({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });
  const reduce = useReducedMotion();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = (delay: number, opacity = 1): any => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: isInView ? { pathLength: 1, opacity } : {},
    transition: { duration: reduce ? 0 : 1.6, ease: "easeInOut", delay },
  });

  return (
    <motion.svg
      ref={ref}
      viewBox="0 0 200 200"
      fill="none"
      className={className}
      animate={reduce ? undefined : isInView ? { scale: [1, 1.015, 1] } : {}}
      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.rect x="18" y="18" width="164" height="164" stroke="currentColor" strokeWidth="1.1" transform="rotate(45 100 100)" {...d(0)} />
      <motion.rect x="44" y="44" width="112" height="112" stroke="currentColor" strokeWidth="1" transform="rotate(45 100 100)" opacity={0.7} {...d(0.25)} />
      <motion.rect x="68" y="68" width="64" height="64" stroke="currentColor" strokeWidth="0.9" transform="rotate(45 100 100)" opacity={0.5} {...d(0.5)} />
      <motion.path d="M100 18 L100 182" stroke="currentColor" strokeWidth="0.7" opacity={0.4} {...d(0.65)} />
      <motion.path d="M18 100 L182 100" stroke="currentColor" strokeWidth="0.7" opacity={0.4} {...d(0.65)} />
      <motion.path d="M100 18 L88 30 M100 18 L112 30" stroke="currentColor" strokeWidth="1" {...d(0.9)} />
      <motion.path d="M182 100 L170 88 M182 100 L170 112" stroke="currentColor" strokeWidth="1" {...d(0.9)} />
      <motion.path d="M100 182 L88 170 M100 182 L112 170" stroke="currentColor" strokeWidth="1" {...d(0.9)} />
      <motion.path d="M18 100 L30 88 M18 100 L30 112" stroke="currentColor" strokeWidth="1" {...d(0.9)} />
      <motion.circle cx="100" cy="100" r="3" fill="currentColor"
        initial={{ scale: 0 }}
        animate={isInView ? { scale: 1 } : {}}
        transition={{ duration: 0.4, delay: 1.3, type: "spring", stiffness: 400 }}
      />
    </motion.svg>
  );
}

function FolkBorder({ className, delay = 0 }: { className?: string; delay?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-5%" });

  return (
    <svg ref={ref} viewBox="0 0 800 40" fill="none" className={className} aria-hidden="true">
      {Array.from({ length: 16 }).map((_, i) => {
        const cx = 25 + i * 50;
        return (
          <motion.path
            key={i}
            d={`M${cx} 4 L${cx + 16} 20 L${cx} 36 L${cx - 16} 20 Z`}
            stroke="currentColor" strokeWidth="1" fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={isInView ? { pathLength: 1, opacity: 0.7 } : {}}
            transition={{ duration: 0.6, ease: "easeOut", delay: delay + i * 0.06 }}
          />
        );
      })}
      <motion.line x1="9" y1="20" x2="791" y2="20" stroke="currentColor" strokeWidth="0.5" opacity={0.25}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={isInView ? { pathLength: 1, opacity: 0.25 } : {}}
        transition={{ duration: 1.6, ease: "easeInOut", delay }}
      />
      {Array.from({ length: 15 }).map((_, i) => (
        <motion.circle key={i} cx={25 + 16 + i * 50} cy={20} r={1.5} fill="currentColor"
          initial={{ scale: 0, opacity: 0 }}
          animate={isInView ? { scale: 1, opacity: 0.5 } : {}}
          transition={{ duration: 0.3, delay: delay + 0.5 + i * 0.04 }}
        />
      ))}
    </svg>
  );
}

/* ─── Folk Pattern Interlude ─────────────────────────────────────── */
function PatternInterlude() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-8%" });

  return (
    <section ref={ref} className="relative overflow-hidden bg-foreground py-20 text-background md:py-32">
      {/* Ghost "УЗОРЫ" */}
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
          {[
            {
              Svg: SvgKodRoda,
              name: "Kod Roda",
              sub: "Ancestral Cipher",
              desc: "A diamond lattice encoding lineage and protection. Found on ceremonial linens for centuries.",
            },
            {
              Svg: SvgKola,
              name: "Kola",
              sub: "Solar Wheel",
              desc: "The ancient 8-spoked sun symbol — energy, life force, and the cyclical nature of time.",
            },
            {
              Svg: SvgZiamla,
              name: "Ziamla",
              sub: "Earth Grid",
              desc: "Nested squares anchoring the wearer — symbol of fertility, material origin, and permanence.",
            },
          ].map(({ Svg, name, sub, desc }, i) => (
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
              <p className="text-sm leading-[1.9] text-background/55 md:text-base">{desc}</p>
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

/* ─── Folk Spider Ornament ───────────────────────────────────────── */
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
            : { rotate: [0, 3.2, -2.2, 1.4, 0], y: [0, 4, -2, 2, 0] }
        }
        transition={
          reduceMotion
            ? undefined
            : { duration: 8.5, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }
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
      {/* Parallax background */}
      <motion.div className="absolute inset-0 opacity-30" style={{ y: bgY }}>
        <img
          alt="Gallery space"
          className="h-full w-full scale-110 object-cover grayscale contrast-[0.9] brightness-[1.02]"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBlRjmhQRA-wxjueCOYYPh4npb_AwMuPibdeIi2xBnyzR6aYtnPozn9EXkqQs10M5j72a9Atq1kDdq_5pSYtM-T0IB5fPIEHyJeAuFNam5J8DWrxnTvLIF7IBocQHDm2RM38UDGNVZkP5F-iaJ7Ak7cEckBiQiR5WlNdz2CQAOR_HNTAVMF6Ffgge-YsqtxlAnWX_NgFcmd9MEIUgbno4x7uc6zMgiJk8mH649KBJetEKbQkt75J8_hBuYsX8S7b7_cVJ0ytra6MdMc"
        />
        <div className="absolute inset-0 bg-surface/72" />
      </motion.div>

      {/* Ghost Kola rotating behind CTA */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.04]">
        <SvgKola className="h-[65vw] w-[65vw] max-h-[600px] max-w-[600px] text-foreground" />
      </div>

      {/* Pulsing red orb */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute left-1/2 top-1/2 h-[60vw] w-[60vw] max-w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(166,25,46,0.13) 0%, transparent 70%)" }}
          animate={{ scale: [1, 1.22, 1] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        />
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
            Each piece is a singular artifact — handcrafted, numbered, and rooted in centuries of
            Belarusian heritage. Yours to carry forward.
          </motion.p>
          <motion.div
            className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-5"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease, delay: 0.34 }}
          >
            <MagneticButton
              href="/shop"
              className="group relative inline-flex cursor-pointer items-center gap-3 overflow-hidden bg-couture-red px-8 py-4 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white"
            >
              <span className="relative z-10">Shop the Collection</span>
              <svg
                className="relative z-10 h-3 w-3 transition-transform duration-300 group-hover:translate-x-1"
                viewBox="0 0 12 12"
                fill="none"
              >
                <path
                  d="M1 6h10M7 2l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.14) 50%, transparent 70%)",
                  backgroundSize: "200% 100%",
                  animation: "shiny-sweep 2.5s infinite linear",
                }}
              />
            </MagneticButton>

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
