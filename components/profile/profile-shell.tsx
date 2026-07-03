"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence, useInView } from "motion/react";

import { OrdersTable } from "./orders-table";
import { CartSection } from "./cart-section";
import { AddressSection } from "./address-section";
import { SettingsSection } from "./settings-section";

const ease = [0.22, 1, 0.36, 1] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type ProfileUser = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  createdAt: Date | string;
};

type Summary = {
  user: ProfileUser;
  orderCount: number;
  totalSpent: string;
  cartItemCount: number;
};

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
} | null;

type AddressRecord = {
  id: string;
  type: string;
  firstName: string;
  lastName: string;
  company: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  countryCode: string;
  phone: string | null;
};

type AddressProfile = {
  id: string;
  defaultAddressId: string | null;
  phone: string | null;
  addresses: AddressRecord[];
  defaultAddress: AddressRecord | null;
} | null;

type ProfileShellProps = {
  summary: Summary;
  orders: Order[];
  cart: Cart;
  addressProfile: AddressProfile;
  sessionCount: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string | null, email: string) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function memberSince(date: Date | string) {
  return new Date(date).toLocaleDateString("en-IE", {
    month: "long",
    year: "numeric",
  });
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview" as const, label: "Overview" },
  { id: "orders" as const, label: "Orders" },
  { id: "cart" as const, label: "Cart" },
  { id: "addresses" as const, label: "Addresses" },
  { id: "security" as const, label: "Security" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── Stat Box ────────────────────────────────────────────────────────────────

function StatBox({
  label,
  value,
  delay,
}: {
  label: string;
  value: string | number;
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 14 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease, delay }}
      className="relative border border-stroke p-5"
    >
      <p className="label-caps mb-2 text-foreground/35">{label}</p>
      <p className="font-serif text-2xl leading-none">{value}</p>
    </motion.div>
  );
}

// ─── Overview section (inline) ────────────────────────────────────────────────

function OverviewSection({
  summary,
  orders,
  onTabChange,
}: {
  summary: Summary;
  orders: Order[];
  onTabChange: (tab: TabId) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  return (
    <div ref={ref} className="space-y-10">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatBox label="Paid orders" value={summary.orderCount} delay={0} />
        <StatBox label="Total spent" value={summary.totalSpent} delay={0.06} />
        <StatBox
          label="Cart items"
          value={summary.cartItemCount}
          delay={0.12}
        />
      </div>

      {/* Recent orders */}
      {orders.length > 0 && (
        <div className="space-y-5">
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex items-center justify-between"
          >
            <h3 className="font-serif text-xl">Recent orders</h3>
            <button
              onClick={() => onTabChange("orders")}
              className="label-caps border-b border-foreground/25 pb-px text-foreground/45 transition-colors hover:border-couture-red hover:text-couture-red"
            >
              View all →
            </button>
          </motion.div>
          <OrdersTable orders={orders} compact />
        </div>
      )}

      {orders.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease, delay: 0.2 }}
          className="flex flex-col items-start gap-3 border border-stroke px-8 py-10"
        >
          <p className="font-serif text-xl">No purchases yet.</p>
          <p className="text-sm text-foreground/45">
            Once you complete an order it will appear here.
          </p>
        </motion.div>
      )}
    </div>
  );
}

// ─── Profile Shell ────────────────────────────────────────────────────────────

export function ProfileShell({
  summary,
  orders,
  cart,
  addressProfile,
  sessionCount,
}: ProfileShellProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const headerRef = useRef<HTMLDivElement>(null);
  const isHeaderInView = useInView(headerRef, { once: true });

  const initials = getInitials(summary.user.name, summary.user.email);

  const tabBadges: Partial<Record<TabId, number>> = {
    orders: summary.orderCount > 0 ? summary.orderCount : undefined,
    cart: summary.cartItemCount > 0 ? summary.cartItemCount : undefined,
  };

  return (
    <main className="relative min-h-screen">
      {/* Subtle background word mark */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 select-none overflow-hidden"
      >
        <span
          className="block font-serif leading-none text-wordmark-fade"
          style={{ fontSize: "clamp(8rem, 18vw, 22rem)", opacity: 0.4 }}
        >
          Synarava
        </span>
      </div>

      <div className="relative mx-auto max-w-[90rem] px-5 pb-24 pt-16 md:px-10 md:pt-24 lg:px-16">
        {/* ── Profile Header ── */}
        <div ref={headerRef} className="relative mb-12 overflow-hidden border border-stroke p-8 md:p-12">
          <motion.div
            className="absolute left-0 top-0 w-0.5 bg-couture-red"
            initial={{ height: 0 }}
            animate={isHeaderInView ? { height: "100%" } : {}}
            transition={{ duration: 1.2, ease, delay: 0.2 }}
          />

          <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
            {/* Avatar */}
            <motion.div
              initial={{ opacity: 0, scale: 0.88 }}
              animate={isHeaderInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.6, ease, delay: 0.1 }}
              className="flex h-16 w-16 shrink-0 items-center justify-center bg-couture-red/90 md:h-20 md:w-20"
              aria-hidden
            >
              <span className="font-serif text-xl text-linen md:text-2xl">{initials}</span>
            </motion.div>

            {/* Name + meta */}
            <div className="flex-1 space-y-3">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={isHeaderInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.7, ease, delay: 0.15 }}
              >
                <h1 className="font-serif" style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)" }}>
                  {summary.user.name ?? summary.user.email.split("@")[0]}
                </h1>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={isHeaderInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-wrap items-center gap-x-4 gap-y-1"
              >
                <span className="label-mono text-foreground/45">{summary.user.email}</span>
                <span className="h-3 w-px bg-foreground/15" aria-hidden />
                <span className="label-caps text-foreground/35">
                  Member since {memberSince(summary.user.createdAt)}
                </span>
              </motion.div>
            </div>
          </div>
        </div>

        {/* ── Tab navigation ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="mb-10 overflow-x-auto"
        >
          <div className="relative flex min-w-max gap-0 border-b border-stroke">
            {TABS.map((tab) => {
              const badge = tabBadges[tab.id];
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative flex items-center gap-2 px-4 py-3.5 text-sm transition-colors md:px-6 ${
                    isActive
                      ? "text-foreground"
                      : "text-foreground/40 hover:text-foreground/70"
                  }`}
                >
                  <span className="label-caps">{tab.label}</span>

                  {badge !== undefined && (
                    <span
                      className={`inline-flex h-4 min-w-4 items-center justify-center rounded-none px-1 text-[0.62rem] font-semibold transition-colors ${
                        isActive
                          ? "bg-couture-red text-linen"
                          : "bg-foreground/10 text-foreground/50"
                      }`}
                    >
                      {badge}
                    </span>
                  )}

                  {isActive && (
                    <motion.div
                      layoutId="tab-underline"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-couture-red"
                      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* ── Tab content ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.38, ease }}
          >
            {activeTab === "overview" && (
              <OverviewSection
                summary={summary}
                orders={orders}
                onTabChange={setActiveTab}
              />
            )}

            {activeTab === "orders" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-2xl">Order history</h2>
                  <span className="label-caps text-foreground/35">
                    {orders.length} {orders.length === 1 ? "order" : "orders"}
                  </span>
                </div>
                <OrdersTable orders={orders} />
              </div>
            )}

            {activeTab === "cart" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-2xl">Current cart</h2>
                  {cart && (
                    <span className="label-caps text-foreground/35">
                      {cart.itemCount} {cart.itemCount === 1 ? "piece" : "pieces"}
                    </span>
                  )}
                </div>
                <CartSection cart={cart} />
              </div>
            )}

            {activeTab === "addresses" && (
              <div className="space-y-6">
                <h2 className="font-serif text-2xl">Saved addresses</h2>
                <AddressSection addressProfile={addressProfile} />
              </div>
            )}

            {activeTab === "security" && (
              <div className="space-y-6">
                <h2 className="font-serif text-2xl">Account &amp; security</h2>
                <SettingsSection
                  userName={summary.user.name}
                  sessionCount={sessionCount}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}
