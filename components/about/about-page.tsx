/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  useReducedMotion,
} from "motion/react";
import Link from "next/link";
import { ArtifactLink, PrimaryCtaButton, ShinyText } from "@/components/ui";
import {
  KodRoda as SvgKodRoda,
  Kola as SvgKola,
  FolkBorder,
} from "@/components/ui/folk-patterns";

const ease = [0.22, 1, 0.36, 1] as const;

/** Ziamla — extended version with diagonal lines (more detailed than folk-patterns) */
function SvgZiamla({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });
  const reduceMotion = useReducedMotion();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const draw = (delay: number, opacity = 1): any => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: isInView ? { pathLength: 1, opacity } : {},
    transition: { duration: reduceMotion ? 0 : 1.6, ease: "easeInOut", delay },
  });

  return (
    <motion.svg
      ref={ref}
      viewBox="0 0 200 200"
      fill="none"
      className={className}
      animate={reduceMotion ? undefined : isInView ? { scale: [1, 1.015, 1] } : {}}
      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Outer square (rotated 45°) */}
      <motion.rect x="18" y="18" width="164" height="164" stroke="currentColor" strokeWidth="1.1" transform="rotate(45 100 100)" {...draw(0)} />
      {/* Mid square */}
      <motion.rect x="44" y="44" width="112" height="112" stroke="currentColor" strokeWidth="1" transform="rotate(45 100 100)" opacity={0.7} {...draw(0.25)} />
      {/* Inner square */}
      <motion.rect x="68" y="68" width="64" height="64" stroke="currentColor" strokeWidth="0.9" transform="rotate(45 100 100)" opacity={0.5} {...draw(0.5)} />
      {/* Axis lines */}
      <motion.path d="M100 18 L100 182" stroke="currentColor" strokeWidth="0.7" opacity={0.4} {...draw(0.65)} />
      <motion.path d="M18 100 L182 100" stroke="currentColor" strokeWidth="0.7" opacity={0.4} {...draw(0.65)} />
      {/* Corner cross ticks at outer square corners */}
      <motion.path d="M100 18 L88 30 M100 18 L112 30" stroke="currentColor" strokeWidth="1" {...draw(0.9)} />
      <motion.path d="M182 100 L170 88 M182 100 L170 112" stroke="currentColor" strokeWidth="1" {...draw(0.9)} />
      <motion.path d="M100 182 L88 170 M100 182 L112 170" stroke="currentColor" strokeWidth="1" {...draw(0.9)} />
      <motion.path d="M18 100 L30 88 M18 100 L30 112" stroke="currentColor" strokeWidth="1" {...draw(0.9)} />
      {/* Diagonal extension lines */}
      <motion.path d="M40 40 L60 60 M160 40 L140 60 M40 160 L60 140 M160 160 L140 140" stroke="currentColor" strokeWidth="0.7" opacity={0.4} {...draw(1.1)} />
      {/* Centre */}
      <motion.rect x="93" y="93" width="14" height="14" stroke="currentColor" strokeWidth="1" transform="rotate(45 100 100)"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={isInView ? { pathLength: 1, opacity: 1 } : {}}
        transition={{ duration: 0.8, delay: 1.3, ease: "easeInOut" }}
      />
      <motion.circle cx="100" cy="100" r="3" fill="currentColor"
        initial={{ scale: 0 }}
        animate={isInView ? { scale: 1 } : {}}
        transition={{ duration: 0.4, delay: 1.6, type: "spring", stiffness: 400 }}
      />
    </motion.svg>
  );
}

const PRINCIPLES = [
  {
    label: "Studio first",
    body: "Synarava is built as a small atelier with a fashion-editorial eye, not as a mass catalog of interchangeable accessories.",
    symbol: "✦",
  },
  {
    label: "Material honesty",
    body: "Wood should look like wood, lava like lava, ceramic like fired earth. The material carries meaning before ornament does.",
    symbol: "◆",
  },
  {
    label: "Wearable clarity",
    body: "Even when the symbolism runs deep, the object still needs to feel easy to wear, easy to understand, and easy to choose.",
    symbol: "◇",
  },
];

const INFO_ITEMS = [
  { label: "What we make", value: "Bracelets, necklace studies, symbolic objects, and collection-led editorial releases." },
  { label: "How we work", value: "Small-batch production, material-first design, and story-led collections instead of endless product drops." },
  { label: "What matters", value: "Clarity of form, emotional durability, and a respectful link to Belarusian visual memory." },
];

const PATTERNS = [
  {
    id: "kodroda",
    name: "Kod Roda",
    subhead: "Ancestral Cipher",
    description: "The foundational folk symbol — a diamond lattice encoding family lineage, protection, and the cycle of generations. Found on ceremonial linens and now distilled into form.",
    Svg: SvgKodRoda,
  },
  {
    id: "kola",
    name: "Kola",
    subhead: "Solar Wheel",
    description: "The ancient sun symbol — an 8-spoked wheel of light. In Belarusian tradition, Kola represents energy, life-giving force, and the cyclical nature of time.",
    Svg: SvgKola,
  },
  {
    id: "ziamla",
    name: "Ziamla",
    subhead: "Earth Grid",
    description: "Nested squares anchoring the wearer to the earth — a symbol of fertility, material origin, and the permanence of land. The foundation beneath all other motifs.",
    Svg: SvgZiamla,
  },
];

/* ─── Hero ───────────────────────────────────────────────────────── */
function AboutHero({
  title,
  excerpt,
  eyebrow,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  excerpt: string;
  eyebrow: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);
  const textY = useTransform(scrollYProgress, [0, 0.55], ["0%", "-6%"]);

  const words = title.split(" ");

  return (
    <motion.header
      ref={ref}
      className="relative min-h-screen overflow-hidden bg-background pt-28"
    >
      {/* Grain */}
      <div
        className="pointer-events-none absolute inset-0 z-0 mix-blend-multiply opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px",
        }}
      />

      {/* Large background KodRoda pattern */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-end overflow-hidden opacity-[0.045] md:opacity-[0.055]">
        <SvgKodRoda className="h-[90vw] w-[90vw] max-h-[780px] max-w-[780px] -translate-x-[-15%] text-foreground" />
      </div>

      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute -right-40 top-0 h-[60vw] w-[60vw] max-w-[800px] rounded-full"
        style={{
          background: "radial-gradient(circle, #a6192e 0%, transparent 65%)",
          opacity: 0.07,
        }}
      />

      <motion.div
        className="site-shell relative z-10 grid min-h-[calc(100vh-7rem)] grid-cols-12 items-center gap-y-16 pb-20 pt-10"
        style={{ opacity: textOpacity, y: textY }}
      >
        {/* Text */}
        <div className="col-span-12 space-y-10 lg:col-span-6">
          <motion.p
            className="label-mono text-couture-red"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease }}
          >
            {eyebrow}
          </motion.p>

          <h1
            className="font-serif leading-[0.9] tracking-tight"
            style={{ fontSize: "clamp(2.8rem,6.5vw,6rem)" }}
          >
            {words.map((word, i) => (
              <span key={i} className="mr-[0.2em] inline-block overflow-hidden last:mr-0">
                <motion.span
                  className="inline-block"
                  initial={{ y: "110%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 1, ease, delay: 0.1 + i * 0.1 }}
                >
                  <ShinyText>{word}</ShinyText>
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            className="max-w-xl text-base leading-[2] text-muted-ink md:text-[1.0625rem]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.65, ease }}
          >
            {excerpt}
          </motion.p>

          <motion.div
            className="flex flex-col gap-5 sm:flex-row sm:items-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9, ease }}
          >
            <PrimaryCtaButton href={ctaHref}>{ctaLabel}</PrimaryCtaButton>
            <Link
              href="/about/manifesto"
              className="inline-flex items-center gap-2 border-b border-foreground/20 pb-1 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-foreground/60 transition-colors hover:border-couture-red hover:text-couture-red"
            >
              Read the manifesto
            </Link>
          </motion.div>
        </div>

        {/* Image */}
        <div className="col-span-12 lg:col-span-6">
          <motion.div
            className="relative overflow-hidden bg-stone-beige"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.4, delay: 0.3, ease }}
          >
            <motion.img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAsOpilx95kk9tsj12r0FFG2UFEpnvVCSCj8zjj1_un-K347C_bYyfjiBfHqVhN7zzUIZ6ozazQxs49HgYM0nwLxVV_V-oCjDAD6QJftXKg4uJF9VXZZMF7SnXTuGUbTcXPb8YpkhuyReJ5XbM6cmIPd1_ZewFgYq_eM3-SzvrzxvrGS91YDoHIO1EY-VONHmNa2LsvHgEWNqfyALYgIDXy_TuRnrTrcjodxqPvTs-9GvTow0A7s7QXartwC2wPcxedNcDYyDBOZOpL"
              alt="Synarava studio composition"
              className="aspect-[4/5] h-full w-full object-cover brightness-[0.88] contrast-[1.08]"
              style={{ y: imgY }}
            />
            {/* Red vignette */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-1/3"
              style={{ background: "linear-gradient(to top, rgba(166,25,46,0.18) 0%, transparent 100%)" }} />
            {/* Corner accents */}
            <motion.div className="absolute left-4 top-4 h-10 w-10 border-l border-t border-couture-red/60"
              initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 1.2, ease }} />
            <motion.div className="absolute bottom-4 right-4 h-10 w-10 border-b border-r border-couture-red/60"
              initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 1.35, ease }} />
          </motion.div>
        </div>
      </motion.div>
    </motion.header>
  );
}

/* ─── Folk Pattern Showcase ──────────────────────────────────────── */
function PatternShowcase() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-8%" });

  return (
    <section ref={ref} className="relative overflow-hidden bg-foreground py-20 text-background md:py-44">
      {/* Faint ghost text */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <span className="select-none font-serif leading-none text-background"
          style={{ fontSize: "clamp(4rem,16vw,13rem)", opacity: 0.025, whiteSpace: "nowrap", letterSpacing: "0.06em" }}>
          УЗОРЫ
        </span>
      </div>

      <div className="site-shell relative z-10">
        <motion.div className="mb-16 md:mb-24"
          initial={{ opacity: 0, y: 28 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease }}>
          <p className="label-mono mb-4 text-couture-red">02 // Folk Geometry</p>
          <h2 className="max-w-lg font-serif" style={{ fontSize: "clamp(2rem,4vw,3rem)" }}>
            The Symbols We Carry
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-[1.9] text-background/60 md:text-[1.0625rem]">
            Each piece bears one of three foundational motifs — geometric ciphers that have marked Belarusian ceremonial objects for centuries. They do not decorate. They speak.
          </p>
        </motion.div>

        {/* Pattern grid */}
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
          {PATTERNS.map(({ id, name, subhead, description, Svg }, i) => (
            <motion.div
              key={id}
              className="group"
              initial={{ opacity: 0, y: 44 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.85, ease, delay: i * 0.16 }}
            >
              {/* Pattern SVG */}
              <div className="relative mb-8 flex items-center justify-center">
                <Svg className="h-48 w-48 text-background/70 transition-colors duration-700 group-hover:text-couture-red md:h-52 md:w-52" />
                {/* Hover glow */}
                <motion.div
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{ background: "radial-gradient(circle, rgba(166,25,46,0) 0%, transparent 70%)" }}
                  whileHover={{ background: "radial-gradient(circle, rgba(166,25,46,0.12) 0%, transparent 70%)" }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              {/* Border line */}
              <motion.div
                className="mb-6 h-px bg-background/15"
                initial={{ scaleX: 0 }}
                animate={isInView ? { scaleX: 1 } : {}}
                transition={{ duration: 1, ease, delay: 0.4 + i * 0.16 }}
                style={{ transformOrigin: "left" }}
              />

              <p className="label-caps mb-2 text-couture-red">{name}</p>
              <p className="label-mono mb-4 text-background/40">{subhead}</p>
              <p className="text-sm leading-[1.9] text-background/55 md:text-base">
                {description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Bottom border ornament */}
        <div className="mt-20 md:mt-28">
          <FolkBorder className="w-full text-background/30" />
        </div>
      </div>
    </section>
  );
}

/* ─── Principles ─────────────────────────────────────────────────── */
function PrinciplesSection() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-8%" });

  return (
    <section ref={ref} className="relative overflow-hidden bg-surface py-20 md:py-40">
      {/* Faint Kola in background */}
      <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/3 opacity-[0.04]">
        <SvgKola className="h-[60vw] w-[60vw] max-h-[640px] max-w-[640px] text-foreground" />
      </div>

      <div className="site-shell relative z-10">
        <div className="mb-14 grid grid-cols-1 gap-8 md:mb-20 md:grid-cols-12">
          <motion.div
            className="md:col-span-5"
            initial={{ opacity: 0, y: 28 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease }}
          >
            <p className="label-mono mb-4 text-couture-red">01 // What kind of brand this is</p>
            <h2 className="font-serif leading-[0.95]" style={{ fontSize: "clamp(2rem,3.8vw,3.2rem)" }}>
              A clear store first, with deeper editorial layers behind it.
            </h2>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {PRINCIPLES.map((p, i) => (
            <motion.div
              key={p.label}
              className="group relative border border-foreground/[0.07] p-8 transition-colors duration-500 hover:border-couture-red/30"
              initial={{ opacity: 0, y: 44 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.85, ease, delay: i * 0.14 }}
            >
              {/* Animated left accent */}
              <motion.div
                className="absolute left-0 top-0 w-0.5 bg-couture-red"
                initial={{ height: 0 }}
                animate={isInView ? { height: "100%" } : {}}
                transition={{ duration: 1, delay: 0.3 + i * 0.14, ease }}
              />

              <span className="mb-6 block font-serif text-3xl text-couture-red opacity-60 transition-opacity duration-300 group-hover:opacity-100">
                {p.symbol}
              </span>
              <p className="label-caps mb-4 text-couture-red">{p.label}</p>
              <p className="text-base leading-[1.85] text-foreground/70">{p.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Story / How to use ─────────────────────────────────────────── */
function StorySection({ secondaryBody }: { secondaryBody: string }) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <section ref={ref} className="bg-background py-20 md:py-40">
      <div className="site-shell">
        {/* Top folk border */}
        <div className="mb-14 md:mb-20">
          <FolkBorder className="w-full text-foreground/25" />
        </div>

        <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:items-start">
          {/* Info */}
          <motion.div
            className="space-y-8 md:col-span-5"
            initial={{ opacity: 0, x: -28 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 1, ease }}
          >
            <div>
              <p className="label-mono mb-4 text-couture-red">03 // How to use the site</p>
              <h2 className="font-serif leading-[0.95]" style={{ fontSize: "clamp(1.8rem,3.2vw,2.8rem)" }}>
                Shop by product, browse by collection, learn through story.
              </h2>
            </div>
            <motion.div
              className="h-px bg-couture-red"
              initial={{ width: 0 }}
              animate={isInView ? { width: 80 } : {}}
              transition={{ duration: 0.8, delay: 0.3, ease }}
            />
            <p className="text-base leading-[2] text-foreground/70 md:text-[1.0625rem]">
              {secondaryBody}
            </p>

            {/* Info list */}
            <ul className="space-y-5">
              {INFO_ITEMS.map((item, i) => (
                <motion.li
                  key={item.label}
                  className="border-t border-foreground/[0.07] pt-5"
                  initial={{ opacity: 0, x: -16 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.65, ease, delay: 0.4 + i * 0.1 }}
                >
                  <p className="label-caps mb-2 text-couture-red">{item.label}</p>
                  <p className="text-base leading-[1.85] text-foreground/65">{item.value}</p>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Right panel */}
          <motion.div
            className="space-y-6 md:col-span-7"
            initial={{ opacity: 0, x: 28 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 1, ease, delay: 0.15 }}
          >
            {/* Site map panel */}
            <div className="etched-glass relative border border-foreground/[0.06] p-8 md:p-10">
              <motion.div
                className="absolute left-0 top-0 w-0.5 bg-couture-red"
                initial={{ height: 0 }}
                animate={isInView ? { height: "100%" } : {}}
                transition={{ duration: 1.2, delay: 0.5, ease }}
              />
              <div className="grid grid-cols-3 gap-6">
                {[
                  { label: "Home", body: "Brand entry and featured products." },
                  { label: "Shop", body: "Product listing with filters and direct links." },
                  { label: "Collections", body: "Editorial groupings by material and theme." },
                ].map((item, i) => (
                  <motion.div key={item.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6, ease, delay: 0.6 + i * 0.1 }}>
                    <p className="label-caps mb-3 text-couture-red">{item.label}</p>
                    <p className="text-sm leading-[1.85] text-foreground/65">{item.body}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Ziamla pattern as decorative element in this section */}
            <div className="relative overflow-hidden bg-stone-beige/40 p-10">
              <div className="flex items-center justify-center gap-8 md:gap-16">
                <div className="text-center">
                  <SvgZiamla className="mx-auto mb-5 h-28 w-28 text-foreground/50" />
                  <p className="label-mono text-[0.65rem] text-muted-ink">Ziamla — Earth</p>
                </div>
                <div className="h-16 w-px bg-foreground/10" />
                <div className="max-w-xs">
                  <p className="label-caps mb-3 text-couture-red">From the Archive</p>
                  <p className="text-sm leading-[1.9] text-foreground/60">
                    Every material in our pieces is catalogued, numbered, and sourced with intention. The archive is not a metaphor — it is a practice.
                  </p>
                </div>
              </div>
            </div>

            {/* Exhibition image */}
            <div className="artifact-hover-image-wrap relative">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDHaoUd-Rm7sOtHmb7DqP0M9OBv7dVOeIrBaE0HeI7OBXaGfWpDZ-Rydjig7P70HXomp3svTh1hAwUXUsAVSBjU5XjcXsfg8B3AK0ZyL-1_ULgDFpb-5IemGJkyXlntN3f-ihPcc1u86fbTV48rKP9E6HYYe53wCujXW5Yy4jVQ7fvgqcipoQSMO0V7fwxVedwilASfgNwSlcTU4FHWCQyj2cT_-Uetg5LcpKBkJ0LbTtRcCKlG63G2PXW1UtqsGCgiQKVOZn1a-NUv"
                alt="Synarava exhibition-style space"
                className="artifact-hover-image aspect-[16/9] h-full w-full object-cover hover:scale-[1.03]"
              />
            </div>
          </motion.div>
        </div>

        {/* Bottom folk border */}
        <div className="mt-16 md:mt-24">
          <FolkBorder className="w-full text-foreground/20" delay={0.3} />
        </div>
      </div>
    </section>
  );
}

/* ─── Dark Quote ─────────────────────────────────────────────────── */
function DarkQuoteSection() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-12%" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const bgScale = useTransform(scrollYProgress, [0, 1], [0.88, 1.06]);

  const quote =
    "We do not inherit the earth from our ancestors; we borrow it from our children. We do the same with our stories. SYNARAVA is the vessel for the stories that refuse to be forgotten.";
  return (
    <section ref={ref} className="relative overflow-hidden bg-foreground py-20 text-background md:py-48">
      {/* Parallax ghost pattern */}
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{ scale: bgScale }}
      >
        <SvgKodRoda className="h-[80vw] w-[80vw] max-h-[700px] max-w-[700px] text-background opacity-[0.025]" />
      </motion.div>

      <div className="site-shell relative z-10 text-center">
        <motion.div
          className="mx-auto mb-12 flex h-20 w-20 items-center justify-center border border-couture-red/40"
          initial={{ opacity: 0, rotate: 0, scale: 0.6 }}
          animate={isInView ? { opacity: 1, rotate: 45, scale: 1 } : {}}
          transition={{ duration: 0.8, ease, delay: 0.1 }}
        >
          <motion.div
            className="h-10 w-10 border border-background/20"
            animate={isInView ? { rotate: -45 } : {}}
            transition={{ duration: 0.8, ease, delay: 0.1 }}
          />
        </motion.div>

        <motion.p
          className="label-mono mb-10 text-couture-red"
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease }}
        >
          04 // Identity & Memory
        </motion.p>

        <motion.blockquote
          className="mx-auto max-w-4xl font-serif italic leading-[1.45] text-background"
          style={{ fontSize: "clamp(1.4rem,2.8vw,2.6rem)" }}
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.85, ease, delay: 0.15 }}
        >
          {quote}
        </motion.blockquote>

        <motion.div
          className="mt-14 flex items-center justify-center gap-5"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 1.2 }}
        >
          <motion.div className="h-px w-14 bg-background/20"
            initial={{ scaleX: 0 }} animate={isInView ? { scaleX: 1 } : {}}
            transition={{ duration: 0.8, delay: 1.3 }} style={{ transformOrigin: "left" }} />
          <div className="h-2 w-2 rotate-45 border border-couture-red" />
          <motion.div className="h-px w-14 bg-background/20"
            initial={{ scaleX: 0 }} animate={isInView ? { scaleX: 1 } : {}}
            transition={{ duration: 0.8, delay: 1.4 }} style={{ transformOrigin: "right" }} />
        </motion.div>

        {/* Stats */}
        <motion.div
          className="mt-16 grid grid-cols-3 gap-6 border-t border-background/10 pt-14 md:mt-20 md:pt-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease, delay: 1.4 }}
        >
          {[
            { value: "3", label: "Collections" },
            { value: "47", label: "Pieces made" },
            { value: "∞", label: "Heritage" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="mb-2 font-serif text-background" style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)" }}>{stat.value}</p>
              <p className="label-mono text-background/40">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ─── CTA Footer ─────────────────────────────────────────────────── */
function AboutFooter() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <div ref={ref} className="relative overflow-hidden bg-surface py-20 md:py-32">
      {/* Ghost Kola */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <SvgKola className="h-[70vw] w-[70vw] max-h-[600px] max-w-[600px] text-foreground opacity-[0.03]" />
      </div>

      <div className="site-shell relative z-10 flex flex-col items-center gap-8 text-center">
        <motion.div className="flex items-center gap-5"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.7, ease }}>
          <div className="h-px w-14 bg-foreground/15" />
          <div className="h-2 w-2 rotate-45 border border-couture-red" />
          <div className="h-px w-14 bg-foreground/15" />
        </motion.div>

        <motion.p className="label-mono text-couture-red"
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease, delay: 0.1 }}>
          Enter the archive
        </motion.p>
        <motion.h2
          className="max-w-xl font-serif leading-[1.05]"
          style={{ fontSize: "clamp(1.8rem,4vw,3.2rem)" }}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.85, ease, delay: 0.18 }}>
          Ready to find your piece?
        </motion.h2>

        <motion.div
          className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5"
          initial={{ opacity: 0, y: 14 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease, delay: 0.28 }}>
          <PrimaryCtaButton href="/shop">Shop all products</PrimaryCtaButton>
          <ArtifactLink href="/collections" variant="ghost" size="sm">
            View collections
          </ArtifactLink>
        </motion.div>
      </div>
    </div>
  );
}

/* ─── Root Export ────────────────────────────────────────────────── */
export function AboutPage({
  title,
  excerpt,
  eyebrow,
  ctaHref,
  ctaLabel,
  secondaryBody,
}: {
  title: string;
  excerpt: string;
  eyebrow: string;
  ctaHref: string;
  ctaLabel: string;
  secondaryBody: string;
}) {
  return (
    <main className="artifact-shell min-h-screen overflow-x-hidden">
      <AboutHero
        title={title}
        excerpt={excerpt}
        eyebrow={eyebrow}
        ctaHref={ctaHref}
        ctaLabel={ctaLabel}
      />
      <PrinciplesSection />
      <PatternShowcase />
      <StorySection secondaryBody={secondaryBody} />
      <DarkQuoteSection />
      <AboutFooter />
    </main>
  );
}
