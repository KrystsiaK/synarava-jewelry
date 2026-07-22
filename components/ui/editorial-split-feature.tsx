"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { motion, useInView, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import Link from "next/link";

import { ease } from "@/lib/animation";

type EditorialSplitFeatureProps = {
  title: ReactNode;
  imageSrc: string;
  imageAlt: string;
  href?: string;
  description?: ReactNode;
  topMeta?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  imageOverlay?: ReactNode;
  reversed?: boolean;
  showDivider?: boolean;
  className?: string;
  imagePanelClassName?: string;
  contentPanelClassName?: string;
  imageFrameClassName?: string;
  imageClassName?: string;
  contentPaddingClassName?: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function EditorialSplitFeature({
  title,
  imageSrc,
  imageAlt,
  href,
  description,
  topMeta,
  action,
  footer,
  imageOverlay,
  reversed = false,
  showDivider = true,
  className,
  imagePanelClassName,
  contentPanelClassName,
  imageFrameClassName,
  imageClassName,
  contentPaddingClassName,
}: EditorialSplitFeatureProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-12%" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);

  const content = (
    <div
      className={cx(
        "grid grid-cols-1 items-stretch md:grid-cols-12",
        reversed && "md:[&>*:first-child]:order-2",
      )}
    >
      <motion.div
        className={cx(
          "relative overflow-hidden bg-stone-beige md:col-span-7",
          imagePanelClassName,
        )}
        initial={{ opacity: 0, x: reversed ? 40 : -40 }}
        animate={isInView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 1, ease, delay: 0.05 }}
      >
        <div
          className={cx(
            "aspect-[16/10] overflow-hidden md:h-full md:min-h-[34rem] lg:min-h-[38rem]",
            imageFrameClassName,
          )}
        >
          <motion.div
            className={cx(
              "relative -top-[11%] h-[122%] w-full will-change-transform",
              imageClassName,
            )}
            style={{ y: imgY }}
            initial={{ filter: "grayscale(1) brightness(0.84)" }}
            whileHover={href ? { filter: "grayscale(0) brightness(0.92)", scale: 1.03 } : undefined}
            transition={{ duration: 0.75 }}
          >
            <Image
              alt={imageAlt}
              src={imageSrc}
              fill
              sizes="(max-width: 768px) 100vw, 58vw"
              className="object-cover"
            />
          </motion.div>
        </div>
        {imageOverlay}
      </motion.div>

      <motion.div
        className={cx(
          "flex flex-col justify-center gap-7 md:col-span-5",
          "px-7 py-10 sm:px-8 sm:py-12 md:px-10 md:py-12 lg:px-14 lg:py-16",
          contentPaddingClassName,
          contentPanelClassName,
        )}
        initial={{ opacity: 0, x: reversed ? -40 : 40 }}
        animate={isInView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 1, ease, delay: 0.15 }}
      >
        {topMeta && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease, delay: 0.2 }}
          >
            {topMeta}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.85, ease, delay: 0.28 }}
        >
          {title}
        </motion.div>

        {description && (
          <motion.div
            className="max-w-sm text-base leading-[1.85] text-muted-ink md:max-w-md md:text-[1.0625rem]"
            initial={{ opacity: 0, y: 16 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease, delay: 0.38 }}
          >
            {description}
          </motion.div>
        )}

        {action && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.7, delay: 0.5 }}
          >
            {action}
          </motion.div>
        )}

        {footer && (
          <motion.div
            className="mt-auto"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.65 }}
          >
            {footer}
          </motion.div>
        )}
      </motion.div>
    </div>
  );

  return (
    <div ref={ref} className={className}>
      {showDivider && (
        <div className="relative h-px bg-foreground/[0.06]">
          <motion.div
            className="absolute left-0 top-0 h-full bg-couture-red/30"
            initial={{ width: "0%" }}
            animate={isInView ? { width: "100%" } : {}}
            transition={{ duration: 1.2, ease }}
          />
        </div>
      )}

      {href ? (
        <Link href={href} className="group block">
          {content}
        </Link>
      ) : (
        <div className="group block">{content}</div>
      )}
    </div>
  );
}
