"use client";

import { type CSSProperties, Fragment, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { ease } from "@/lib/animation";
import { cn } from "@/lib/ui";

type DisplayTag = "h1" | "h2" | "h3";

type DisplayHeadingProps = {
  as?: DisplayTag;
  text?: string;
  children?: ReactNode;
  className?: string;
  id?: string;
  style?: CSSProperties;
  /** Slide each word up. The mask is taller than the glyphs, so descenders stay. */
  reveal?: boolean;
  /** Painted on the last word (collection, shop, product titles). */
  accentClassName?: string;
};

function wordsOf(text: string) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function StaticTitle({ text, accentClassName }: { text: string; accentClassName?: string }) {
  const words = wordsOf(text);
  if (!accentClassName || words.length === 0) return text;
  const last = words.at(-1) ?? "";
  const lead = words.slice(0, -1).join(" ");
  return (
    <>
      {lead ? `${lead} ` : null}
      <span className={accentClassName}>{last}</span>
    </>
  );
}

/**
 * Storefront display title. One component for every large serif heading.
 * Do not rebuild the word-slide with overflow-hidden: a line-height under 1
 * makes that mask shorter than Playfair's Cyrillic descenders.
 */
export function DisplayHeading({
  as = "h1",
  text = "",
  children,
  className,
  id,
  style,
  reveal = false,
  accentClassName,
}: DisplayHeadingProps) {
  const Tag = as;
  const reduceMotion = useReducedMotion() ?? false;
  const words = wordsOf(text);
  const slide = reveal && !children && words.length > 0;

  return (
    <Tag
      id={id}
      data-component="DisplayHeading"
      style={style}
      className={cn("type-display font-serif", className)}
    >
      {children ?? (slide ? (
        words.map((word, index) => (
          <Fragment key={`${word}-${index}`}>
            <span
              className={cn(
                "type-reveal",
                index < words.length - 1 && "type-reveal-gap",
                accentClassName && index === words.length - 1 && accentClassName,
              )}
            >
              <motion.span
                className="inline-block"
                initial={reduceMotion ? false : { y: "140%", opacity: 0 }}
                animate={{ y: "0%", opacity: 1 }}
                transition={{ duration: 0.95, ease, delay: 0.12 + index * 0.1 }}
              >
                {word}
              </motion.span>
            </span>
            {index < words.length - 1 ? <span className="sr-only"> </span> : null}
          </Fragment>
        ))
      ) : (
        <StaticTitle text={text} accentClassName={accentClassName} />
      ))}
    </Tag>
  );
}
