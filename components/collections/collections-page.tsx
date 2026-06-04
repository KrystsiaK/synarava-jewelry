/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  useMotionValue,
  useSpring,
} from "motion/react";
import Link from "next/link";
import type { CollectionSummary } from "@/lib/content/catalog";

const ease = [0.22, 1, 0.36, 1] as const;

/* ─── Custom Cursor ──────────────────────────────────────────────── */
function useCursorPos() {
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const sx = useSpring(x, { stiffness: 500, damping: 38 });
  const sy = useSpring(y, { stiffness: 500, damping: 38 });

  useEffect(() => {
    const move = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [x, y]);

  return { x: sx, y: sy };
}

function CustomCursor({ hovered }: { hovered: boolean }) {
  const { x, y } = useCursorPos();
  return (
    <motion.div
      className="pointer-events-none fixed left-0 top-0 z-[999] hidden -translate-x-1/2 -translate-y-1/2 md:flex"
      style={{ x, y }}
    >
      <motion.div
        className="flex items-center justify-center rounded-full bg-couture-red"
        animate={{
          width: hovered ? 96 : 10,
          height: hovered ? 96 : 10,
          opacity: hovered ? 1 : 0.7,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        <motion.span
          className="label-mono text-[0.62rem] text-white"
          animate={{ opacity: hovered ? 1 : 0, scale: hovered ? 1 : 0.5 }}
          transition={{ duration: 0.2 }}
        >
          EXPLORE
        </motion.span>
      </motion.div>
    </motion.div>
  );
}

/* ─── Hero ───────────────────────────────────────────────────────── */
function CollectionsHero({ count }: { count: number }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const titleY = useTransform(scrollYProgress, [0, 1], ["0%", "24%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  const TITLE_WORDS = ["Browse", "by", "Collection"];

  return (
    <motion.header
      ref={ref}
      className="relative flex min-h-[52vh] items-end overflow-hidden bg-background pb-16 pt-28 md:min-h-[60vh] md:pb-20"
    >
      {/* Grain */}
      <div
        className="pointer-events-none absolute inset-0 z-0 mix-blend-multiply opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px",
        }}
      />

      {/* Ghost COLLECTIONS */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 overflow-hidden">
        <motion.span
          className="block select-none text-center font-serif leading-none text-foreground"
          style={{ fontSize: "clamp(4rem,16vw,13rem)", opacity: 0.022, letterSpacing: "0.04em" }}
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 0.022 }}
          transition={{ duration: 1.8, ease, delay: 0.5 }}
        >
          COLLECTIONS
        </motion.span>
      </div>

      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute -left-40 top-0 h-[50vw] w-[50vw] max-w-[700px] rounded-full"
        style={{
          background: "radial-gradient(circle, #a6192e 0%, transparent 65%)",
          opacity: 0.07,
        }}
      />

      <motion.div
        className="site-shell relative z-10"
        style={{ y: titleY, opacity }}
      >
        <motion.p
          className="label-mono mb-6 text-couture-red"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease }}
        >
          Archive — {String(count).padStart(2, "0")} Series
        </motion.p>

        <h1
          className="font-serif leading-[0.88] tracking-tight"
          style={{ fontSize: "clamp(2.8rem,8vw,7.5rem)" }}
        >
          {TITLE_WORDS.map((word, i) => (
            <span key={i} className="mr-[0.25em] inline-block overflow-hidden last:mr-0">
              <motion.span
                className="inline-block"
                initial={{ y: "110%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 1, ease, delay: 0.1 + i * 0.1 }}
              >
                {word}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p
          className="mt-7 max-w-2xl text-base leading-[1.85] text-muted-ink md:text-lg"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.55, ease }}
        >
          Collections are the editorial layer of the shop. They group products by visual language,
          material mood, and symbolism — enter a world before choosing a piece.
        </motion.p>
      </motion.div>

      {/* Bottom animated line */}
      <motion.div
        className="absolute bottom-0 left-0 h-px bg-couture-red/40"
        initial={{ width: "0%" }}
        animate={{ width: "100%" }}
        transition={{ duration: 1.4, delay: 0.8, ease }}
      />
    </motion.header>
  );
}

/* ─── Collection Row ─────────────────────────────────────────────── */
function CollectionRow({
  collection,
  index,
  onHover,
}: {
  collection: CollectionSummary;
  index: number;
  onHover: (v: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-12%" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);
  const isReversed = index % 2 === 1;
  const numLabel = String(index + 1).padStart(2, "0");

  return (
    <div ref={ref}>
      {/* Divider */}
      <div className="relative h-px bg-foreground/[0.06]">
        <motion.div
          className="absolute left-0 top-0 h-full bg-couture-red/30"
          initial={{ width: "0%" }}
          animate={isInView ? { width: "100%" } : {}}
          transition={{ duration: 1.2, ease }}
        />
      </div>

      <Link
        href={`/collections/${collection.slug}`}
        className="group block cursor-none"
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
      >
        <div
          className={`grid grid-cols-1 items-stretch md:grid-cols-12 ${
            isReversed ? "md:[&>*:first-child]:order-2" : ""
          }`}
        >
          {/* Image panel */}
          <motion.div
            className="relative overflow-hidden bg-stone-beige md:col-span-7"
            initial={{ opacity: 0, x: isReversed ? 40 : -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 1, ease, delay: 0.05 }}
          >
            <div className="aspect-[16/10] overflow-hidden md:aspect-auto md:h-full md:min-h-[55vh]">
              <motion.img
                alt={collection.name}
                src={collection.heroImage}
                className="h-full w-full object-cover will-change-transform"
                style={{ y: imgY }}
                initial={{ filter: "grayscale(0.4) brightness(0.85)" }}
                whileHover={{ filter: "grayscale(0) brightness(0.92)", scale: 1.03 }}
                transition={{ duration: 0.75 }}
              />
            </div>

            {/* Number ghost */}
            <div className="pointer-events-none absolute bottom-4 right-4 select-none">
              <span
                className="font-serif leading-none text-white/[0.12]"
                style={{ fontSize: "clamp(5rem,12vw,9rem)" }}
              >
                {numLabel}
              </span>
            </div>

            {/* Red sweep on hover */}
            <motion.div
              className="absolute bottom-0 left-0 h-1 bg-couture-red"
              initial="rest"
              variants={{
                rest: { width: "0%" },
                hover: { width: "100%" },
              }}
              animate="rest"
              whileHover="hover"
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
          </motion.div>

          {/* Text panel */}
          <motion.div
            className="flex flex-col justify-center gap-7 px-7 py-12 md:col-span-5 md:px-14 md:py-0"
            initial={{ opacity: 0, x: isReversed ? -40 : 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 1, ease, delay: 0.15 }}
          >
            {/* Number label */}
            <div className="flex items-center gap-4">
              <span className="label-mono text-couture-red">{numLabel}</span>
              <div className="h-px flex-1 bg-foreground/10" />
            </div>

            <div>
              <motion.p
                className="label-mono mb-4 text-couture-red"
                initial={{ opacity: 0, y: 10 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, ease, delay: 0.2 }}
              >
                {collection.eyebrow}
              </motion.p>

              <motion.h2
                className="font-serif leading-[0.92] tracking-tight"
                style={{ fontSize: "clamp(2rem,4.5vw,4rem)" }}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.85, ease, delay: 0.28 }}
              >
                {collection.name}
              </motion.h2>
            </div>

            <motion.p
              className="max-w-sm text-base leading-[1.85] text-muted-ink md:text-[1.0625rem]"
              initial={{ opacity: 0, y: 16 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, ease, delay: 0.38 }}
            >
              {collection.summary}
            </motion.p>

            <motion.div
              className="flex items-center gap-4"
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ duration: 0.7, delay: 0.5 }}
            >
              <span className="label-caps border-b border-foreground/20 pb-1.5 transition-colors duration-300 group-hover:border-couture-red group-hover:text-couture-red">
                Explore collection
              </span>
              <motion.svg
                className="h-4 w-4 text-couture-red"
                viewBox="0 0 16 16"
                fill="none"
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <path
                  d="M1 8h14M9 2l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </motion.svg>
            </motion.div>

            {/* Accent code tag */}
            <motion.div
              className="mt-auto flex items-center gap-3"
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ duration: 0.6, delay: 0.65 }}
            >
              <div className="h-px w-10 bg-foreground/15" />
              <span className="label-mono text-[0.68rem] text-foreground/30">{collection.accent}</span>
            </motion.div>
          </motion.div>
        </div>
      </Link>
    </div>
  );
}

/* ─── Footer Strip ───────────────────────────────────────────────── */
function CollectionsFooter() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <div
      ref={ref}
      className="relative overflow-hidden border-t border-foreground/[0.07] bg-foreground py-20 text-background md:py-28"
    >
      {/* Ghost text */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <span
          className="select-none font-serif leading-none text-background/[0.04]"
          style={{ fontSize: "clamp(5rem,18vw,15rem)", whiteSpace: "nowrap" }}
        >
          SYNARAVA
        </span>
      </div>

      <div className="site-shell relative z-10 flex flex-col items-center gap-10 text-center">
        <motion.p
          className="label-mono text-couture-red"
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease }}
        >
          Not sure where to start?
        </motion.p>
        <motion.h2
          className="max-w-2xl font-serif leading-[1.05]"
          style={{ fontSize: "clamp(1.8rem,4vw,3.5rem)" }}
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, ease, delay: 0.1 }}
        >
          Browse everything in the shop
        </motion.h2>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease, delay: 0.22 }}
        >
          <Link
            href="/shop"
            className="group relative inline-flex cursor-pointer items-center gap-3 overflow-hidden bg-couture-red px-10 py-4 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white"
          >
            <span className="relative z-10">Shop all products</span>
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
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

/* ─── Root Export ────────────────────────────────────────────────── */
export function CollectionsPage({
  collections,
}: {
  collections: CollectionSummary[];
}) {
  const [cursorHovered, setCursorHovered] = useState(false);

  const handleHover = useCallback((v: boolean) => setCursorHovered(v), []);

  return (
    <main className="artifact-shell min-h-screen overflow-x-hidden">
      <CustomCursor hovered={cursorHovered} />
      <CollectionsHero count={collections.length} />
      <div>
        {collections.map((col, i) => (
          <CollectionRow
            key={col.slug}
            collection={col}
            index={i}
            onHover={handleHover}
          />
        ))}
        {/* Final divider */}
        <div className="h-px bg-foreground/[0.06]" />
      </div>
      <CollectionsFooter />
    </main>
  );
}