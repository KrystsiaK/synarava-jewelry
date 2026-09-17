"use client";

import Image from "next/image";
import Link from "next/link";
import type { KeyboardEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

import type { ShopifyCustomerProfile } from "@/lib/shopify/customer-account/api";
import type { ProductSummary } from "@/lib/content/catalog";
import { useTranslations } from "@/lib/i18n/context";
import { localePath } from "@/lib/i18n/routing";
import type { Locale } from "@/lib/i18n/locales";
import { ReturnRequestPanel } from "@/components/profile/return-request-panel";

const tabs = ["overview", "wishlist", "orders", "addresses", "security"] as const;
type Tab = (typeof tabs)[number];

const tabLabels: Record<Tab, string> = {
  overview: "overview",
  wishlist: "wishlist",
  orders: "orders",
  addresses: "addresses",
  security: "Sign-in & security",
};

function tabHref(tab: Tab, locale: Locale) {
  return tab === "overview" ? localePath(locale, "/profile") : localePath(locale, `/profile?section=${tab}`);
}

function sessionExpiryLabel(sessionExpiresAt: string) {
  const days = Math.max(
    0,
    Math.ceil((new Date(sessionExpiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );
  if (days === 0) return "Your session renews the next time you sign in.";
  if (days === 1) return "You'll be asked to sign in again in 1 day.";
  return `You'll be asked to sign in again in ${days} days, sooner if this device is inactive for 14 days.`;
}

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
  activeTab,
  wishlistProducts,
  sessionExpiresAt,
}: {
  customer: ShopifyCustomerProfile;
  activeTab: Tab;
  wishlistProducts: ProductSummary[];
  sessionExpiresAt: string;
}) {
  const router = useRouter();
  const { locale } = useTranslations();
  const [wishlist, setWishlist] = useState(wishlistProducts);
  // REV-13: the profile query only fetches the 50 most recent orders — orders
  // beyond that page are loaded on demand instead of being silently absent.
  const [orders, setOrders] = useState(customer.orders.nodes);
  const [ordersPageInfo, setOrdersPageInfo] = useState(customer.orders.pageInfo);
  const [isLoadingMoreOrders, setIsLoadingMoreOrders] = useState(false);
  const [loadMoreOrdersError, setLoadMoreOrdersError] = useState<string | null>(null);
  const email = customer.emailAddress?.emailAddress ?? "No email address available";
  const totalSpent = orders.reduce(
    (sum, order) => sum + Number(order.totalPrice.amount),
    0,
  );
  const currency = orders[0]?.totalPrice.currencyCode ?? "EUR";
  const ordersCountLabel = ordersPageInfo.hasNextPage ? `${orders.length}+` : String(orders.length);

  async function loadMoreOrders() {
    if (!ordersPageInfo.endCursor) return;
    setIsLoadingMoreOrders(true);
    setLoadMoreOrdersError(null);
    try {
      const response = await fetch(`/api/profile/orders?after=${encodeURIComponent(ordersPageInfo.endCursor)}`);
      const payload = (await response.json()) as {
        ok: boolean;
        nodes?: typeof orders;
        pageInfo?: typeof ordersPageInfo;
        error?: string;
      };
      if (!response.ok || !payload.ok || !payload.nodes || !payload.pageInfo) {
        throw new Error(payload.error || "Couldn't load more orders.");
      }
      setOrders((current) => [...current, ...payload.nodes!]);
      setOrdersPageInfo(payload.pageInfo);
    } catch (error) {
      setLoadMoreOrdersError(error instanceof Error ? error.message : "Couldn't load more orders.");
    } finally {
      setIsLoadingMoreOrders(false);
    }
  }

  function removeFromWishlist(productSlug: string) {
    setWishlist((current) => current.filter((product) => product.slug !== productSlug));
    fetch("/api/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productSlug }),
    }).catch(() => undefined);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLAnchorElement>, tab: Tab) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = tabs.indexOf(tab);
    const nextTab = event.key === "Home"
      ? tabs[0]
      : event.key === "End"
        ? tabs.at(-1)!
        : tabs[(currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    router.push(tabHref(nextTab, locale), { scroll: false });
  }

  return (
    <main data-component="ShopifyProfileShell" className="relative min-h-screen overflow-hidden">
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
            <div className="flex size-16 shrink-0 items-center justify-center bg-couture-red text-white md:size-20">
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
            <form action="/api/auth/shopify/logout" method="get" className="self-start md:self-center">
              <button
                type="submit"
                className="label-caps border border-stroke px-5 py-3 transition-colors hover:border-couture-red hover:text-couture-red"
              >
                Sign out
              </button>
            </form>
          </div>
        </section>

        <nav aria-label="Account sections" className="mb-10 overflow-x-auto border-b border-stroke">
          <div className="flex min-w-max" role="tablist" aria-label="Account sections">
            {tabs.map((tab) => (
              <Link
                key={tab}
                id={`account-tab-${tab}`}
                href={tabHref(tab, locale)}
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls={`account-panel-${tab}`}
                tabIndex={activeTab === tab ? 0 : -1}
                onKeyDown={(event) => handleTabKeyDown(event, tab)}
                className={`relative px-4 py-4 md:px-7 ${activeTab === tab ? "text-foreground" : "text-foreground/40"}`}
              >
                <span className="label-caps">{tabLabels[tab]}</span>
                {activeTab === tab ? (
                  <motion.span
                    layoutId="shopify-account-tab"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-couture-red"
                  />
                ) : null}
              </Link>
            ))}
          </div>
        </nav>

        <AnimatePresence mode="wait">
          <motion.section
            key={activeTab}
            id={`account-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`account-tab-${activeTab}`}
            tabIndex={0}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === "overview" ? (
              <div className="space-y-10">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Orders", ordersCountLabel],
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
                  <Link href={tabHref("orders", locale)} className="label-caps bg-couture-red px-6 py-4 text-white">
                    View orders
                  </Link>
                  <Link href={localePath(locale, "/cart")} className="label-caps border border-stroke px-6 py-4 hover:border-foreground/50">
                    Current cart
                  </Link>
                </div>
              </div>
            ) : null}

            {activeTab === "wishlist" ? (
              <div className="space-y-5">
                <div className="flex items-end justify-between">
                  <h2 className="font-serif text-2xl">Saved products</h2>
                  <span className="label-caps text-foreground/35">{wishlist.length} saved</span>
                </div>
                {wishlist.length === 0 ? (
                  <div className="border border-stroke p-8">
                    <p className="font-serif text-xl">Nothing saved yet.</p>
                    <Link href={localePath(locale, "/shop")} className="label-caps mt-5 inline-block text-couture-red">Explore the shop →</Link>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {wishlist.map((product) => (
                      <div key={product.slug} className="group relative border border-stroke p-4">
                        <button
                          type="button"
                          onClick={() => removeFromWishlist(product.slug)}
                          aria-label={`Remove ${product.title} from wishlist`}
                          className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center bg-background/85 text-foreground/60 transition-colors hover:text-couture-red"
                        >
                          <X className="size-4" aria-hidden="true" />
                        </button>
                        <Link href={localePath(locale, `/products/${product.slug}`)} className="block">
                          <div className="relative mb-4 aspect-square overflow-hidden bg-foreground/5">
                            {product.image ? (
                              <Image src={product.image} alt={product.title} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
                            ) : null}
                          </div>
                          <p className="truncate font-serif text-lg">{product.title}</p>
                          <p className="mt-1 text-sm text-foreground/50">{product.price}</p>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {activeTab === "orders" ? (
              <div className="space-y-5">
                <div className="flex items-end justify-between">
                  <h2 className="font-serif text-2xl">Order history</h2>
                  <span className="label-caps text-foreground/35">{ordersCountLabel} orders</span>
                </div>
                {orders.length === 0 ? (
                  <div className="border border-stroke p-8">
                    <p className="font-serif text-xl">No purchases yet.</p>
                    <Link href={localePath(locale, "/shop")} className="label-caps mt-5 inline-block text-couture-red">Explore the shop →</Link>
                  </div>
                ) : (
                  orders.map((order) => (
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
                      {order.lineItems.pageInfo.hasNextPage ? (
                        <p className="mt-3 text-sm text-foreground/45">
                          Showing the first {order.lineItems.nodes.length} items — see order details for the full list.
                        </p>
                      ) : null}
                      {order.fulfillments.nodes.map((fulfillment, index) => {
                        const tracking = fulfillment.trackingInformation[0];
                        if (!tracking && !fulfillment.estimatedDeliveryAt) return null;
                        return (
                          <div key={index} className="mt-4 border-t border-stroke pt-4 text-sm text-foreground/60">
                            {fulfillment.latestShipmentStatus ? (
                              <p className="label-caps text-foreground/45">{fulfillment.latestShipmentStatus.replaceAll("_", " ")}</p>
                            ) : null}
                            {tracking?.company || tracking?.number ? (
                              <p className="mt-1">
                                {[tracking.company, tracking.number].filter(Boolean).join(" · ")}
                                {tracking.url ? (
                                  <a href={tracking.url} className="ml-2 text-couture-red underline-offset-4 hover:underline">
                                    Track package →
                                  </a>
                                ) : null}
                              </p>
                            ) : null}
                            {fulfillment.estimatedDeliveryAt ? (
                              <p className="mt-1">Estimated delivery: {date(fulfillment.estimatedDeliveryAt)}</p>
                            ) : null}
                          </div>
                        );
                      })}
                      {order.fulfillments.pageInfo.hasNextPage ? (
                        <p className="mt-3 text-sm text-foreground/45">
                          More shipments than shown here — see order details for the full list.
                        </p>
                      ) : null}
                      <ReturnRequestPanel
                        orderId={order.id}
                        returnableLineItems={order.returnInformation.returnableLineItems.nodes}
                      />
                      {order.returnInformation.returnableLineItems.pageInfo.hasNextPage ? (
                        <p className="mt-2 text-sm text-foreground/45">
                          Only the first {order.returnInformation.returnableLineItems.nodes.length} returnable items are listed above — see order details for the rest.
                        </p>
                      ) : null}
                      <a href={order.statusPageUrl} className="label-caps mt-6 inline-block text-couture-red">
                        Order details →
                      </a>
                    </article>
                  ))
                )}
                {ordersPageInfo.hasNextPage ? (
                  <div className="flex flex-col items-start gap-2">
                    <button
                      type="button"
                      onClick={loadMoreOrders}
                      disabled={isLoadingMoreOrders}
                      className="label-caps border border-stroke px-6 py-4 transition-colors hover:border-foreground/50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isLoadingMoreOrders ? "Loading…" : "Load more orders"}
                    </button>
                    {loadMoreOrdersError ? (
                      <p role="alert" className="text-sm text-couture-red">{loadMoreOrdersError}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeTab === "addresses" ? (
              <div className="space-y-5">
                <div className="flex items-end justify-between">
                  <h2 className="font-serif text-2xl">Saved addresses</h2>
                  {customer.addresses.pageInfo.hasNextPage ? (
                    <span className="label-caps text-foreground/35">Showing the first {customer.addresses.nodes.length}</span>
                  ) : null}
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
                  Sign-in codes are sent to your email and your account is managed entirely by Shopify.
                  No customer password is created or stored by Synarava, and this sign-in is separate
                  from any Google account in your browser.
                </p>
                <p className="mt-3 max-w-2xl leading-7 text-foreground/55">
                  {sessionExpiryLabel(sessionExpiresAt)}
                </p>
                <form action="/api/auth/shopify/logout" method="get">
                  <button type="submit" className="label-caps mt-7 inline-block border border-stroke px-6 py-4 hover:border-couture-red hover:text-couture-red">
                    Sign out on this device
                  </button>
                </form>
              </div>
            ) : null}
          </motion.section>
        </AnimatePresence>
      </div>
    </main>
  );
}
