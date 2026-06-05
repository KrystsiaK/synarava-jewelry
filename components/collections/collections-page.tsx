"use client";

import { useRef } from "react";
import {
  motion,
  useInView,
} from "motion/react";

import { ease } from "@/lib/animation";
import { EditorialSplitFeature, PageHero, PrimaryCtaButton } from "@/components/ui";
import type { CollectionSummary } from "@/lib/content/catalog";

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
      imageFrameClassName="md:aspect-auto md:min-h-[55vh]"
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
  return (
    <main className="artifact-shell min-h-screen overflow-x-hidden">
      <PageHero
        eyebrow={`Archive — ${String(collections.length).padStart(2, "0")} Series`}
        title="Browse by Collection"
        ghostText="COLLECTIONS"
        description="Collections are the editorial layer of the shop. They group products by visual language, material mood, and symbolism — enter a world before choosing a piece."
      />
      <div>
        {collections.map((col, i) => (
          <CollectionRow key={col.slug} collection={col} index={i} />
        ))}
        <div className="h-px bg-foreground/[0.06]" />
      </div>
      <CollectionsFooter />
    </main>
  );
}
