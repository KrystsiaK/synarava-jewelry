/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";

import { FilterBar } from "@/components/shop";
import { getShopFilterData, listShopProducts } from "@/lib/content/catalog";

export const metadata: Metadata = {
  title: "Shop | Synarava",
  description: "Browse all Synarava products.",
};

type Props = {
  searchParams?: Promise<{
    q?: string;
    category?: string;
    tag?: string;
    collection?: string;
  }>;
};

export default async function ShopPage({ searchParams }: Props) {
  const filters = (await searchParams) ?? {};
  const { categories, tags, collections } = await getShopFilterData();
  const products = await listShopProducts(filters);

  const categoryOptions = categories.map((c) => ({ value: c.slug, label: c.name }));
  const collectionOptions = collections.map((c) => ({ value: c.slug, label: c.name }));
  const tagOptions = tags.map((t) => ({ value: t.slug, label: t.name }));

  return (
    <main className="artifact-shell min-h-screen pb-16 pt-24 md:pb-24 md:pt-28">
      <div className="site-shell">
        {/* Header */}
        <section className="mb-10 md:mb-14">
          <p className="mb-3 font-mono text-[0.82rem] uppercase tracking-[0.14em] text-couture-red md:mb-4">
            Archive
          </p>
          <h1 className="mb-4 font-serif text-[2.6rem] leading-none sm:text-[3.5rem] md:mb-5 md:text-[5.5rem]">
            Curated Archive
          </h1>
          <p className="max-w-2xl text-base leading-7 text-foreground/70 md:text-lg md:leading-8">
            Each piece in our catalogue is a dialogue between the tactile history of Belarusian
            soil and the refined precision of modern couture.
          </p>
        </section>

        {/* Horizontal filter bar */}
        <div className="mb-8 md:mb-10">
          <FilterBar
            categories={categoryOptions}
            collections={collectionOptions}
            tags={tagOptions}
            initialFilters={filters}
            totalCount={products.length}
          />
        </div>

        {/* Product grid */}
        {products.length === 0 ? (
          <div className="panel p-8 md:p-12">
            <h2 className="font-serif text-[1.8rem] md:text-[2.2rem]">No pieces matched.</h2>
            <p className="mt-4 max-w-xl text-base leading-8 text-foreground/65">
              Try a broader search or clear one of the filters.
            </p>
            <Link
              href="/shop"
              className="mt-6 inline-flex items-center justify-center border border-stroke px-6 py-3 label-caps transition-colors hover:border-accent hover:text-accent"
            >
              Clear all filters
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-12 md:gap-x-6 md:gap-y-20 lg:grid-cols-3">
            {products.map((product, index) => {
              const isFeature = index === 0;
              return (
                <Link
                  key={product.slug}
                  href={`/products/${product.slug}`}
                  className={cn(
                    "group",
                    isFeature && "col-span-2 lg:col-span-2",
                    index === 2 && "lg:mt-16",
                    index === 3 && "lg:-mt-16",
                  )}
                >
                  <div
                    className={cn(
                      "mb-4 overflow-hidden bg-stone-beige md:mb-6",
                      isFeature ? "aspect-[16/9]" : "aspect-[3/4]",
                    )}
                  >
                    <img
                      alt={product.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      src={product.image}
                    />
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="mb-1 block font-mono text-[0.75rem] uppercase tracking-[0.14em] text-foreground/60">
                        {product.series}
                      </span>
                      <h2 className={cn("font-serif", isFeature ? "text-[1.4rem] md:text-[1.8rem]" : "text-[1.1rem] md:text-[1.4rem]")}>
                        {product.title}
                      </h2>
                      {isFeature && (
                        <p className="mt-2 hidden max-w-md text-base leading-7 text-foreground/60 md:block">
                          {product.shortDescription}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 pt-1 font-mono text-[0.75rem] uppercase tracking-[0.12em] md:text-[0.82rem]">
                      {product.price}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {product.categoryName && (
                      <span className="border border-stroke px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-foreground/60">
                        {product.categoryName}
                      </span>
                    )}
                    {product.tagNames.slice(0, 2).map((tag) => (
                      <span key={tag} className="border border-stroke px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-foreground/60">
                        {tag}
                      </span>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
