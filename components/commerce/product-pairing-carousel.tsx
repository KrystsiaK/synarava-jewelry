"use client";

import Image from "next/image";

import { useOptionalProductPairingSelection } from "@/components/commerce/product-pairing-selection";
import { useTranslations } from "@/lib/i18n/context";

export function ProductPairingCarousel() {
  const pairing = useOptionalProductPairingSelection();
  const { t } = useTranslations();
  if (!pairing || pairing.partners.length === 0) return null;

  return (
    <section
      data-component="ProductPairingCarousel"
      aria-label={t("product.pairings.carouselLabel")}
      className="mt-4"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/55">
        {t("product.pairings.carouselTitle")}
      </p>
      <ul className="flex gap-3 overflow-x-auto pb-1">
        {pairing.partners.map((partner) => {
          const selected = pairing.selectedPartner?.product.slug === partner.product.slug;
          const soldOut = !partner.available;
          return (
            <li key={partner.pairingId} className="shrink-0">
              <button
                type="button"
                aria-pressed={selected}
                disabled={soldOut}
                onClick={() => pairing.selectPartner(partner.product.slug)}
                className={`group min-h-11 min-w-[5.5rem] max-w-[7.5rem] border px-2 py-2 text-left transition-[border-color,opacity] duration-200 motion-reduce:transition-none ${
                  soldOut
                    ? "cursor-not-allowed border-foreground/10 opacity-45"
                    : selected
                      ? "border-couture-red"
                      : "border-foreground/16 hover:border-foreground/45"
                }`}
              >
                <span className="relative mb-2 block aspect-square overflow-hidden bg-surface">
                  <Image
                    src={partner.pairImageUrl || partner.product.image}
                    alt={partner.product.title}
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                </span>
                <span className="block truncate text-[0.72rem] font-semibold leading-4 text-foreground">
                  {partner.product.title}
                </span>
                <span className="mt-1 block truncate text-[0.68rem] text-foreground/62">
                  {partner.product.price}
                </span>
                {soldOut ? (
                  <span className="mt-1 block text-[0.62rem] uppercase tracking-[0.12em] text-foreground/45">
                    {t("product.pairings.soldOut")}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
