"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "motion/react";

const ease = [0.22, 1, 0.36, 1] as const;

type OrderItem = {
  id: string;
  title: string;
  quantity: number;
  total: string;
  imageUrl: string | null;
  slug: string | null;
};

type Order = {
  id: string;
  number: number;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  total: string;
  totalCents: number;
  createdAt: Date | string;
  itemCount: number;
  items: OrderItem[];
};

type Props = { orders: Order[]; compact?: boolean };

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-IE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const PAYMENT_BADGE: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pending", cls: "text-foreground/40 bg-foreground/5" },
  AUTHORIZED: { label: "Authorized", cls: "text-accent-soft bg-accent-soft/10" },
  PAID: { label: "Paid", cls: "text-foreground/80 bg-foreground/8" },
  REFUNDED: { label: "Refunded", cls: "text-accent-soft bg-accent-soft/10" },
  FAILED: { label: "Failed", cls: "text-couture-red bg-couture-red/10" },
};

const FULFILLMENT_BADGE: Record<string, { label: string; cls: string }> = {
  UNFULFILLED: { label: "Unfulfilled", cls: "text-foreground/40" },
  PARTIALLY_FULFILLED: { label: "Partial", cls: "text-accent-soft" },
  FULFILLED: { label: "Fulfilled", cls: "text-foreground/70" },
  RETURNED: { label: "Returned", cls: "text-couture-red/70" },
};

function StatusBadge({ map, value }: { map: Record<string, { label: string; cls: string }>; value: string }) {
  const cfg = map[value] ?? { label: value, cls: "text-foreground/40" };
  return (
    <span className={`label-caps inline-flex items-center gap-1.5 rounded-none px-2 py-0.5 ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function EmptyOrders() {
  return (
    <div className="flex flex-col items-start gap-4 border border-stroke px-8 py-12">
      <div className="flex items-center gap-4">
        <div className="h-px w-8 bg-foreground/15" />
        <div className="h-1.5 w-1.5 rotate-45 border border-couture-red/40" />
        <div className="h-px w-8 bg-foreground/15" />
      </div>
      <p className="font-serif text-2xl">No orders yet.</p>
      <p className="max-w-xs text-sm leading-relaxed text-foreground/50">
        Once you complete a purchase, your order history will appear here.
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

export function OrdersTable({ orders, compact = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  const list = compact ? orders.slice(0, 3) : orders;

  if (orders.length === 0) return <EmptyOrders />;

  return (
    <div ref={ref}>
      {/* Desktop table header */}
      <div className="hidden border-t border-stroke py-3 md:grid md:grid-cols-[2rem_1fr_5rem_7rem_8rem_6rem] md:gap-4">
        {["#", "Date", "Items", "Payment", "Fulfillment", "Total"].map((h) => (
          <span key={h} className="label-caps text-foreground/35">
            {h}
          </span>
        ))}
      </div>

      <div className="divide-y divide-stroke">
        {list.map((order, i) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, ease, delay: i * 0.055 }}
          >
            {/* Desktop row */}
            <div className="hidden py-4 transition-colors hover:bg-foreground/[0.018] md:grid md:grid-cols-[2rem_1fr_5rem_7rem_8rem_6rem] md:items-center md:gap-4">
              <span className="label-mono text-foreground/35">#{order.number}</span>
              <span className="text-sm text-foreground/70">{formatDate(order.createdAt)}</span>
              <span className="text-sm text-foreground/60">
                {order.itemCount} {order.itemCount === 1 ? "piece" : "pieces"}
              </span>
              <StatusBadge map={PAYMENT_BADGE} value={order.paymentStatus} />
              <StatusBadge map={FULFILLMENT_BADGE} value={order.fulfillmentStatus} />
              <span className="label-mono text-right text-sm">{order.total}</span>
            </div>

            {/* Mobile card */}
            <div className="py-5 md:hidden">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="label-mono text-foreground/40">#{order.number}</span>
                    <StatusBadge map={PAYMENT_BADGE} value={order.paymentStatus} />
                  </div>
                  <p className="text-sm text-foreground/60">{formatDate(order.createdAt)}</p>
                  <p className="text-xs text-foreground/40">
                    {order.itemCount} {order.itemCount === 1 ? "piece" : "pieces"} ·{" "}
                    <span className={FULFILLMENT_BADGE[order.fulfillmentStatus]?.cls ?? ""}>
                      {FULFILLMENT_BADGE[order.fulfillmentStatus]?.label ?? order.fulfillmentStatus}
                    </span>
                  </p>
                </div>
                <span className="label-mono shrink-0 text-sm">{order.total}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {compact && orders.length > 3 && (
        <motion.div
          className="pt-6"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <span className="label-caps border-b border-foreground/25 pb-px text-foreground/50 cursor-pointer hover:border-couture-red hover:text-couture-red transition-colors">
            View all {orders.length} orders →
          </span>
        </motion.div>
      )}
    </div>
  );
}
