"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import Link from "next/link";

import { MagneticButton } from "@/components/ui/magnetic-button";
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
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  return (
    <motion.div
      ref={ref}
      className="relative overflow-hidden border border-foreground/[0.07] p-10 md:p-16"
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease }}
    >
      <motion.div
        className="absolute left-0 top-0 w-0.5 bg-couture-red"
        initial={{ height: 0 }}
        animate={isInView ? { height: "100%" } : {}}
        transition={{ duration: 1.2, delay: 0.3, ease }}
      />

      <motion.div
        className="mb-10 flex items-center gap-5"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="h-px w-10 bg-foreground/15" />
        <div className="h-2 w-2 rotate-45 border border-couture-red/50" />
        <div className="h-px w-10 bg-foreground/15" />
      </motion.div>

      <motion.h2
        className="mb-4 font-serif"
        style={{ fontSize: "clamp(1.8rem,3.5vw,2.8rem)" }}
        initial={{ opacity: 0, y: 16 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, ease, delay: 0.3 }}
      >
        The cart is empty.
      </motion.h2>

      <motion.p
        className="mb-10 max-w-md text-base leading-[2] text-foreground/60"
        initial={{ opacity: 0, y: 12 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7, ease, delay: 0.42 }}
      >
        Start from the product pages or the shop archive. Once a piece is added, it stays available for guest checkout or account-based checkout.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7, ease, delay: 0.55 }}
      >
        <MagneticButton
          href="/shop"
          className="group relative inline-flex cursor-pointer items-center gap-3 overflow-hidden bg-couture-red px-8 py-4 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white"
        >
          <span className="relative z-10">Browse archive</span>
          <svg className="relative z-10 h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 12 12" fill="none">
            <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span aria-hidden="true" className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.14) 50%, transparent 70%)",
              backgroundSize: "200% 100%",
              animation: "shiny-sweep 2.5s infinite linear",
            }}
          />
        </MagneticButton>
      </motion.div>
    </motion.div>
  );
}

export function CartShell({ items, itemCount, subtotal }: CartShellProps) {
  return (
    <main className="artifact-shell min-h-screen overflow-x-hidden">
      <div className="relative z-10 pt-28">
        {/* Header */}
        <div className="border-b border-foreground/[0.06] pb-12 pt-10">
          <div className="site-shell">
            <motion.p
              className="label-mono mb-4 text-couture-red"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease }}
            >
              Selection
            </motion.p>
            <motion.h1
              className="font-serif leading-[0.9]"
              style={{ fontSize: "clamp(2.4rem,5vw,5rem)" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease, delay: 0.1 }}
            >
              Your Cart
            </motion.h1>
            <motion.p
              className="mt-5 max-w-xl text-base leading-[2] text-foreground/55"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease, delay: 0.22 }}
            >
              Guests can continue to shipping without registering, and signed-in users keep the same cart after login.
            </motion.p>
          </div>
        </div>

        {/* Body */}
        <div className="site-shell py-14">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <section>
              {items.length === 0 ? (
                <EmptyCart />
              ) : (
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
              )}
            </section>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease, delay: 0.2 }}
            >
              <CartSummaryPanel
                itemCount={itemCount}
                subtotal={subtotal}
                ctaHref={items.length > 0 ? "/checkout/shipping" : undefined}
                ctaLabel={items.length > 0 ? "Continue to shipping" : undefined}
                note="Shipping details come first. At checkout you can either sign in or continue as guest."
              />

              {items.length > 0 && (
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
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </main>
  );
}
