"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";

import { useTranslations } from "@/lib/i18n/context";
import { cn } from "@/lib/ui";

export type ProductGalleryMediaProps = {
  src: string;
  alt: string;
  sizes: string;
  /** Aspect utility classes, e.g. `aspect-[3/4]` or `aspect-[4/5]`. */
  aspectClassName: string;
  className?: string;
  /** Caption (title / price) — stays fixed; never scales with the photo. */
  children?: ReactNode;
  /** Optional badge layered above the media (e.g. discount). */
  badge?: ReactNode;
  /** Compact rail variant (discovery / related). */
  rail?: boolean;
};

/**
 * Shared product photo frame — Gallery Frame hover:
 * full-color image, gentle scale, static bottom scrim, pearl edge on hover/focus.
 * Hover chrome is CSS (`@media (hover: hover)`) so focus-visible matches and
 * rapid pointer moves continue from the current transform/opacity.
 */
export function ProductGalleryMedia({
  src,
  alt,
  sizes,
  aspectClassName,
  className,
  children,
  badge,
  rail = false,
}: ProductGalleryMediaProps) {
  const { t } = useTranslations();
  const [imgError, setImgError] = useState(false);

  return (
    <div
      data-component="ProductGalleryMedia"
      data-rail={rail ? "true" : undefined}
      className={cn("product-gallery-media relative overflow-hidden bg-stone-beige", aspectClassName, className)}
    >
      {badge}

      {imgError ? (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-3 bg-stone-beige/60"
          role="img"
          aria-label={t("product.imageUnavailable")}
        >
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
          <span className="label-mono text-[0.65rem] text-foreground/55">{t("product.imageUnavailable")}</span>
        </div>
      ) : (
        <div className="product-gallery-media__image-wrap absolute inset-0">
          <Image
            alt={alt}
            src={src}
            fill
            sizes={sizes}
            className="object-cover"
            onError={() => setImgError(true)}
          />
        </div>
      )}

      {/* Static neutral bottom scrim — not animated, bottom band only */}
      <div
        className={cn(
          "product-media-scrim pointer-events-none absolute inset-x-0 bottom-0",
          rail ? "product-media-scrim--rail" : null,
        )}
        aria-hidden="true"
      />

      {/* Pearl inner edge — opacity only; layout-neutral */}
      <div className="product-gallery-media__edge" aria-hidden="true" />

      {children ? (
        <div className="product-gallery-media__caption absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end p-5">
          {children}
        </div>
      ) : null}
    </div>
  );
}
