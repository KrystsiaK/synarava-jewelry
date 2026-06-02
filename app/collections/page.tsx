/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";

import { listCollections } from "@/lib/content/catalog";

export const metadata: Metadata = {
  title: "Collections | Synarava",
  description: "Browse Synarava collections and enter each story-world before choosing a product.",
};

export default async function CollectionsPage() {
  const collections = await listCollections();

  return (
    <main className="artifact-shell min-h-screen pb-24 pt-28">
      <div className="site-shell">
        <section className="mb-24">
          <p className="mb-4 font-mono text-[0.82rem] uppercase tracking-[0.14em] text-couture-red">
            Collections
          </p>
          <h1 className="mb-6 font-serif text-[4rem] md:text-[5.5rem]">Browse by Collection</h1>
          <p className="max-w-2xl text-lg leading-8 text-foreground/70">
            Collections are the editorial layer of the shop. They group products by visual language,
            material mood, and symbolism, so the visitor can enter a world before choosing a piece.
          </p>
        </section>

        <div className="grid gap-12">
          {collections.map((collection, index) => (
            <Link
              key={collection.slug}
              href={`/collections/${collection.slug}`}
              className={`grid gap-8 border-t border-charcoal/10 py-12 md:grid-cols-12 ${index % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""}`}
            >
              <div className="md:col-span-6">
                <div className="overflow-hidden bg-stone-beige">
                  <img
                    alt={collection.name}
                    src={collection.heroImage}
                    className="aspect-[16/10] h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                  />
                </div>
              </div>

              <div className="flex flex-col justify-center gap-5 md:col-span-6">
                <span className="font-mono text-[0.82rem] uppercase tracking-[0.14em] text-couture-red">
                  {collection.eyebrow}
                </span>
                <h2 className="font-serif text-[2.6rem] leading-tight md:text-[3.2rem]">{collection.name}</h2>
                <p className="max-w-xl text-lg leading-8 text-foreground/70">{collection.summary}</p>
                <span className="label-caps inline-flex w-fit border-b border-charcoal pb-2 transition-colors hover:text-couture-red hover:border-couture-red">
                  Explore collection
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
