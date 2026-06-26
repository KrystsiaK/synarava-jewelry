"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useInView } from "motion/react";
import { ease } from "@/lib/animation";

/* ─── KodRoda (Ancestral Cipher) ─────────────────────────────────── */
export function KodRoda({ className }: { className?: string }) {
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
      {([[100, 42], [158, 100], [100, 158], [42, 100]] as [number, number][]).map(([cx, cy], i) => (
        <motion.circle key={i} cx={cx} cy={cy} r="2.5" fill="currentColor"
          initial={{ scale: 0, opacity: 0 }}
          animate={isInView ? { scale: 1, opacity: 0.7 } : {}}
          transition={{ duration: 0.4, delay: 1.5 + i * 0.1, type: "spring", stiffness: 400 }}
        />
      ))}
    </motion.svg>
  );
}

/* ─── Kola (Solar Wheel) ─────────────────────────────────────────── */
export function Kola({ className }: { className?: string }) {
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

/* ─── Ziamla (Earth Grid) ────────────────────────────────────────── */
export function Ziamla({ className }: { className?: string }) {
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

/* ─── FolkBorder ─────────────────────────────────────────────────── */
export function FolkBorder({ className, delay = 0 }: { className?: string; delay?: number }) {
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

/* ─── FolkSpiderOrnament ─────────────────────────────────────────── */
export function FolkSpiderOrnament() {
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

/* ─── Static variants (no animation — for ghost backgrounds) ─────── */
export function KodRodaStatic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} aria-hidden="true">
      <path d="M100 8 L192 100 L100 192 L8 100 Z" stroke="currentColor" strokeWidth="1.2" />
      <path d="M100 42 L158 100 L100 158 L42 100 Z" stroke="currentColor" strokeWidth="1" />
      <path d="M100 68 L132 100 L100 132 L68 100 Z" stroke="currentColor" strokeWidth="0.85" />
      <path d="M100 8 L100 192" stroke="currentColor" strokeWidth="0.7" opacity="0.5" />
      <path d="M8 100 L192 100" stroke="currentColor" strokeWidth="0.7" opacity="0.5" />
      <path d="M42 42 L158 158" stroke="currentColor" strokeWidth="0.6" opacity="0.35" />
      <path d="M158 42 L42 158" stroke="currentColor" strokeWidth="0.6" opacity="0.35" />
      <path d="M100 8 L112 20 M100 8 L88 20" stroke="currentColor" strokeWidth="1" />
      <path d="M192 100 L180 112 M192 100 L180 88" stroke="currentColor" strokeWidth="1" />
      <path d="M100 192 L112 180 M100 192 L88 180" stroke="currentColor" strokeWidth="1" />
      <path d="M8 100 L20 112 M8 100 L20 88" stroke="currentColor" strokeWidth="1" />
      <circle cx="100" cy="100" r="3.5" fill="currentColor" />
      <circle cx="100" cy="42" r="2.5" fill="currentColor" opacity="0.7" />
      <circle cx="158" cy="100" r="2.5" fill="currentColor" opacity="0.7" />
      <circle cx="100" cy="158" r="2.5" fill="currentColor" opacity="0.7" />
      <circle cx="42" cy="100" r="2.5" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

export function KolaStatic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} aria-hidden="true">
      <circle cx="100" cy="100" r="88" stroke="currentColor" strokeWidth="1" />
      <circle cx="100" cy="100" r="60" stroke="currentColor" strokeWidth="0.85" opacity="0.6" />
      <circle cx="100" cy="100" r="28" stroke="currentColor" strokeWidth="1" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <line
            key={angle}
            x1={100 + 28 * Math.cos(rad)} y1={100 + 28 * Math.sin(rad)}
            x2={100 + 88 * Math.cos(rad)} y2={100 + 88 * Math.sin(rad)}
            stroke="currentColor"
            strokeWidth={i % 2 === 0 ? "1" : "0.6"}
            opacity={i % 2 === 0 ? "1" : "0.5"}
          />
        );
      })}
      <circle cx="100" cy="12" r="3" fill="currentColor" />
      <circle cx="188" cy="100" r="3" fill="currentColor" />
      <circle cx="100" cy="188" r="3" fill="currentColor" />
      <circle cx="12" cy="100" r="3" fill="currentColor" />
      <circle cx="100" cy="100" r="4" fill="currentColor" />
    </svg>
  );
}

export function ZiamlaStatic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} aria-hidden="true">
      <rect x="18" y="18" width="164" height="164" stroke="currentColor" strokeWidth="1.1" transform="rotate(45 100 100)" />
      <rect x="44" y="44" width="112" height="112" stroke="currentColor" strokeWidth="1" transform="rotate(45 100 100)" opacity="0.7" />
      <rect x="68" y="68" width="64" height="64" stroke="currentColor" strokeWidth="0.9" transform="rotate(45 100 100)" opacity="0.5" />
      <path d="M100 18 L100 182" stroke="currentColor" strokeWidth="0.7" opacity="0.4" />
      <path d="M18 100 L182 100" stroke="currentColor" strokeWidth="0.7" opacity="0.4" />
      <path d="M100 18 L88 30 M100 18 L112 30" stroke="currentColor" strokeWidth="1" />
      <path d="M182 100 L170 88 M182 100 L170 112" stroke="currentColor" strokeWidth="1" />
      <path d="M100 182 L88 170 M100 182 L112 170" stroke="currentColor" strokeWidth="1" />
      <path d="M18 100 L30 88 M18 100 L30 112" stroke="currentColor" strokeWidth="1" />
      <circle cx="100" cy="100" r="3" fill="currentColor" />
    </svg>
  );
}
