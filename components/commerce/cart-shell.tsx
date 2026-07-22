"use client";

import { type CSSProperties } from "react";
import { motion } from "motion/react";
import Link from "next/link";

import { PrimaryCtaButton } from "@/components/ui";
import { CartItemRow } from "./cart-item-row";
import { CartSummaryPanel } from "./cart-summary-panel";

const ease = [0.22, 1, 0.36, 1] as const;

type CartItem = {
  id: string;
  slug: string;
  title: string;
  imageUrl: string;
  materialLine: string;
  quantity: number;
  price: string;
  total: string;
};

type CartShellProps = {
  items: CartItem[];
  itemCount: number;
  subtotal: string;
};

function EmptyCart() {
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
        Nothing selected <span className="italic text-couture-red">yet.</span>
      </motion.h2>

      <motion.p
        className="mb-8 max-w-xl text-pretty text-base leading-[1.8] text-foreground/65 md:text-lg"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease, delay: 0.42 }}
      >
        Explore the archive and choose the piece that feels personal. You can return here and continue as a guest—no account required.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease, delay: 0.55 }}
      >
        <PrimaryCtaButton href="/shop">Browse archive</PrimaryCtaButton>
      </motion.div>
    </motion.div>
  );
}

export function CartShell({ items, itemCount, subtotal }: CartShellProps) {
  const pageStyle = {
    "--color-background": "#09090a",
    "--color-foreground": "#eeeae4",
    "--color-muted": "#aaa49d",
    "--color-muted-ink": "#aaa49d",
    "--color-panel": "#111114",
    "--color-surface": "#111114",
    "--color-stone-beige": "#201f20",
    "--color-stroke": "rgba(238,234,228,0.14)",
    backgroundColor: "#09090a",
  } as CSSProperties;

  return (
    <main
      className="cart-experience artifact-shell min-h-screen overflow-x-hidden text-foreground"
      style={pageStyle}
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
                Selection
              </motion.p>
              <motion.h1
                className="font-serif leading-[0.92] tracking-[-0.035em]"
                style={{ fontSize: "clamp(2.4rem,5vw,5rem)" }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease, delay: 0.1 }}
              >
                Your <span className="italic text-couture-red">Cart</span>
              </motion.h1>
            </div>
            <motion.p
              className="max-w-xl text-pretty text-base leading-[1.8] text-foreground/62 md:col-span-5 md:pb-1"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease, delay: 0.22 }}
            >
              Guests can continue to shipping without registering, and signed-in users keep the same cart after login.
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
                  ctaHref="/checkout/shipping"
                  ctaLabel="Continue to shipping"
                  note="Shipping details come first. At checkout you can either sign in or continue as guest."
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
                    Continue shopping
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
