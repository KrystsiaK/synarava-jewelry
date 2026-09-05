"use client";

import { motion } from "motion/react";
import Link from "next/link";

import { PrimaryCtaButton } from "@/components/ui";
import { CartItemRow } from "./cart-item-row";
import { CartSummaryPanel } from "./cart-summary-panel";
import { useTranslations } from "@/lib/i18n/context";

const ease = [0.22, 1, 0.36, 1] as const;

type CartItem = {
  id: string;
  merchandiseId: string | null;
  sku: string | null;
  slug: string;
  title: string;
  imageUrl: string;
  materialLine: string;
  quantity: number;
  maxQuantity?: number | null;
  unitCents: number;
  price: string;
  total: string;
};

type CartShellProps = {
  items: CartItem[];
  itemCount: number;
  subtotalCents: number;
  subtotal: string;
  currency: string;
  usesShopifyCheckout: boolean;
};

function EmptyCart() {
  const { t } = useTranslations();
  return (
    <motion.div
      className="relative max-w-3xl py-8 md:py-16"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease }}
    >
      <motion.div
        className="mb-8 h-px w-full max-w-48 bg-foreground/18"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      />

      <motion.h2
        className="mb-5 max-w-[12ch] text-balance font-serif leading-[0.98]"
        style={{ fontSize: "clamp(2.4rem,5vw,4.8rem)" }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease, delay: 0.3 }}
      >
        {t("cart.emptyTitleLead")} <span className="italic text-couture-red">{t("cart.emptyTitleAccent")}</span>
      </motion.h2>

      <motion.p
        className="mb-8 max-w-xl text-pretty text-base leading-[1.8] text-foreground/65 md:text-lg"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease, delay: 0.42 }}
      >
        {t("cart.emptyBody")}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease, delay: 0.55 }}
      >
        <PrimaryCtaButton href="/shop">{t("cart.browse")}</PrimaryCtaButton>
      </motion.div>
    </motion.div>
  );
}

export function CartShell({
  items,
  itemCount,
  subtotalCents,
  subtotal,
  currency,
  usesShopifyCheckout,
}: CartShellProps) {
  const { t } = useTranslations();
  return (
    <main
      className="cart-experience artifact-shell min-h-screen overflow-x-hidden bg-background text-foreground"
    >
      <div className="relative z-10 pt-28">
        <div className="border-b border-foreground/10 pb-10 pt-8 md:pb-14 md:pt-12">
          <div className="site-shell grid gap-6 md:grid-cols-12 md:items-end">
            <div className="md:col-span-7">
              <motion.p
                className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-couture-red"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, ease }}
              >
                {t("cart.eyebrow")}
              </motion.p>
              <motion.h1
                className="font-serif leading-[0.92] tracking-[-0.035em]"
                style={{ fontSize: "clamp(2.4rem,5vw,5rem)" }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease, delay: 0.1 }}
              >
                {t("cart.titleLead")} <span className="italic text-couture-red">{t("cart.titleAccent")}</span>
              </motion.h1>
            </div>
            <motion.p
              className="max-w-xl text-pretty text-base leading-[1.8] text-foreground/62 md:col-span-5 md:pb-1"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease, delay: 0.22 }}
            >
              {t("cart.description")}
            </motion.p>
          </div>
        </div>

        <div className="site-shell py-10 md:py-14">
          {items.length === 0 ? (
            <section>
              <EmptyCart />
            </section>
          ) : (
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <section>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, ease }}
                >
                  {items.map((item, i) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, ease, delay: i * 0.08 }}
                    >
                      <CartItemRow item={item} />
                    </motion.div>
                  ))}
                </motion.div>
              </section>

              <motion.div
                className="lg:sticky lg:top-28 lg:self-start"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, ease, delay: 0.2 }}
              >
                <CartSummaryPanel
                  itemCount={itemCount}
                  subtotal={subtotal}
                  ctaHref="/checkout"
                  ctaLabel={usesShopifyCheckout ? t("cart.secureCheckout") : t("cart.continueDelivery")}
                  ecommerce={usesShopifyCheckout ? {
                    currency,
                    value: subtotalCents / 100,
                    items: items.map((item) => ({
                      item_id: item.sku || item.merchandiseId || item.slug || item.id,
                      item_name: item.title,
                      item_variant: item.materialLine || undefined,
                      price: item.unitCents / 100,
                      quantity: item.quantity,
                    })),
                  } : undefined}
                  note={
                    usesShopifyCheckout
                      ? t("cart.shopifyNote")
                      : t("cart.localNote")
                  }
                />

                <motion.div
                  className="mt-5 text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <Link
                    href="/shop"
                    className="label-mono border-b border-foreground/15 pb-1 text-foreground/45 transition-colors hover:border-couture-red hover:text-couture-red"
                  >
                    {t("cart.continueShopping")}
                  </Link>
                </motion.div>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
