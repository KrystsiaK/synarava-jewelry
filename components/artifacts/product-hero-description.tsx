"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { useTranslations } from "@/lib/i18n/context";

const ease = [0.22, 1, 0.36, 1] as const;

export function ProductHeroDescription({
  summary,
  description,
}: {
  summary: string;
  description: string;
}) {
  const { t } = useTranslations();
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReducedMotion() ?? false;
  const descriptionId = useId();
  const summaryText = summary.trim();
  const completeText = description.trim() || summaryText;
  const canExpand = completeText !== summaryText;
  const visibleText = expanded ? completeText : summaryText;

  if (!visibleText) return null;

  return (
    <motion.div
      layout={reduceMotion ? false : true}
      className="mt-4 max-w-[60ch] md:mt-6"
      transition={{ layout: { duration: 0.38, ease } }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.p
          key={expanded ? "complete" : "summary"}
          id={descriptionId}
          layout={reduceMotion ? false : "position"}
          className="text-pretty text-sm leading-[1.65] text-foreground/76 md:text-base md:leading-[1.75]"
          initial={reduceMotion ? false : { opacity: 0, filter: "blur(3px)", y: 5 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, filter: "blur(2px)", y: -3 }}
          transition={{ duration: reduceMotion ? 0 : 0.2, ease }}
        >
          {visibleText}
        </motion.p>
      </AnimatePresence>

      {canExpand ? (
        <motion.button
          layout={reduceMotion ? false : "position"}
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="group mt-2 inline-flex min-h-11 items-center gap-3 py-2 text-left font-sans text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-couture-red underline-offset-4 outline-none transition-colors hover:text-couture-red/80 focus-visible:underline motion-reduce:transition-none"
          aria-controls={descriptionId}
          aria-expanded={expanded}
        >
          <span>{expanded ? t("product.showLess") : t("product.readFullStory")}</span>
          <span className="inline-flex w-10 items-center" aria-hidden="true">
            <span
              className={`h-px origin-left bg-current transition-transform duration-300 motion-reduce:transition-none ${
                expanded ? "w-5 scale-x-75" : "w-5 group-hover:scale-x-125"
              }`}
            />
            <ChevronDown
              className={`-ml-px size-3.5 shrink-0 transition-transform duration-300 motion-reduce:transition-none ${
                expanded ? "rotate-180" : ""
              }`}
              strokeWidth={1.5}
            />
          </span>
        </motion.button>
      ) : null}
    </motion.div>
  );
}
