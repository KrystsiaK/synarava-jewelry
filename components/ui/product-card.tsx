"use client";

import { motion } from "motion/react";
import Link from "next/link";

import type { ShopListingProduct } from "@/lib/content/shop-listing";
import { RichText } from "@/components/content/rich-text";
import { ProductGalleryMedia } from "@/components/ui/product-gallery-media";
import { useTranslations } from "@/lib/i18n/context";
import { localePath } from "@/lib/i18n/routing";
import { discountPercent } from "@/lib/shopify/money";
import { formatDisplayTitle } from "@/lib/ui/display-title-words";

const ease = [0.22, 1, 0.36, 1] as const;

interface ProductCardProps {
  product: ShopListingProduct;
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
  const { locale } = useTranslations();
  const aspectClass = isFeatured ? "aspect-[16/9]" : "aspect-[3/4]";
  const discount = discountPercent(product.priceAmount, product.compareAtAmount);

  return (
    <motion.div
      className={offsetClass}
      initial={{ opacity: 0, y: 48 }}
      animate={isParentInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.9, ease, delay: Math.min(index, 5) * 0.11 + 0.06 }}
    >
      <Link
        href={localePath(locale, `/products/${product.slug}`)}
        className="group block cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground/40"
      >
        <ProductGalleryMedia
          src={product.image}
          alt={product.title}
          sizes={isFeatured ? "(max-width: 768px) 100vw, 66vw" : "(max-width: 768px) 100vw, 33vw"}
          aspectClassName={`${aspectClass} mb-5`}
          badge={
            discount != null ? (
              <span className="absolute left-3 top-3 z-20 bg-couture-red px-2 py-1 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-white">
                −{discount}%
              </span>
            ) : null
          }
        >
          <p className="product-media-scrim__meta label-mono mb-1 text-[0.65rem]">
            {product.series}
          </p>
          <div className="flex items-end justify-between gap-2">
            <h3
              className="product-media-scrim__title font-serif leading-tight"
              style={{ fontSize: isFeatured ? "clamp(1.2rem,2vw,1.6rem)" : "clamp(1rem,1.4vw,1.2rem)" }}
            >
              {formatDisplayTitle(product.title)}
            </h3>
            <span className="product-media-scrim__meta label-mono shrink-0 text-[0.68rem]">
              {product.price}
            </span>
          </div>
        </ProductGalleryMedia>

        {isFeatured && product.shortDescription ? (
          <RichText
            content={product.shortDescription}
            className="mt-2 hidden max-w-md text-sm leading-[1.85] text-foreground/60 md:block md:text-base"
          />
        ) : null}

        {/* Locale chips: category + product type + material (not raw Shopify SEO tags). */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {product.categoryName && (
            <span className="border border-foreground/[0.08] px-2 py-1 font-sans text-[0.6875rem] uppercase tracking-[0.12em] text-foreground/50">
              {product.categoryName}
            </span>
          )}
          {product.productTypeLabel && product.productTypeLabel !== product.categoryName && (
            <span className="border border-foreground/[0.08] px-2 py-1 font-sans text-[0.6875rem] uppercase tracking-[0.12em] text-foreground/50">
              {product.productTypeLabel}
            </span>
          )}
          {product.materialLabel && (
            <span className="border border-foreground/[0.08] px-2 py-1 font-sans text-[0.6875rem] uppercase tracking-[0.12em] text-foreground/50">
              {product.materialLabel}
            </span>
          )}
          {product.tagNames.slice(0, 1).map((tag) => (
            <span
              key={tag}
              className="border border-foreground/[0.08] px-2 py-1 font-sans text-[0.6875rem] uppercase tracking-[0.12em] text-foreground/50"
            >
              {tag}
            </span>
          ))}
        </div>
      </Link>
    </motion.div>
  );
}
