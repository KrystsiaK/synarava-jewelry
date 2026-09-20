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
import { localeTag } from "@/lib/i18n/format";
import { localePath } from "@/lib/i18n/routing";
import type { Locale } from "@/lib/i18n/locales";
import { ReturnRequestPanel } from "@/components/profile/return-request-panel";
import { ArtifactLink } from "@/components/ui";

const tabs = ["overview", "wishlist", "orders", "addresses", "security"] as const;
type Tab = (typeof tabs)[number];

function tabHref(tab: Tab, locale: Locale) {
  return tab === "overview" ? localePath(locale, "/profile") : localePath(locale, `/profile?section=${tab}`);
}

// REV-23: this used to always return English regardless of locale, and the
// caller formatted money/dates with a hardcoded en-IE Intl locale tag.
function sessionExpiryLabel(sessionExpiresAt: string, t: (key: string, values?: Record<string, string | number>) => string) {
  const days = Math.max(
    0,
    Math.ceil((new Date(sessionExpiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );
  if (days === 0) return t("profile.security.renewsNextSignIn");
  if (days === 1) return t("profile.security.expiresInOneDay");
  return t("profile.security.expiresInDays", { days });
}

function money(amount: string, currency: string, locale: Locale) {
  return new Intl.NumberFormat(localeTag(locale), {
    style: "currency",
    currency,
  }).format(Number(amount));
}

function date(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(localeTag(locale), {
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
  const { t, plural, locale } = useTranslations();
  const tabLabels: Record<Tab, string> = {
    overview: t("profile.tabs.overview"),
    wishlist: t("profile.tabs.wishlist"),
    orders: t("profile.tabs.orders"),
    addresses: t("profile.tabs.addresses"),
    security: t("profile.tabs.security"),
  };
  const [wishlist, setWishlist] = useState(wishlistProducts);
  // REV-13: the profile query only fetches the 50 most recent orders — orders
  // beyond that page are loaded on demand instead of being silently absent.
  const [orders, setOrders] = useState(customer.orders.nodes);
  const [ordersPageInfo, setOrdersPageInfo] = useState(customer.orders.pageInfo);
  const [isLoadingMoreOrders, setIsLoadingMoreOrders] = useState(false);
  const [loadMoreOrdersError, setLoadMoreOrdersError] = useState<string | null>(null);
  const email = customer.emailAddress?.emailAddress ?? t("profile.noEmail");
  // Summed per currency rather than blindly added together (mixed-currency
  // orders would otherwise read as one nonsensical total), and net of
  // totalRefunded so a refunded/cancelled order doesn't inflate the figure —
  // totalPrice alone only nets out formally *returned* line items (REV-14).
  const spendByCurrency = orders.reduce<Record<string, number>>((totals, order) => {
    const net = Number(order.totalPrice.amount) - Number(order.totalRefunded.amount);
    const currencyCode = order.totalPrice.currencyCode;
    totals[currencyCode] = (totals[currencyCode] ?? 0) + net;
    return totals;
  }, {});
  const totalSpentLabel = Object.entries(spendByCurrency)
    .map(([currencyCode, amount]) => money(String(amount), currencyCode, locale))
    .join(" + ") || money("0", "EUR", locale);
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
        errorCode?: "requires_login" | "invalid_cursor" | "upstream_failed";
      };
      if (!response.ok || !payload.ok || !payload.nodes || !payload.pageInfo) {
        // A stable errorCode (REV-23) drives the translated message, rather than
        // this route's own English `error` text leaking onto a PT page.
        throw new Error(
          payload.errorCode === "requires_login" ? t("profile.orders.requiresLogin") : t("profile.orders.loadMoreFailed"),
        );
      }
      setOrders((current) => [...current, ...payload.nodes!]);
      setOrdersPageInfo(payload.pageInfo);
    } catch (error) {
      setLoadMoreOrdersError(error instanceof Error ? error.message : t("profile.orders.loadMoreFailed"));
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
              <p className="label-caps mb-2 text-foreground/35">{t("profile.customerAccount")}</p>
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
                {t("profile.signOut")}
              </button>
            </form>
          </div>
        </section>

        <nav aria-label={t("profile.sectionsAriaLabel")} className="mb-10 overflow-x-auto border-b border-stroke">
          <div className="flex min-w-max" role="tablist" aria-label={t("profile.sectionsAriaLabel")}>
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
                    [t("profile.overview.orders"), ordersCountLabel],
                    [t("profile.overview.totalSpent"), totalSpentLabel],
                    [t("profile.overview.memberSince"), date(customer.creationDate, locale)],
                  ].map(([label, value]) => (
                    <div key={label} className="border border-stroke p-6">
                      <p className="label-caps mb-3 text-foreground/35">{label}</p>
                      <p className="font-serif text-xl">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <ArtifactLink href={tabHref("orders", locale)} size="md">
                    {t("profile.overview.viewOrders")}
                  </ArtifactLink>
                  <Link href={localePath(locale, "/cart")} className="label-caps border border-stroke px-6 py-4 hover:border-foreground/50">
                    {t("profile.overview.currentCart")}
                  </Link>
                </div>
              </div>
            ) : null}

            {activeTab === "wishlist" ? (
              <div className="space-y-5">
                <div className="flex items-end justify-between">
                  <h2 className="font-serif text-2xl">{t("profile.wishlist.title")}</h2>
                  <span className="label-caps text-foreground/35">{plural("profile.wishlist.saved", wishlist.length)}</span>
                </div>
                {wishlist.length === 0 ? (
                  <div className="border border-stroke p-8">
                    <p className="font-serif text-xl">{t("profile.wishlist.empty")}</p>
                    <Link href={localePath(locale, "/shop")} className="label-caps mt-5 inline-block text-couture-red">{t("profile.wishlist.exploreShop")}</Link>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {wishlist.map((product) => (
                      <div key={product.slug} className="group relative border border-stroke p-4">
                        <button
                          type="button"
                          onClick={() => removeFromWishlist(product.slug)}
                          aria-label={t("profile.wishlist.removeAria", { title: product.title })}
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
                  <h2 className="font-serif text-2xl">{t("profile.orders.title")}</h2>
                  <span className="label-caps text-foreground/35">{ordersCountLabel} {t("profile.orders.countLabel")}</span>
                </div>
                {orders.length === 0 ? (
                  <div className="border border-stroke p-8">
                    <p className="font-serif text-xl">{t("profile.orders.empty")}</p>
                    <Link href={localePath(locale, "/shop")} className="label-caps mt-5 inline-block text-couture-red">{t("profile.wishlist.exploreShop")}</Link>
                  </div>
                ) : (
                  orders.map((order) => (
                    <article key={order.id} className="border border-stroke p-5 md:p-7">
                      <div className="flex flex-col gap-4 border-b border-stroke pb-5 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-serif text-xl">{order.name}</p>
                          <p className="mt-1 text-sm text-foreground/45">{date(order.processedAt, locale)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="label-caps text-foreground/45">{order.fulfillmentStatus.replaceAll("_", " ")}</span>
                          <strong className="font-serif text-lg">{money(order.totalPrice.amount, order.totalPrice.currencyCode, locale)}</strong>
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
                              <p className="label-caps mt-1 text-foreground/35">{t("profile.orders.qty", { count: item.quantity })}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      {order.lineItems.pageInfo.hasNextPage ? (
                        <p className="mt-3 text-sm text-foreground/45">
                          {t("profile.orders.itemsTruncated", { count: order.lineItems.nodes.length })}
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
                                    {t("profile.orders.trackPackage")}
                                  </a>
                                ) : null}
                              </p>
                            ) : null}
                            {fulfillment.estimatedDeliveryAt ? (
                              <p className="mt-1">{t("profile.orders.estimatedDelivery", { date: date(fulfillment.estimatedDeliveryAt, locale) })}</p>
                            ) : null}
                          </div>
                        );
                      })}
                      {order.fulfillments.pageInfo.hasNextPage ? (
                        <p className="mt-3 text-sm text-foreground/45">
                          {t("profile.orders.shipmentsTruncated")}
                        </p>
                      ) : null}
                      <ReturnRequestPanel
                        orderId={order.id}
                        returnableLineItems={order.returnInformation.returnableLineItems.nodes}
                      />
                      {order.returnInformation.returnableLineItems.pageInfo.hasNextPage ? (
                        <p className="mt-2 text-sm text-foreground/45">
                          {t("profile.orders.returnableTruncated", { count: order.returnInformation.returnableLineItems.nodes.length })}
                        </p>
                      ) : null}
                      <a href={order.statusPageUrl} className="label-caps mt-6 inline-block text-couture-red">
                        {t("profile.orders.orderDetails")}
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
                      {isLoadingMoreOrders ? t("profile.orders.loading") : t("profile.orders.loadMore")}
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
                  <h2 className="font-serif text-2xl">{t("profile.addresses.title")}</h2>
                  {customer.addresses.pageInfo.hasNextPage ? (
                    <span className="label-caps text-foreground/35">{t("profile.addresses.showingFirst", { count: customer.addresses.nodes.length })}</span>
                  ) : null}
                </div>
                {customer.addresses.nodes.length === 0 ? (
                  <div className="border border-stroke p-8 text-foreground/50">{t("profile.addresses.empty")}</div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {customer.addresses.nodes.map((address) => (
                      <address key={address.id} className="not-italic border border-stroke p-6">
                        {address.id === customer.defaultAddress?.id ? <p className="label-caps mb-4 text-couture-red">{t("profile.addresses.default")}</p> : null}
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
                <p className="label-caps mb-3 text-couture-red">{t("profile.security.eyebrow")}</p>
                <h2 className="font-serif text-2xl">{t("profile.security.title")}</h2>
                <p className="mt-4 max-w-2xl leading-7 text-foreground/55">
                  {t("profile.security.body")}
                </p>
                <p className="mt-3 max-w-2xl leading-7 text-foreground/55">
                  {sessionExpiryLabel(sessionExpiresAt, t)}
                </p>
                <form action="/api/auth/shopify/logout" method="get">
                  <button type="submit" className="label-caps mt-7 inline-block border border-stroke px-6 py-4 hover:border-couture-red hover:text-couture-red">
                    {t("profile.security.signOutDevice")}
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
