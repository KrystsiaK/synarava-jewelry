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
      className="mt-5"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/55">
        {t("product.pairings.carouselTitle")}
      </p>
      <ul
        data-pairing-grid="equal"
        className="grid grid-cols-2 gap-3 md:grid-cols-3"
      >
        {pairing.partners.map((partner) => {
          const selected = pairing.selectedPartner?.product.slug === partner.product.slug;
          const soldOut = !partner.available;
          return (
            <li key={partner.pairingId} className="min-w-0">
              <button
                type="button"
                aria-pressed={selected}
                disabled={soldOut}
                onClick={() => pairing.selectPartner(partner.product.slug)}
                className={`group flex h-full min-h-11 w-full min-w-0 flex-col border text-left transition-[border-color,opacity] duration-200 motion-reduce:transition-none ${
                  soldOut
                    ? "cursor-not-allowed border-foreground/10 opacity-45"
                    : selected
                      ? "border-couture-red"
                      : "border-foreground/16 hover:border-foreground/45"
                }`}
              >
                <span className="relative block h-[148px] w-full shrink-0 overflow-hidden bg-surface">
                  <Image
                    src={partner.product.image}
                    alt={partner.product.title}
                    fill
                    sizes="(max-width: 768px) 45vw, 160px"
                    className="object-cover"
                  />
                </span>
                <span className="flex min-h-0 flex-1 flex-col px-2 pb-2 pt-2">
                  <span className="line-clamp-2 text-[0.72rem] font-semibold leading-4 text-foreground">
                    {partner.product.title}
                  </span>
                  <span className="mt-auto pt-2 text-[0.68rem] text-foreground/62">
                    {partner.product.price}
                  </span>
                  {soldOut ? (
                    <span className="mt-1 text-[0.62rem] uppercase tracking-[0.12em] text-foreground/45">
                      {t("product.pairings.soldOut")}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
