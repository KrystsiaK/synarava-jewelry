/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";

import { getShopFilterData, listShopProducts } from "@/lib/content/catalog";

export const metadata: Metadata = {
  title: "Shop | Synarava",
  description: "Browse all Synarava products with search and filtering.",
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

  return (
    <main className="artifact-shell min-h-screen pb-24 pt-28">
      <div className="site-shell">
        <section className="mb-20">
          <p className="mb-4 font-mono text-[0.82rem] uppercase tracking-[0.14em] text-couture-red">
            Shop
          </p>
          <h1 className="mb-6 font-serif text-[4rem] md:text-[5.5rem]">All Products</h1>
          <p className="max-w-2xl text-lg leading-8 text-foreground/70">
            Search directly, browse by category, or narrow the archive by collection and material
            tag. This page is the practical storefront layer of Synarava.
          </p>
        </section>

        <div className="grid grid-cols-12 gap-8">
          <aside className="col-span-12 md:col-span-3 xl:col-span-2">
            <form className="panel sticky top-32 space-y-8 p-6">
              <div>
                <label htmlFor="q" className="label-caps mb-3 block text-muted">
                  Search
                </label>
                <input
                  id="q"
                  name="q"
                  defaultValue={filters.q ?? ""}
                  placeholder="Search pieces, materials..."
                  className="w-full border border-stroke bg-transparent px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
                />
              </div>

              <div>
                <label htmlFor="category" className="label-caps mb-3 block text-muted">
                  Category
                </label>
                <select
                  id="category"
                  name="category"
                  defaultValue={filters.category ?? ""}
                  className="w-full border border-stroke bg-transparent px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="collection" className="label-caps mb-3 block text-muted">
                  Collection
                </label>
                <select
                  id="collection"
                  name="collection"
                  defaultValue={filters.collection ?? ""}
                  className="w-full border border-stroke bg-transparent px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
                >
                  <option value="">All collections</option>
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.slug}>
                      {collection.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="tag" className="label-caps mb-3 block text-muted">
                  Tag
                </label>
                <select
                  id="tag"
                  name="tag"
                  defaultValue={filters.tag ?? ""}
                  className="w-full border border-stroke bg-transparent px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
                >
                  <option value="">All tags</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.slug}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-charcoal px-4 py-3 label-caps text-white transition-colors hover:bg-couture-red"
                >
                  Apply
                </button>
                <Link
                  href="/shop"
                  className="flex-1 border border-stroke px-4 py-3 text-center label-caps transition-colors hover:border-accent hover:text-accent"
                >
                  Reset
                </Link>
              </div>
            </form>
          </aside>

          <section className="col-span-12 md:col-span-9 xl:col-span-10">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-stroke pb-4">
              <p className="text-sm text-foreground/60">
                {products.length} {products.length === 1 ? "piece" : "pieces"} found
              </p>
              <div className="flex flex-wrap gap-3 text-sm text-foreground/60">
                {filters.q ? <span>Search: {filters.q}</span> : null}
                {filters.category ? <span>Category: {filters.category}</span> : null}
                {filters.collection ? <span>Collection: {filters.collection}</span> : null}
                {filters.tag ? <span>Tag: {filters.tag}</span> : null}
              </div>
            </div>

            {products.length === 0 ? (
              <div className="panel p-10">
                <h2 className="font-serif text-[2rem]">No pieces matched that filter.</h2>
                <p className="mt-4 max-w-xl text-base leading-8 text-foreground/65">
                  Try a broader search term or clear one of the filters. Categories, collections,
                  and tags are all managed from the admin layer, so this result reflects real
                  storefront data.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-x-6 gap-y-16 md:grid-cols-2 xl:grid-cols-3">
                {products.map((product, index) => (
                  <Link
                    key={product.slug}
                    href={`/products/${product.slug}`}
                    className={`group ${index % 3 === 1 ? "xl:mt-16" : ""}`}
                  >
                    <div className="mb-6 aspect-[3/4] overflow-hidden bg-stone-beige">
                      <img
                        alt={product.title}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        src={product.image}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className="mb-2 block font-mono text-[0.82rem] uppercase tracking-[0.14em] text-foreground/60">
                            {product.series}
                          </span>
                          <h2 className="font-serif text-[1.6rem]">{product.title}</h2>
                        </div>
                        <span className="pt-2 font-mono text-[0.82rem] uppercase tracking-[0.14em]">
                          {product.price}
                        </span>
                      </div>

                      <p className="max-w-md text-base leading-8 text-foreground/60">
                        {product.shortDescription}
                      </p>

                      <div className="flex flex-wrap gap-2 pt-1">
                        {product.categoryName ? (
                          <span className="border border-stroke px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-foreground/60">
                            {product.categoryName}
                          </span>
                        ) : null}
                        {product.tagNames.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="border border-stroke px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-foreground/60"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
