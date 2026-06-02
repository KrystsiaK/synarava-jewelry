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
    return { title: "Collection" };
  }

  return {
    title: collection.name,
    description: collection.summary,
    alternates: { canonical: `/collections/${slug}` },
    openGraph: {
      url: `/collections/${slug}`,
      images: [
        {
          url: collection.heroImage,
          width: 1200,
          height: 630,
          alt: collection.name,
        },
      ],
    },
  };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);

  if (!collection) notFound();

  const collectionProducts = await getProductsByCollection(slug);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      { "@type": "ListItem", position: 2, name: "Collections", item: "/collections" },
      { "@type": "ListItem", position: 3, name: collection.name, item: `/collections/${slug}` },
    ],
  };

  return (
    <main className="artifact-shell overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* Hero — full viewport */}
      <header className="relative flex h-[70vh] min-h-[480px] w-full items-center overflow-hidden md:h-screen">
        <div className="absolute inset-0 z-0">
          <img
            alt={`${collection.name} hero`}
            className="h-full w-full object-cover object-center"
            style={{ filter: "grayscale(20%)" }}
            src={collection.heroImage}
          />
        </div>
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-linen/60 to-transparent" />

        <div className="relative z-20 max-w-2xl px-5 md:px-16">
          <span className="mb-4 block font-mono text-[0.82rem] uppercase tracking-[0.28em] text-couture-red md:mb-6">
            {collection.eyebrow}
          </span>
          <h1 className="mb-6 font-serif text-[2.8rem] leading-none sm:text-[3.5rem] md:mb-8 md:text-[5.5rem]">
            {collection.name}
          </h1>
          <p className="max-w-md text-base leading-7 text-foreground/70 md:text-lg md:leading-8">
            {collection.summary}
          </p>
          <div className="mt-8 md:mt-12">
            <Link
              href="/shop"
              className="inline-block bg-charcoal px-8 py-4 label-caps text-white transition-all duration-500 hover:bg-couture-red md:px-12 md:py-5"
            >
              Shop products
            </Link>
          </div>
        </div>
      </header>

      {/* Collection story */}
      <section className="px-5 py-16 md:px-16 md:py-32">
        <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-12 md:gap-6">
          <div className="md:col-span-5">
            <div className="relative">
              <img
                alt={`${collection.name} detail`}
                className="aspect-[3/4] w-full object-cover grayscale"
                src={collection.heroImage}
              />
              {/* Floating accent box — hidden on mobile to prevent overflow */}
              <div className="absolute -bottom-6 -right-4 hidden h-36 w-36 items-center justify-center border border-charcoal/10 bg-stone-beige/30 p-6 backdrop-blur-sm sm:flex sm:h-40 sm:w-40 md:-bottom-8 md:-right-8 md:h-48 md:w-48 md:p-8">
                <span className="text-center font-mono text-[0.75rem] uppercase tracking-[0.14em]">
                  {collection.accent}
                  <br />
                  as collection accent
                </span>
              </div>
            </div>
          </div>

          <div className="md:col-span-6 md:col-start-7">
            <span className="mb-3 block font-mono text-[0.82rem] italic uppercase tracking-[0.14em] text-foreground/50 md:mb-4">
              Collection story
            </span>
            <h2 className="mb-6 font-serif text-[2rem] md:mb-8 md:text-[2.6rem]">A world with a clear visual logic</h2>
            <div className="mb-6 h-px w-16 bg-couture-red md:mb-8 md:w-24" />
            <p className="mb-8 text-base leading-8 text-foreground/70 md:mb-12 md:text-lg">
              This collection page exists to help the customer understand what ties these products
              together before they make a choice. It is a narrative grouping, not a replacement for
              the main shop.
            </p>
            <div className="grid grid-cols-2 gap-6 border-l border-charcoal/10 pl-6 md:gap-8 md:pl-8">
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

      {/* Products grid */}
      <section className="bg-linen px-5 py-16 md:px-16 md:py-32">
        <div className="mb-10 flex flex-col gap-4 md:mb-24 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-serif text-[2rem] md:text-[2.6rem]">Products in this Collection</h2>
            <span className="font-mono text-[0.82rem] uppercase tracking-[0.14em] text-foreground/50">
              Catalogue / {collection.name}
            </span>
          </div>
          <Link
            href="/shop"
            className="label-caps w-fit border-b border-charcoal pb-2 transition-all hover:border-couture-red hover:text-couture-red"
          >
            View all products
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
          {collectionProducts.map((product, index) => (
            <Link
              key={product.slug}
              href={`/products/${product.slug}`}
              className={`group cursor-pointer${index === 1 ? " md:mt-24" : ""}`}
            >
              <div className={`relative mb-4 overflow-hidden bg-stone-beige/20 ${index === 1 ? "aspect-[4/5]" : "aspect-square"}`}>
                <img
                  alt={product.title}
                  className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0"
                  src={product.image}
                />
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="mb-1 font-serif text-[1.1rem] md:text-[1.4rem]">{product.title}</h3>
                  <span className="label-caps text-xs text-foreground/50 md:text-[0.76rem]">{product.materialLine}</span>
                </div>
                <span className="font-mono text-[0.76rem] uppercase tracking-[0.14em] md:text-[0.82rem]">{product.price}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
