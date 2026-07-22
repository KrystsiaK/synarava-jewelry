"use client";

import { useState } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import type { ProductSummary } from "@/lib/content/catalog";

const ease = [0.22, 1, 0.36, 1] as const;

interface ProductCardProps {
  product: ProductSummary;
  index: number;
  isFeatured?: boolean;
  isParentInView: boolean;
  offsetClass?: string;
}

export function ProductCard({
  product,
  index,
  isFeatured = false,
  isParentInView,
  offsetClass,
}: ProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const aspectClass = isFeatured ? "aspect-[16/9]" : "aspect-[3/4]";

  return (
    <motion.div
      className={offsetClass}
      initial={{ opacity: 0, y: 48 }}
      animate={isParentInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.9, ease, delay: 0.06 + index * 0.11 }}
    >
      <Link href={`/products/${product.slug}`} className="group block cursor-pointer">
        <motion.div
          className={`relative mb-5 overflow-hidden bg-stone-beige ${aspectClass}`}
          initial="rest"
          whileHover="hover"
          animate="rest"
        >
          {imgError ? (
            /* ── Broken image fallback ─────────────────────────────── */
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-stone-beige/60">
              <svg
                viewBox="0 0 48 48"
                fill="none"
                className="size-10 text-foreground/15"
                aria-hidden="true"
              >
                <rect x="6" y="10" width="36" height="28" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="18" cy="20" r="4" stroke="currentColor" strokeWidth="1.5" />
                <path d="M6 32l10-8 8 6 6-5 12 9" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              <span className="label-mono text-[0.65rem] text-foreground/25">Image unavailable</span>
            </div>
          ) : (
            <motion.div
              className="relative h-full w-full will-change-transform"
              variants={{
                rest: { scale: 1, filter: "grayscale(1) brightness(0.84)" },
                hover: { scale: 1.06, filter: "grayscale(0) brightness(0.92)" },
              }}
              transition={{ type: "spring", stiffness: 250, damping: 30 }}
            >
              <Image
                alt={product.title}
                src={product.image}
                fill
                sizes={isFeatured ? "(max-width: 768px) 100vw, 66vw" : "(max-width: 768px) 100vw, 33vw"}
                className="object-cover"
                onError={() => setImgError(true)}
              />
            </motion.div>
          )}

          {/* Overlay slide-up */}
          <motion.div
            className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/25 to-transparent p-5"
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
            <span className="border border-foreground/[0.08] px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.12em] text-foreground/50 transition-colors duration-300 group-hover:border-couture-red/30 group-hover:text-couture-red/70">
              {product.categoryName}
            </span>
          )}
          {product.tagNames.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="border border-foreground/[0.08] px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.12em] text-foreground/50 transition-colors duration-300 group-hover:border-couture-red/30 group-hover:text-couture-red/70"
            >
              {tag}
            </span>
          ))}
        </div>
      </Link>
    </motion.div>
  );
}
