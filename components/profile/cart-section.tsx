"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useInView } from "motion/react";

import { ArtifactLink } from "@/components/ui";

const ease = [0.22, 1, 0.36, 1] as const;

type CartItem = {
  id: string;
  title: string;
  sku: string | null;
  quantity: number;
  price: string;
  total: string;
  imageUrl: string | null;
  slug: string | null;
  materialLine: string;
};

type Cart = {
  id: string;
  currency: string;
  subtotal: string;
  itemCount: number;
  items: CartItem[];
};

type Props = { cart: Cart | null };

function EmptyCart() {
  return (
    <div className="flex flex-col items-start gap-4 border border-stroke px-8 py-12">
      <div className="flex items-center gap-4">
        <div className="h-px w-8 bg-foreground/15" />
        <div className="h-1.5 w-1.5 rotate-45 border border-couture-red/40" />
        <div className="h-px w-8 bg-foreground/15" />
      </div>
      <p className="font-serif text-2xl">Cart is empty.</p>
      <p className="max-w-xs text-sm leading-relaxed text-foreground/50">
        Add pieces to your cart and they will appear here, linked to your account.
      </p>
      <Link
        href="/shop"
        className="label-caps mt-2 border-b border-foreground/30 pb-px text-foreground/60 transition-colors hover:border-couture-red hover:text-couture-red"
      >
        Browse the collection →
      </Link>
    </div>
  );
}

export function CartSection({ cart }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  if (!cart || cart.items.length === 0) return <EmptyCart />;

  return (
    <div ref={ref} className="space-y-0">
      {/* Header */}
      <div className="hidden border-t border-stroke py-3 md:grid md:grid-cols-[5rem_1fr_4rem_5rem_5rem] md:gap-4">
        {["", "Piece", "Qty", "Price", "Total"].map((h) => (
          <span key={h} className="label-caps text-foreground/35">
            {h}
          </span>
        ))}
      </div>

      <div className="divide-y divide-stroke">
        {cart.items.map((item, i) => (
          <motion.article
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, ease, delay: i * 0.06 }}
          >
            {/* Desktop row */}
            <div className="hidden py-5 transition-colors hover:bg-foreground/[0.018] md:grid md:grid-cols-[5rem_1fr_4rem_5rem_5rem] md:items-center md:gap-4">
              {item.imageUrl && item.slug ? (
                <Link href={`/products/${item.slug}`} className="relative block aspect-[4/5] overflow-hidden bg-stone-beige">
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    sizes="5rem"
                    className="object-cover"
                  />
                </Link>
              ) : (
                <div className="aspect-[4/5] w-full bg-stone-beige" />
              )}

              <div className="space-y-0.5">
                {item.slug ? (
                  <Link
                    href={`/products/${item.slug}`}
                    className="font-serif text-lg leading-tight hover:text-couture-red transition-colors"
                  >
                    {item.title}
                  </Link>
                ) : (
                  <p className="font-serif text-lg leading-tight">{item.title}</p>
                )}
                {item.materialLine && (
                  <p className="text-xs text-foreground/45">{item.materialLine}</p>
                )}
                {item.sku && (
                  <p className="label-mono text-foreground/30">{item.sku}</p>
                )}
              </div>

              <span className="label-caps text-foreground/55">{item.quantity}</span>
              <span className="label-mono text-sm text-foreground/60">{item.price}</span>
              <span className="label-mono text-sm">{item.total}</span>
            </div>

            {/* Mobile card */}
            <div className="flex gap-4 py-5 md:hidden">
              {item.imageUrl && item.slug ? (
                <Link href={`/products/${item.slug}`} className="relative block aspect-[4/5] w-16 shrink-0 overflow-hidden bg-stone-beige">
                  <Image src={item.imageUrl} alt={item.title} fill sizes="4rem" className="object-cover" />
                </Link>
              ) : (
                <div className="aspect-[4/5] w-16 shrink-0 bg-stone-beige" />
              )}
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <p className="font-serif text-base leading-snug">{item.title}</p>
                  {item.materialLine && (
                    <p className="mt-0.5 text-xs text-foreground/45">{item.materialLine}</p>
                  )}
                </div>
                <div className="flex items-end justify-between">
                  <span className="label-caps text-foreground/40">× {item.quantity}</span>
                  <span className="label-mono text-sm">{item.total}</span>
                </div>
              </div>
            </div>
          </motion.article>
        ))}
      </div>

      {/* Subtotal + CTA */}
      <motion.div
        className="flex flex-col gap-5 border-t border-stroke pt-6 sm:flex-row sm:items-center sm:justify-between"
        initial={{ opacity: 0, y: 8 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, ease, delay: cart.items.length * 0.06 + 0.1 }}
      >
        <div className="space-y-1">
          <p className="label-caps text-foreground/40">Subtotal</p>
          <p className="font-serif text-2xl">{cart.subtotal}</p>
          <p className="text-xs text-foreground/40">Shipping calculated at checkout</p>
        </div>

        <ArtifactLink href="/checkout" size="md" showArrow>
          Proceed to checkout
        </ArtifactLink>
      </motion.div>
    </div>
  );
}
