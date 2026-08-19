"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import type { ShopifyCustomerProfile } from "@/lib/shopify/customer-account/api";

const tabs = ["overview", "orders", "addresses", "security"] as const;
type Tab = (typeof tabs)[number];

function money(amount: string, currency: string) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
  }).format(Number(amount));
}

function date(value: string) {
  return new Intl.DateTimeFormat("en-IE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function ShopifyProfileShell({
  customer,
}: {
  customer: ShopifyCustomerProfile;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const email = customer.emailAddress?.emailAddress ?? "No email address available";
  const totalSpent = customer.orders.nodes.reduce(
    (sum, order) => sum + Number(order.totalPrice.amount),
    0,
  );
  const currency = customer.orders.nodes[0]?.totalPrice.currencyCode ?? "EUR";

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden">
        <span className="block select-none font-serif text-[clamp(8rem,20vw,22rem)] leading-none text-wordmark-fade opacity-40">
          Synarava
        </span>
      </div>

      <div className="relative mx-auto max-w-[90rem] px-5 pb-24 pt-16 md:px-10 md:pt-24 lg:px-16">
        <section className="relative mb-12 overflow-hidden border border-stroke p-8 md:p-12">
          <motion.span
            aria-hidden
            className="absolute bottom-0 left-0 top-0 w-0.5 origin-top bg-couture-red"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-8">
            <div className="flex size-16 shrink-0 items-center justify-center bg-couture-red text-linen md:size-20">
              <span className="font-serif text-xl md:text-2xl">
                {initials(customer.displayName)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="label-caps mb-2 text-foreground/35">Customer account</p>
              <h1 className="truncate font-serif text-[clamp(1.8rem,4vw,3rem)]">
                {customer.displayName}
              </h1>
              <p className="mt-2 truncate text-sm text-foreground/50">{email}</p>
            </div>
            <Link
              href="/api/auth/shopify/logout"
              className="label-caps self-start border border-stroke px-5 py-3 transition-colors hover:border-couture-red hover:text-couture-red md:self-center"
            >
              Sign out
            </Link>
          </div>
        </section>

        <nav aria-label="Account sections" className="mb-10 overflow-x-auto border-b border-stroke">
          <div className="flex min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`relative px-4 py-4 md:px-7 ${activeTab === tab ? "text-foreground" : "text-foreground/40"}`}
              >
                <span className="label-caps capitalize">{tab}</span>
                {activeTab === tab ? (
                  <motion.span
                    layoutId="shopify-account-tab"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-couture-red"
                  />
                ) : null}
              </button>
            ))}
          </div>
        </nav>

        <AnimatePresence mode="wait">
          <motion.section
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === "overview" ? (
              <div className="space-y-10">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Orders", customer.orders.nodes.length],
                    ["Total spent", money(String(totalSpent), currency)],
                    ["Member since", date(customer.creationDate)],
                  ].map(([label, value]) => (
                    <div key={label} className="border border-stroke p-6">
                      <p className="label-caps mb-3 text-foreground/35">{label}</p>
                      <p className="font-serif text-xl">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => setActiveTab("orders")} className="label-caps bg-couture-red px-6 py-4 text-linen">
                    View orders
                  </button>
                  <Link href="/cart" className="label-caps border border-stroke px-6 py-4 hover:border-foreground/50">
                    Current cart
                  </Link>
                </div>
              </div>
            ) : null}

            {activeTab === "orders" ? (
              <div className="space-y-5">
                <div className="flex items-end justify-between">
                  <h2 className="font-serif text-2xl">Order history</h2>
                  <span className="label-caps text-foreground/35">{customer.orders.nodes.length} orders</span>
                </div>
                {customer.orders.nodes.length === 0 ? (
                  <div className="border border-stroke p-8">
                    <p className="font-serif text-xl">No purchases yet.</p>
                    <Link href="/shop" className="label-caps mt-5 inline-block text-couture-red">Explore the shop →</Link>
                  </div>
                ) : (
                  customer.orders.nodes.map((order) => (
                    <article key={order.id} className="border border-stroke p-5 md:p-7">
                      <div className="flex flex-col gap-4 border-b border-stroke pb-5 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-serif text-xl">{order.name}</p>
                          <p className="mt-1 text-sm text-foreground/45">{date(order.processedAt)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="label-caps text-foreground/45">{order.fulfillmentStatus.replaceAll("_", " ")}</span>
                          <strong className="font-serif text-lg">{money(order.totalPrice.amount, order.totalPrice.currencyCode)}</strong>
                        </div>
                      </div>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {order.lineItems.nodes.map((item) => (
                          <div key={item.id} className="flex items-center gap-4">
                            <div className="relative size-16 shrink-0 overflow-hidden bg-foreground/5">
                              {item.image ? <Image src={item.image.url} alt={item.image.altText ?? item.name} fill sizes="64px" className="object-cover" /> : null}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm">{item.name}</p>
                              <p className="label-caps mt-1 text-foreground/35">Qty {item.quantity}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <a href={order.statusPageUrl} className="label-caps mt-6 inline-block text-couture-red">
                        Order details →
                      </a>
                    </article>
                  ))
                )}
              </div>
            ) : null}

            {activeTab === "addresses" ? (
              <div className="space-y-5">
                <div className="flex items-end justify-between">
                  <h2 className="font-serif text-2xl">Saved addresses</h2>
                </div>
                {customer.addresses.nodes.length === 0 ? (
                  <div className="border border-stroke p-8 text-foreground/50">No saved addresses yet. An address can be added during checkout.</div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {customer.addresses.nodes.map((address) => (
                      <address key={address.id} className="not-italic border border-stroke p-6">
                        {address.id === customer.defaultAddress?.id ? <p className="label-caps mb-4 text-couture-red">Default</p> : null}
                        {address.formatted.map((line) => <p key={line} className="leading-7 text-foreground/70">{line}</p>)}
                        {address.phoneNumber ? <p className="mt-3 text-sm text-foreground/45">{address.phoneNumber}</p> : null}
                      </address>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {activeTab === "security" ? (
              <div className="max-w-3xl border border-stroke p-7 md:p-9">
                <p className="label-caps mb-3 text-couture-red">Secure access</p>
                <h2 className="font-serif text-2xl">Passwordless customer account</h2>
                <p className="mt-4 max-w-2xl leading-7 text-foreground/55">
                  Sign-in codes are sent to your email. No customer password is created or stored by Synarava.
                </p>
                <Link href="/api/auth/shopify/logout" className="label-caps mt-7 inline-block border border-stroke px-6 py-4 hover:border-couture-red hover:text-couture-red">
                  Sign out on this device
                </Link>
              </div>
            ) : null}
          </motion.section>
        </AnimatePresence>
      </div>
    </main>
  );
}
