"use client";

import Image from "next/image";
import Link from "next/link";

import type { ShopListingProduct } from "@/lib/content/shop-listing";
import { useTranslations } from "@/lib/i18n/context";
import { localePath } from "@/lib/i18n/routing";
import { buildSearchParams, type ShopFilters } from "./types";

export type ShopProductTypeTile = {
  slug: string;
  name: string;
  image: string;
  count: number;
};

function DiscoveryProductCard({ product }: { product: ShopListingProduct }) {
  const { locale } = useTranslations();

  return (
    <Link
      href={localePath(locale, `/products/${product.slug}`)}
      className="group block w-[min(76vw,19rem)] shrink-0 snap-start md:w-[21rem]"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-stone-beige">
        <Image
          src={product.image}
          alt={product.title}
          fill
          sizes="(max-width: 767px) 76vw, 336px"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035]"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-5 pb-5 pt-16 text-white">
          <p className="font-serif text-2xl leading-tight">{product.title}</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/75">
            {product.price}
          </p>
        </div>
      </div>
    </Link>
  );
}

export function ShopDiscovery({
  newestProducts,
  popularProducts,
  showPopular = true,
  productTypes,
  onSelectFilters,
}: {
  newestProducts: ShopListingProduct[];
  popularProducts: ShopListingProduct[];
  showPopular?: boolean;
  productTypes: ShopProductTypeTile[];
  onSelectFilters?: (filters: ShopFilters) => void;
}) {
  const { t, plural, locale } = useTranslations();

  const filterHref = (filters: ShopFilters) => {
    const query = buildSearchParams(filters);
    return `${localePath(locale, query ? `/shop?${query}` : "/shop")}#shop-products`;
  };
  const selectFilters = (event: React.MouseEvent<HTMLAnchorElement>, filters: ShopFilters) => {
    if (!onSelectFilters) return;
    event.preventDefault();
    onSelectFilters(filters);
  };

  const sections = [
    {
      key: "new",
      title: t("shop.discovery.newTitle"),
      description: t("shop.discovery.newDescription"),
      products: newestProducts,
      filters: { sort: "newest" as const },
    },
    {
      key: "popular",
      title: t("shop.discovery.popularTitle"),
      description: t("shop.discovery.popularDescription"),
      products: popularProducts,
      filters: { sort: "popular" as const },
    },
  ].filter((section) => section.key !== "popular" || showPopular);

  return (
    <div data-component="ShopDiscovery" className="border-b border-foreground/[0.08] bg-background py-16 md:py-24">
      <div className="site-shell space-y-20 md:space-y-28">
        {sections.map((section) => (
          <section key={section.key} aria-labelledby={`shop-${section.key}-title`}>
            <div className="mb-7 flex items-end justify-between gap-6 border-b border-foreground/[0.1] pb-5 md:mb-9">
              <div>
                <h2
                  id={`shop-${section.key}-title`}
                  className="font-serif text-[clamp(2.2rem,5vw,4.5rem)] leading-[0.95] tracking-[-0.03em]"
                >
                  {section.title}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted md:text-base">
                  {section.description}
                </p>
              </div>
              <Link
                href={filterHref(section.filters)}
                onClick={(event) => selectFilters(event, section.filters)}
                aria-label={t("shop.discovery.viewAllLabel", { section: section.title })}
                className="shrink-0 border-b border-foreground/25 pb-1 text-xs font-semibold uppercase tracking-[0.16em] transition-colors hover:border-couture-red hover:text-couture-red"
              >
                {t("shop.discovery.viewAll")}
              </Link>
            </div>
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 md:gap-6">
              {section.products.slice(0, 8).map((product) => (
                <DiscoveryProductCard key={product.slug} product={product} />
              ))}
            </div>
          </section>
        ))}

        <section aria-labelledby="shop-product-type-title">
          <div className="mb-7 max-w-2xl md:mb-9">
            <h2
              id="shop-product-type-title"
              className="font-serif text-[clamp(2.2rem,5vw,4.5rem)] leading-[0.95] tracking-[-0.03em]"
            >
              {t("shop.discovery.productTypeTitle")}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted md:text-base">
              {t("shop.discovery.productTypeDescription")}
            </p>
          </div>
          <div className="grid gap-px overflow-hidden border border-foreground/[0.1] bg-foreground/[0.1] sm:grid-cols-2 lg:grid-cols-4">
            {productTypes.map((productType) => {
              const filters = { productType: productType.slug };
              return (
                <Link
                  key={productType.slug}
                  href={filterHref(filters)}
                  onClick={(event) => selectFilters(event, filters)}
                  aria-label={t("shop.discovery.shopProductType", { productType: productType.name })}
                  className="group relative flex min-h-72 items-end overflow-hidden bg-stone-beige p-5"
                >
                  <Image
                    src={productType.image}
                    alt=""
                    fill
                    sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" aria-hidden="true" />
                  <div className="relative z-10 text-white">
                    <h3 className="font-serif text-3xl leading-none">{productType.name}</h3>
                    <p className="mt-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/70">
                      {plural("shop.filters.productCount", productType.count)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
