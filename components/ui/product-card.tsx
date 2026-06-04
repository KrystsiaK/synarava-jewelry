/* eslint-disable @next/next/no-img-element */
"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { ProductSummary } from "@/lib/content/catalog";

const ease = [0.22, 1, 0.36, 1] as const;

interface ProductCardProps {
  product: ProductSummary;
  index: number;
  isFeatured?: boolean;
  /** Controls the staggered entrance; pass isInView from parent */
  isParentInView: boolean;
  /** Optional vertical offset class for editorial stagger (e.g. "md:mt-16") */
  offsetClass?: string;
}

export function ProductCard({
  product,
  index,
  isFeatured = false,
  isParentInView,
  offsetClass,
}: ProductCardProps) {
  const aspectClass = isFeatured ? "aspect-[16/9]" : "aspect-[3/4]";

  return (
    <motion.div
      className={offsetClass}
      initial={{ opacity: 0, y: 48 }}
      animate={isParentInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.9, ease, delay: 0.06 + index * 0.11 }}
    >
      <Link href={`/products/${product.slug}`} className="group block cursor-pointer">
        {/* Image with Framer variants */}
        <motion.div
          className={`relative mb-5 overflow-hidden bg-stone-beige ${aspectClass}`}
          initial="rest"
          whileHover="hover"
          animate="rest"
        >
          <motion.img
            alt={product.title}
            src={product.image}
            className="h-full w-full object-cover will-change-transform"
            variants={{
              rest: { scale: 1, filter: "grayscale(0.35) brightness(0.88)" },
              hover: { scale: 1.06, filter: "grayscale(0) brightness(0.92)" },
            }}
            transition={{ type: "spring", stiffness: 250, damping: 30 }}
          />

          {/* Overlay slide-up */}
          <motion.div
            className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-foreground/75 via-foreground/25 to-transparent p-5"
            variants={{
              rest: { opacity: 0, y: "30%" },
              hover: { opacity: 1, y: "0%" },
            }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
          >
            <p className="label-mono mb-1 text-[0.65rem] text-white/75">{product.series}</p>
            <div className="flex items-end justify-between gap-2">
              <p
                className="font-serif leading-tight text-white"
                style={{ fontSize: isFeatured ? "clamp(1.2rem,2vw,1.6rem)" : "clamp(1rem,1.4vw,1.2rem)" }}
              >
                {product.title}
              </p>
              <span className="label-mono shrink-0 text-[0.68rem] text-couture-red">
                {product.price}
              </span>
            </div>
          </motion.div>

          {/* Bottom sweep */}
          <motion.div
            className="absolute bottom-0 left-0 h-0.5 bg-couture-red"
            variants={{ rest: { width: "0%" }, hover: { width: "100%" } }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          />
        </motion.div>

        {/* Meta */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="label-mono mb-1 block text-[0.72rem] text-muted-ink">
              {product.series}
            </span>
            <h3
              className="font-serif transition-colors duration-300 group-hover:text-couture-red"
              style={{
                fontSize: isFeatured
                  ? "clamp(1.3rem,2vw,1.7rem)"
                  : "clamp(1.1rem,1.5vw,1.4rem)",
              }}
            >
              {product.title}
            </h3>
            {isFeatured && product.shortDescription && (
              <p className="mt-2 hidden max-w-md text-sm leading-[1.85] text-foreground/60 md:block md:text-base">
                {product.shortDescription}
              </p>
            )}
          </div>
          <span className="label-mono shrink-0 pt-0.5 text-muted-ink transition-colors duration-300 group-hover:text-couture-red">
            {product.price}
          </span>
        </div>

        {/* Tags */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {product.categoryName && (
            <span className="border border-foreground/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/50 transition-colors duration-300 group-hover:border-couture-red/30 group-hover:text-couture-red/70">
              {product.categoryName}
            </span>
          )}
          {product.tagNames.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="border border-foreground/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/50 transition-colors duration-300 group-hover:border-couture-red/30 group-hover:text-couture-red/70"
            >
              {tag}
            </span>
          ))}
        </div>
      </Link>
    </motion.div>
  );
}