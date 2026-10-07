"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

import {
  DISPLAY_FIT_MIN_PX,
  displayFitMinScale,
  fitDisplayScale,
} from "@/lib/ui/fit-display-text";

/** Horizontal padding on `.type-reveal` (0.12em each side). */
const REVEAL_PAD_EM = 0.24;

type UseFitDisplayTextArgs = {
  /** When false, skip measuring and leave scale at 1. */
  enabled?: boolean;
  /** Whitespace-split tokens; empty means children/content path. */
  words: string[];
  /** Extra width for reveal word masks. */
  reveal?: boolean;
};

type UseFitDisplayTextResult = {
  ref: RefObject<HTMLHeadingElement | null>;
  style: CSSProperties;
  scale: number;
};

function measureMaxWordWidth(words: string[], font: string): number {
  if (typeof document === "undefined" || words.length === 0) return 0;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;
  ctx.font = font;
  let max = 0;
  for (const word of words) {
    const width = ctx.measureText(word).width;
    if (width > max) max = width;
  }
  return max;
}

function measureSingleLineWidth(el: HTMLElement): number {
  const previousWhiteSpace = el.style.whiteSpace;
  const previousFontSize = el.style.fontSize;
  // Batch writes before layout reads.
  el.style.fontSize = "";
  el.style.whiteSpace = "nowrap";
  const width = el.scrollWidth;
  el.style.whiteSpace = previousWhiteSpace;
  el.style.fontSize = previousFontSize;
  return width;
}

/**
 * Fits display titles into their measure by scaling font-size so the longest
 * word never needs a mid-word break. Remeasures on resize and font load.
 */
export function useFitDisplayText({
  enabled = true,
  words,
  reveal = false,
}: UseFitDisplayTextArgs): UseFitDisplayTextResult {
  const ref = useRef<HTMLHeadingElement | null>(null);
  const [scale, setScale] = useState(1);
  const wordsKey = words.join("\u0001");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !enabled) {
      setScale(1);
      return;
    }

    let frame = 0;
    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      const node = ref.current;
      if (!node) return;

      const tokenWords = wordsKey.length > 0 ? wordsKey.split("\u0001").filter(Boolean) : [];

      // Clear previous fit so Tailwind clamp / class font-size applies as base.
      node.style.fontSize = "";

      const styles = getComputedStyle(node);
      const basePx = parseFloat(styles.fontSize);
      if (!(basePx > 0)) {
        setScale(1);
        return;
      }

      const availableWidth = node.clientWidth;
      if (!(availableWidth > 0)) {
        setScale(1);
        return;
      }

      let maxWordWidth = 0;

      if (tokenWords.length > 0) {
        const font = [
          styles.fontStyle,
          styles.fontWeight,
          `${basePx}px`,
          styles.fontFamily,
        ]
          .filter((part) => part && part !== "normal")
          .join(" ");
        maxWordWidth = measureMaxWordWidth(tokenWords, font);
        if (reveal) maxWordWidth += REVEAL_PAD_EM * basePx;
      } else {
        maxWordWidth = measureSingleLineWidth(node);
      }

      const next = fitDisplayScale({
        availableWidth,
        maxWordWidth,
        minScale: displayFitMinScale(basePx, DISPLAY_FIT_MIN_PX),
      });

      if (cancelled) return;
      setScale(next);
      if (next < 1) {
        node.style.fontSize = `${basePx * next}px`;
      }
    };

    const schedule = () => {
      if (cancelled) return;
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    measure();

    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(el);
    window.addEventListener("resize", schedule, { passive: true });
    void document.fonts?.ready.then(() => {
      if (!cancelled) schedule();
    });

    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      el.style.fontSize = "";
    };
  }, [enabled, reveal, wordsKey]);

  return {
    ref,
    scale,
    style: {
      ["--display-fit-scale" as string]: String(scale),
    },
  };
}
