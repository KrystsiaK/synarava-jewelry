"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/** Target travel speed for the seamless −50% marquee cycle (25–35 px/s). */
export const ANNOUNCEMENT_MARQUEE_SPEED_PX_PER_S = 30;
export const ANNOUNCEMENT_MARQUEE_SPEED_MIN_PX_PER_S = 25;
export const ANNOUNCEMENT_MARQUEE_SPEED_MAX_PX_PER_S = 35;

/** Space between repeats of the same message (em). Spec: ≥6–8em. */
export const ANNOUNCEMENT_MARQUEE_GAP_EM = 7;

/**
 * Copies per marquee half so one half covers ≥1 viewport at a conservative
 * short-string width even with a large gap. Two halves → ≥2 viewport widths;
 * −50% translate stays seamless when spacing is padding (not gap).
 */
export const ANNOUNCEMENT_MARQUEE_COPIES_PER_HALF = 8;

export type AnnouncementMarqueeProps = {
  /** Ready display string. Empty / whitespace → render nothing. */
  message: string;
  /** Constant px/s travel speed. Duration is derived from measured cycle width. */
  speed?: number;
  /** Gap between repeats, in em (applied as half padding on each side). */
  gap?: number;
  className?: string;
};

/**
 * Duration (seconds) for one −50% cycle at constant px/s.
 * Distance traveled = half the cycle width (two identical halves).
 */
export function announcementMarqueeDurationSec(
  cycleWidthPx: number,
  speedPxPerS: number = ANNOUNCEMENT_MARQUEE_SPEED_PX_PER_S,
): number {
  if (!Number.isFinite(cycleWidthPx) || cycleWidthPx <= 0) return 0;
  if (!Number.isFinite(speedPxPerS) || speedPxPerS <= 0) return 0;
  return cycleWidthPx / 2 / speedPxPerS;
}

export function announcementMarqueeCopies(message: string): string[] {
  return Array.from({ length: ANNOUNCEMENT_MARQUEE_COPIES_PER_HALF }, () => message);
}

/**
 * Presentational free-shipping marquee. Knows nothing about Shopify or settings —
 * receives a ready message plus optional speed/gap. Pauses on hover/focus;
 * prefers-reduced-motion keeps a static centered line.
 *
 * Duration is applied as a CSS var from ResizeObserver (DOM write, not setState)
 * to satisfy react-hooks/set-state-in-effect.
 */
export function AnnouncementMarquee({
  message,
  speed = ANNOUNCEMENT_MARQUEE_SPEED_PX_PER_S,
  gap = ANNOUNCEMENT_MARQUEE_GAP_EM,
  className,
}: AnnouncementMarqueeProps) {
  const text = message.trim();
  const rootRef = useRef<HTMLDivElement>(null);
  const cycleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!text) return;
    const rootEl = rootRef.current;
    const cycleEl = cycleRef.current;
    if (!rootEl || !cycleEl) return;

    function applyDuration() {
      const width = cycleEl!.getBoundingClientRect().width;
      const next = announcementMarqueeDurationSec(width, speed);
      if (next > 0) {
        rootEl!.style.setProperty("--announcement-marquee-duration", `${next}s`);
      }
    }

    applyDuration();
    const observer = new ResizeObserver(applyDuration);
    observer.observe(cycleEl);
    return () => observer.disconnect();
  }, [text, speed]);

  if (!text) return null;

  const half = announcementMarqueeCopies(text);
  const rootClass = className
    ? `announcement-marquee ${className}`
    : "announcement-marquee";

  return (
    <div
      ref={rootRef}
      data-component="AnnouncementMarquee"
      className={rootClass}
      style={{ "--announcement-marquee-gap": `${gap}em` } as CSSProperties}
    >
      <div className="announcement-marquee__track" tabIndex={0}>
        {/* Visually hidden while marquee animates; SR reads this (no aria-label). */}
        <p className="announcement-marquee__static">{text}</p>
        <div className="announcement-marquee__marquee" aria-hidden="true">
          <div ref={cycleRef} className="announcement-marquee__cycle">
            {half.map((copy, index) => (
              <span key={`a-${index}`}>{copy}</span>
            ))}
            {half.map((copy, index) => (
              <span key={`b-${index}`}>{copy}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
