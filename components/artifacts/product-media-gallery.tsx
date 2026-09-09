"use client";

import { useState } from "react";
import Image from "next/image";

import { AnimatedModal } from "@/components/ui/animated-modal";
import type { ProductSummary } from "@/lib/content/catalog";
import { useTranslations } from "@/lib/i18n/context";

type GalleryProduct = Pick<ProductSummary, "title" | "image" | "commerceMedia">;

function galleryMedia(product: GalleryProduct) {
  const seen = new Set<string>();
  return [
    { src: product.image, alt: product.title, width: null, height: null },
    ...product.commerceMedia,
  ].filter((item) => {
    if (!item.src || seen.has(item.src)) return false;
    seen.add(item.src);
    return true;
  });
}

export function ProductMediaGallery({ product }: { product: GalleryProduct }) {
  const { t } = useTranslations();
  const media = galleryMedia(product);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [failedSources, setFailedSources] = useState<Set<string>>(() => new Set());
  const active = media[activeIndex] ?? media[0];
  const count = media.length;

  if (!active) return null;

  function select(index: number) {
    setActiveIndex(index);
    setZoomed(false);
  }

  function move(direction: -1 | 1) {
    select((activeIndex + direction + count) % count);
  }

  function markFailed(src: string) {
    setFailedSources((current) => new Set(current).add(src));
  }

  const position = `${String(activeIndex + 1).padStart(2, "0")} / ${String(count).padStart(2, "0")}`;

  return (
    <section data-component="ProductMediaGallery" aria-label={t("product.galleryLabel")} className="min-w-0">
      <div className="grid gap-3 md:grid-cols-[4.5rem_minmax(0,1fr)] md:gap-4">
        <div className="order-2 flex snap-x gap-2 overflow-x-auto pb-1 md:order-1 md:grid md:max-h-[42rem] md:content-start md:overflow-y-auto md:pb-0">
          {media.map((item, index) => (
            <button
              key={item.src}
              type="button"
              aria-label={t("product.showImage", { current: index + 1, total: count })}
              aria-pressed={index === activeIndex}
              onClick={() => select(index)}
              className="relative aspect-square w-[4.5rem] shrink-0 snap-start overflow-hidden border border-foreground/16 bg-surface transition-[border-color,opacity] duration-200 hover:border-foreground/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-couture-red aria-pressed:border-couture-red aria-pressed:opacity-100 md:w-full"
            >
              {failedSources.has(item.src) ? (
                <span className="absolute inset-0 grid place-items-center text-xs text-foreground/55" aria-hidden="true">×</span>
              ) : (
                <Image
                  src={item.src}
                  alt=""
                  fill
                  sizes="72px"
                  className="object-cover"
                  onError={() => markFailed(item.src)}
                />
              )}
              <span className="absolute bottom-1 right-1 bg-background/88 px-1 py-0.5 text-[0.58rem] font-semibold tabular-nums text-foreground md:hidden">
                {String(index + 1).padStart(2, "0")}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          aria-label={t("product.enlargeImage", { current: activeIndex + 1, total: count })}
          onClick={() => setLightboxOpen(true)}
          className="group relative order-1 h-[clamp(20rem,50svh,32rem)] overflow-hidden bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-couture-red md:order-2 md:h-[min(70svh,42rem)]"
        >
          {failedSources.has(active.src) ? (
            <span className="absolute inset-0 grid place-items-center text-sm text-foreground/55">{t("product.imageUnavailable")}</span>
          ) : (
            <Image
              key={active.src}
              src={active.src}
              alt={active.alt || product.title}
              fill
              preload={activeIndex === 0}
              quality={75}
              sizes="(max-width: 767px) 100vw, 58vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.012] motion-reduce:transition-none"
              onError={() => markFailed(active.src)}
            />
          )}
          <span className="absolute left-3 top-3 bg-background/90 px-2.5 py-1.5 text-[0.65rem] font-semibold tracking-[0.14em] text-foreground backdrop-blur-sm">
            {position}
          </span>
          <span className="absolute bottom-3 right-3 flex min-h-11 items-center gap-2 bg-background/92 px-3.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-foreground backdrop-blur-sm transition-colors group-hover:bg-background">
            <ZoomIcon /> {t("product.viewLarger")}
          </span>
        </button>
      </div>

      <AnimatedModal
        open={lightboxOpen}
        onClose={() => { setLightboxOpen(false); setZoomed(false); }}
        ariaLabel={t("product.expandedImage")}
        className="pointer-events-auto relative h-[calc(100svh-1rem)] w-[calc(100vw-1rem)] max-w-[96rem] overflow-hidden bg-[#0d0d0f] text-white md:h-[calc(100svh-3rem)] md:w-[calc(100vw-3rem)]"
        portalClassName="product-lightbox-root"
        zIndexClassName="z-[80]"
        backdropZIndexClassName="z-[75]"
      >
        <div
          className="relative h-full w-full"
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" && count > 1) move(-1);
            if (event.key === "ArrowRight" && count > 1) move(1);
          }}
        >
          <button
            type="button"
            onClick={() => setZoomed((value) => !value)}
            aria-label={zoomed ? t("product.zoomOut") : t("product.zoomIn")}
            className={`absolute inset-0 ${zoomed ? "cursor-zoom-out" : "cursor-zoom-in"}`}
          >
            <Image
              key={`expanded-${active.src}`}
              src={active.src}
              alt={active.alt || product.title}
              fill
              sizes="100vw"
              quality={75}
              className={`object-contain transition-transform duration-300 ease-out motion-reduce:transition-none ${zoomed ? "scale-[1.7]" : "scale-100"}`}
            />
          </button>

          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/65 to-transparent p-4 pb-12 md:p-6 md:pb-16">
            <span className="text-xs font-semibold tracking-[0.18em] text-white/82">{position}</span>
            <button
              type="button"
              onClick={() => { setLightboxOpen(false); setZoomed(false); }}
              className="pointer-events-auto flex min-h-11 items-center gap-2 border border-white/35 bg-black/25 px-3 text-xs font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-white hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label={t("product.closeExpandedImage")}
            >
              <CloseIcon /> <span className="hidden sm:inline">{t("product.close")}</span>
            </button>
          </div>

          {count > 1 ? (
            <div className="pointer-events-none absolute inset-x-3 top-1/2 flex -translate-y-1/2 justify-between md:inset-x-6">
              <GalleryArrow label={t("product.previousImage")} direction="left" onClick={() => move(-1)} />
              <GalleryArrow label={t("product.nextImage")} direction="right" onClick={() => move(1)} />
            </div>
          ) : null}
        </div>
      </AnimatedModal>
    </section>
  );
}

function GalleryArrow({ label, direction, onClick }: { label: string; direction: "left" | "right"; onClick: () => void }) {
  return (
    <button data-component="GalleryArrow" type="button" aria-label={label} onClick={onClick} className="pointer-events-auto grid size-12 place-items-center border border-white/35 bg-black/30 transition-colors hover:bg-white hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:size-14">
      <ArrowIcon direction={direction} />
    </button>
  );
}

function ZoomIcon() {
  return <svg data-component="ZoomIcon" aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5M10.5 7v7M7 10.5h7" /></svg>;
}

function CloseIcon() {
  return <svg data-component="CloseIcon" aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 5 14 14M19 5 5 19" /></svg>;
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return <svg data-component="ArrowIcon" aria-hidden="true" viewBox="0 0 24 24" className={`size-5 ${direction === "right" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m14.5 5-7 7 7 7" /></svg>;
}
