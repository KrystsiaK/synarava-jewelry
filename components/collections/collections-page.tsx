"use client";

import Image from "next/image";
import { useRef, type CSSProperties } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";

import { ease } from "@/lib/animation";
import { EditorialSplitFeature, PrimaryCtaButton } from "@/components/ui";
import type { CollectionSummary } from "@/lib/content/catalog";

const HERO_SCROLL_SPRING = {
  stiffness: 70,
  damping: 27,
  mass: 0.85,
} as const;

function CollectionsHero({ collections }: { collections: CollectionSummary[] }) {
  const heroRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const leadCollection = collections[0];
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const smoothProgress = useSpring(scrollYProgress, HERO_SCROLL_SPRING);
  const mediaY = useTransform(smoothProgress, [0, 1], [0, 86]);
  const mediaScale = useTransform(smoothProgress, [0, 1], [1.02, 1.07]);
  const copyY = useTransform(smoothProgress, [0, 0.84], [0, 48]);
  const copyOpacity = useTransform(
    smoothProgress,
    [0, 0.58, 0.94],
    [1, 0.94, 0.28],
  );

  return (
    <header
      ref={heroRef}
      className="relative flex min-h-[94svh] items-end overflow-hidden bg-background pb-14 pt-32 text-foreground md:min-h-screen md:pb-[8vh] md:pt-36"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      {leadCollection ? (
        <motion.div
          className="absolute left-0 top-24 h-[58svh] w-[96%] overflow-hidden md:left-[3vw] md:top-28 md:h-[76vh] md:w-[64%] md:[clip-path:polygon(8%_0,100%_0,93%_100%,0_91%)]"
          style={reduceMotion ? undefined : { y: mediaY, scale: mediaScale }}
        >
          <Image
            src={leadCollection.heroImage}
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 64vw, 96vw"
            className="object-cover grayscale"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,4,5,.08),rgba(4,4,5,.28)_70%,rgba(4,4,5,.75))]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,4,5,.08),rgba(4,4,5,.16)_56%,rgba(4,4,5,.82))]" />
          <div className="absolute inset-[6%] border border-white/15" />
          <span className="absolute bottom-[11%] left-[9%] hidden text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-white/65 md:block">
            Opening world / {leadCollection.name}
          </span>
        </motion.div>
      ) : null}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[54%] bg-gradient-to-t from-background via-background/95 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 bottom-[5%] font-serif text-[clamp(7rem,19vw,18rem)] leading-none text-foreground/[0.025] [writing-mode:vertical-rl]"
      >
        SERIES
      </div>

      <motion.div
        className="relative z-10 mx-auto w-full max-w-[90rem] px-5 sm:px-8 md:flex md:justify-end md:px-[4vw]"
        style={reduceMotion ? undefined : { y: copyY, opacity: copyOpacity }}
      >
        <div className="w-full md:w-[57%] md:pl-8">
          <div className="mb-6 flex items-center gap-5">
            <span className="h-px w-14 bg-couture-red" />
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-muted-ink">
              Synarava collections · {String(collections.length).padStart(2, "0")} series
            </p>
          </div>

          <h1 className="max-w-[9ch] font-serif text-[clamp(3.65rem,8vw,8rem)] leading-[0.82] tracking-[-0.045em]">
            Browse by <em className="font-normal text-couture-red">collection</em>
          </h1>

          <p className="mt-7 max-w-xl text-base leading-7 text-muted-ink md:text-lg">
            Editorial worlds shaped by material, memory, and symbol. Enter a story
            before choosing the piece that belongs to it.
          </p>

          <div className="mt-9 flex flex-wrap gap-x-10 gap-y-3 border-t border-foreground/15 pt-5 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-muted-ink">
            <span>{String(collections.length).padStart(2, "0")} editorial worlds</span>
            <span>Material / symbol / memory</span>
          </div>
        </div>
      </motion.div>
    </header>
  );
}

/* ─── Collection Row ─────────────────────────────────────────────── */
function CollectionRow({
  collection,
  index,
}: {
  collection: CollectionSummary;
  index: number;
}) {
  const isReversed = index % 2 === 1;
  const numLabel = String(index + 1).padStart(2, "0");

  return (
    <EditorialSplitFeature
      href={`/collections/${collection.slug}`}
      reversed={isReversed}
      imageSrc={collection.heroImage}
      imageAlt={collection.name}
      className="mx-auto max-w-[90rem] bg-transparent"
      imagePanelClassName={
        isReversed
          ? "md:my-10 md:[clip-path:polygon(0_5%,92%_0,100%_95%,7%_100%)]"
          : "md:my-10 md:[clip-path:polygon(8%_0,100%_5%,93%_100%,0_95%)]"
      }
      contentPanelClassName="bg-surface/45"
      imageFrameClassName="md:aspect-[6/5] md:min-h-0 lg:aspect-[5/4] xl:aspect-[4/3]"
      topMeta={(
        <div className="flex items-center gap-4">
          <span className="label-mono text-couture-red">{numLabel}</span>
          <div className="h-px flex-1 bg-foreground/10" />
        </div>
      )}
      title={(
        <div>
          <p className="label-mono mb-4 text-couture-red">{collection.eyebrow}</p>
          <h2
            className="font-serif leading-[0.92] tracking-tight"
            style={{ fontSize: "clamp(2rem,4.5vw,4rem)" }}
          >
            {collection.name}
          </h2>
        </div>
      )}
      description={collection.summary}
      action={(
        <div className="flex items-center gap-4">
          <span className="label-caps border-b border-foreground/20 pb-1.5 transition-colors duration-300 group-hover:border-couture-red group-hover:text-couture-red">
            Explore collection
          </span>
          <svg
            className="h-4 w-4 text-couture-red transition-transform duration-300 group-hover:translate-x-2"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1 8h14M9 2l6 6-6 6"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
      footer={(
        <div className="flex items-center gap-3">
          <div className="h-px w-10 bg-foreground/15" />
          <span className="label-mono text-[0.68rem] text-foreground/30">{collection.accent}</span>
        </div>
      )}
      imageOverlay={(
        <>
          <div className="pointer-events-none absolute bottom-4 right-4 select-none">
            <span
              className="font-serif leading-none text-white/[0.12]"
              style={{ fontSize: "clamp(5rem,12vw,9rem)" }}
            >
              {numLabel}
            </span>
          </div>
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
        </>
      )}
    />
  );
}

/* ─── Footer Strip ───────────────────────────────────────────────── */
function CollectionsFooter() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <div
      ref={ref}
      className="relative overflow-hidden border-t border-white/10 bg-surface py-20 text-foreground md:py-28"
    >
      {/* Ghost text */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <span
          className="select-none font-serif leading-none text-foreground/[0.035]"
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
          <PrimaryCtaButton href="/shop">Shop all products</PrimaryCtaButton>
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
      className="collections-experience artifact-shell min-h-screen overflow-x-hidden text-foreground"
      style={pageStyle}
    >
      <CollectionsHero collections={collections} />
      <div className="relative bg-background py-4 md:py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.1]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
        <div className="relative z-10">
          {collections.map((col, i) => (
            <CollectionRow key={col.slug} collection={col} index={i} />
          ))}
          <div className="h-px bg-foreground/[0.06]" />
        </div>
      </div>
      <CollectionsFooter />
    </main>
  );
}
