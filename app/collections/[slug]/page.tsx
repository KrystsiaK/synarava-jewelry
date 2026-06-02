/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getCollectionBySlug, getProductsByCollection } from "@/lib/content/catalog";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);

  if (!collection) {
    return {
      title: "Collection | Synarava",
    };
  }

  return {
    title: `${collection.name} | Synarava`,
    description: collection.summary,
  };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);

  if (!collection) {
    notFound();
  }

  const collectionProducts = await getProductsByCollection(slug);

  return (
    <main className="artifact-shell overflow-x-hidden">
      <header className="relative flex h-screen w-full items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            alt={`${collection.name} hero`}
            className="h-full w-full object-cover object-center"
            style={{ filter: "grayscale(20%)" }}
            src={collection.heroImage}
          />
        </div>
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-linen/50 to-transparent" />

        <div className="relative z-20 max-w-4xl px-5 md:px-16">
          <span className="mb-6 block font-mono text-[0.82rem] uppercase tracking-[0.28em] text-couture-red">
            {collection.eyebrow}
          </span>
          <h1 className="mb-8 font-serif text-[4rem] leading-none md:text-[5.5rem]">{collection.name}</h1>
          <p className="max-w-lg text-lg leading-8 text-foreground/70">{collection.summary}</p>
          <div className="mt-12">
            <Link
              href="/shop"
              className="inline-block bg-charcoal px-12 py-5 label-caps text-white transition-all duration-500 hover:bg-couture-red"
            >
              Shop products
            </Link>
          </div>
        </div>
      </header>

      <section className="px-5 py-32 md:px-16">
        <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="relative">
              <img
                alt={`${collection.name} detail`}
                className="aspect-[3/4] w-full object-cover grayscale"
                src={collection.heroImage}
              />
              <div className="absolute -bottom-8 -right-8 flex h-48 w-48 items-center justify-center border border-charcoal/10 bg-stone-beige/30 p-8 backdrop-blur-sm">
                <span className="text-center font-mono text-[0.82rem] uppercase tracking-[0.14em]">
                  {collection.accent}
                  <br />
                  as collection accent
                </span>
              </div>
            </div>
          </div>

          <div className="md:col-span-6 md:col-start-7">
            <span className="mb-4 block font-mono text-[0.82rem] italic uppercase tracking-[0.14em] text-foreground/50">
              Collection story
            </span>
            <h2 className="mb-8 font-serif text-[2.6rem]">A world with a clear visual logic</h2>
            <div className="mb-8 h-px w-24 bg-couture-red" />
            <p className="mb-12 text-lg leading-8 text-foreground/70">
              This collection page exists to help the customer understand what ties these products
              together before they make a choice. It is a narrative grouping, not a replacement for
              the main shop.
            </p>
            <div className="grid grid-cols-2 gap-8 border-l border-charcoal/10 pl-8">
              <div>
                <span className="label-caps mb-2 block">Collection role</span>
                <p className="text-base leading-8">Editorial grouping and aesthetic context.</p>
              </div>
              <div>
                <span className="label-caps mb-2 block">Best next step</span>
                <p className="text-base leading-8">Open a product page or return to the full shop.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-linen px-5 py-32 md:px-16">
        <div className="mb-24 flex items-end justify-between">
          <div>
            <h2 className="font-serif text-[2.6rem]">Products in this Collection</h2>
            <span className="font-mono text-[0.82rem] uppercase tracking-[0.14em] text-foreground/50">
              Catalogue / {collection.name}
            </span>
          </div>
          <Link
            href="/shop"
            className="label-caps border-b border-charcoal pb-2 transition-all hover:border-couture-red hover:text-couture-red"
          >
            View all products
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {collectionProducts.map((product, index) => (
            <Link
              key={product.slug}
              href={`/products/${product.slug}`}
              className={`group cursor-pointer${index === 1 ? " md:mt-24" : ""}`}
            >
              <div className={`relative mb-6 overflow-hidden bg-stone-beige/20 ${index === 1 ? "aspect-[4/5]" : "aspect-square"}`}>
                <img
                  alt={product.title}
                  className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0"
                  src={product.image}
                />
              </div>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="mb-1 font-serif text-[1.4rem]">{product.title}</h3>
                  <span className="label-caps text-foreground/50">{product.materialLine}</span>
                </div>
                <span className="font-mono text-[0.82rem] uppercase tracking-[0.14em]">{product.price}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
