"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { ease, GRAIN_STYLE } from "@/lib/animation";

interface PageHeroProps {
  eyebrow: string;
  title: string;
  description?: string;
  /** Faint background ghost text (defaults to uppercase title) */
  ghostText?: string;
  /** Small label shown before the eyebrow, e.g. "Archive — 05 Series" */
  badge?: string;
}

export function PageHero({
  eyebrow,
  title,
  description,
  ghostText,
  badge,
}: PageHeroProps) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const titleY = useTransform(scrollYProgress, [0, 1], ["0%", "24%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  const words = title.split(" ");
  const ghost = ghostText ?? title.toUpperCase();

  return (
    <motion.header
      ref={ref}
      className="relative flex min-h-[52vh] items-end overflow-hidden bg-background pb-16 pt-28 md:min-h-[60vh] md:pb-20"
    >
      {/* Grain */}
      <div
        className="pointer-events-none absolute inset-0 z-0 mix-blend-multiply opacity-[0.035]"
        style={GRAIN_STYLE}
      />

      {/* Ghost text */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 overflow-hidden">
        <motion.span
          className="block select-none text-center font-serif leading-none text-foreground"
          style={{ fontSize: "clamp(4rem,16vw,13rem)", opacity: 0.022, letterSpacing: "0.04em" }}
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 0.022 }}
          transition={{ duration: 1.8, ease, delay: 0.5 }}
        >
          {ghost}
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

      <motion.div className="site-shell relative z-10" style={{ y: titleY, opacity }}>
        {badge && (
          <motion.p
            className="label-mono mb-4 text-couture-red"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease }}
          >
            {badge}
          </motion.p>
        )}

        <motion.p
          className={`label-mono ${badge ? "mb-2 text-muted-ink" : "mb-6 text-couture-red"}`}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease, delay: badge ? 0.1 : 0 }}
        >
          {eyebrow}
        </motion.p>

        <h1
          className="font-serif leading-[0.88] tracking-tight"
          style={{ fontSize: "clamp(2.8rem,8vw,7.5rem)" }}
        >
          {words.map((word, i) => (
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

        {description && (
          <motion.p
            className="mt-7 max-w-2xl text-base leading-[1.85] text-muted-ink md:text-lg"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.55, ease }}
          >
            {description}
          </motion.p>
        )}
      </motion.div>

      {/* Bottom line */}
      <motion.div
        className="absolute bottom-0 left-0 h-px bg-couture-red/40"
        initial={{ width: "0%" }}
        animate={{ width: "100%" }}
        transition={{ duration: 1.4, delay: 0.8, ease }}
      />
    </motion.header>
  );
}
