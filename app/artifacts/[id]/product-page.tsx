/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Play } from "lucide-react";

import { AddToCartButton } from "@/components/commerce/add-to-cart-button";
import { getProductBySlug } from "@/lib/content/catalog";

type Props = {
  params: Promise<{ slug?: string; id?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolved = await params;
  const key = resolved.slug ?? resolved.id ?? "";
  const product = await getProductBySlug(key);

  if (!product) return { title: "Product" };

  return {
    title: product.title,
    description: product.shortDescription,
    alternates: { canonical: `/products/${key}` },
    openGraph: {
      url: `/products/${key}`,
      images: [
        {
          url: product.image,
          width: 1200,
          height: 630,
          alt: product.title,
        },
      ],
    },
  };
}

const materials = [
  {
    title: "Lava Stone",
    body: "Primal energy captured from the earth's core. Porous, lightweight, and grounding.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC1bJ7ykeUWZbNNpZ4zXpG4SvAJjAQPMpH2D0v2qVUL3Ba8rL9yK6yAJhAybvdZGFOqRYdueOQMOG8LACGPAsxdq9XZkmCcT6u_NVTMYbdZ2rxCVIDcUe11J4hIkFlcfp7CeVur2isa6KbgGOQ32iIYXAjaKKMQ-10-9VyS2htqJu7NHcWYjQuNV-fF9gQLC20YtjoNHhF-z3N6Y8_m_q_vFnHOCINxrvJxGkR0GP3uR-DYJmfkE09_yvCDD72DRF9qBSIH5HrZHMXN",
  },
  {
    title: "White Oak",
    body: "Hand-turned wood, oil-finished to preserve the warmth of Belarusian forests.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCIlvjp4lBihCVwo4LwQUe3FT7_W35SdGVr6Zfrm0tN4HxiR6fN_IgsxjzXNsvyz8LAcB5J2GiRSo9EAhE-3aKH_7RzSsvp1NGgb6ia5KwCc2Ns_nXbuyGK73j1LgBOLiEGC3I_v_wO66xJb2FkJZ3ZIQAgt4ZopW1udde2_rQhEizoHb0141AxZjnz5PUdOYiWuCwQ8TRzh5yxJuZJdPnOeLnYF66RSZPIabh-YO5Kv836T5DhLOeTFlHLMMcz1YDl7OMQSTjmj_0h",
  },
  {
    title: "Traditional Weave",
    body: "A geometric protection motif, woven by master artisans using centuries-old techniques.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDgNxbCUeq6PwnV9fMol7H3gSKKn9-3hk2HER8IYcN4ZgFaK_WI8ymgWt_Ee1poxFW4OcwxoPzM-eYwa53r92ExOElEqMnuWzdS9qO8cjUTQlJqyJOwMma-GC1MeVWBWWgsMl1zF-p1AVwqMwSUlxClRbcxD78jRy_4iGCQU_MnsS31GUG56dvs03N9kPRFhQUNtfuiJTr5mPGYnR4j3_IRn4hNHYN0hfiKa1LN-EBPbMLQtZXKEEksLxzagXPjV9SP1LVvlYyZUp45",
  },
];

const stats: [string, string][] = [
  ["12", "Hours of Weaving"],
  ["100%", "Natural Cotton"],
  ["02", "Master Craftsmen"],
  ["∞", "Heritage Soul"],
];

const lookbook = [
  {
    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuB_Ie20hGCRnyWbIUk3WikrL29NSkFV0FzPiuVnJ0sRYnq-5sGpITU4zzVVIa3X_WHW57G1M7j9yVGq0e3eYoEle4MC86F9rl1INlF3Nf8O8pU06NxCKy2DAK9S1_p2ML8y_BDonMAVl9bNQZa-iGN8qHFDb2HzLal7vARnYSYo0bl0jAAKGWFcL1E0dBOTWuVEuR5doUi7uSQF3rTYXDsXU4t2QiUbdhx66sTBKqGjQuyjRUDwdv7nMQdGBrIJPJPRIuDoTsdtldOn",
    label: "01 / The Ensemble",
    mobileAspect: "aspect-[4/5]",
    colSpan: "md:col-span-2 md:row-span-2",
  },
  {
    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuAcHdMprl7YZ1Eqp_m9PN5LjGgHgpO7z9LqYfG2pJWftR5gxPOQHiJQY-Ob8XHfylhpDatz5S5iUSsKzUDsbLrfQht1zuMv6hjYk9Rujb--qtrgJtmkpWXp3QYfHItdcaOOBA1I5328QzhQnwKXqhSLNgEitVvoQ4te8m_kE4nrGTZ-C4Xh8VUqgYfuuObDn7cxfMoH_hQs046d_G9QSi3B60SSb7KtMHblZXLX06SvPAI-yv-xQxNS2KiLhp_tjb9PqBhB4XNRxjHZ",
    label: "02 / Watch Pairing",
    mobileAspect: "aspect-square",
    colSpan: "md:col-span-2",
  },
  {
    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuBqNAoIB2RLpXNNoPRuqNzhk40thxv5VGyxi8ElGGChgVoL4qw89Sry8ZUj0TSxy53krf4-BbUeueIEOjs1WqLmgWon5yMNif8WaLWVmF0v1JIs8if3JemLyVNXjFrPI5edx6a9eurYhKgbqt1tSZ9N3ZsAJssMrNM4D5QbkHarrKPhiXkGP5xO8incgB3khvTO0u8S9c96TewXNZuvuScb0aXsedPXL8EDeXHAqBefSvWKoEbXgbLFebsHM5qfN-rTAikJP1YvuQj7",
    label: "",
    mobileAspect: "aspect-square",
    colSpan: "",
  },
  {
    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuBfnxtP0tnzHpA4FJlWk06e5_0KhM8yN7jd2qnTKFjfVNlw9uy9AF_wv54EAH0Yl1wxofDtCYXCU9DTHTFlcbdn4G0EKZSdZhvyKXw1R_TIplVHHQWbq-vGeVL36bAFJ6rRjrLW5nvh1Qsx6ja7Fe0bmT6LhAkK6Mf3zX-npVmHzpcs1kIL376EfLqHsPONa74c4DY4-li-zpAKScW6JSIBp-M76623SP_ozugt7F29isLug4mNGz1LyAL-EdhMusDGq6lU-GMWCUSCj",
    label: "",
    mobileAspect: "aspect-square",
    colSpan: "",
  },
];

export default async function ProductDetailPage({ params }: Props) {
  const resolved = await params;
  const key = resolved.slug ?? resolved.id ?? "";
  const product = await getProductBySlug(key);

  if (!product) notFound();

  const priceCents = parseFloat(product.price.replace(/[^0-9.]/g, ""));

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.shortDescription,
    image: product.image,
    sku: product.slug,
    brand: { "@type": "Brand", name: "Synarava" },
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      price: isNaN(priceCents) ? undefined : priceCents,
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: "Synarava" },
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      { "@type": "ListItem", position: 2, name: "Shop", item: "/shop" },
      { "@type": "ListItem", position: 3, name: product.title, item: `/products/${key}` },
    ],
  };

  return (
    <main className="artifact-shell min-h-screen pt-24 md:pt-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* Hero */}
      <section className="site-shell grid min-h-[80vh] grid-cols-1 items-center gap-8 py-12 lg:grid-cols-12 lg:py-0">
        <div className="z-10 space-y-6 lg:col-span-5 lg:space-y-8">
          <div className="space-y-2">
            <span className="font-mono text-[0.82rem] uppercase tracking-[0.28em] text-foreground/60">
              {product.series}
            </span>
            <h1 className="font-serif text-[2.6rem] leading-tight sm:text-[3.5rem] md:text-[4.5rem]">{product.title}</h1>
          </div>
          <p className="max-w-md text-base leading-7 text-foreground/70 md:text-lg md:leading-8">
            {product.shortDescription}
          </p>
          <p className="label-caps text-foreground/60">{product.materialLine}</p>
          <div className="flex flex-wrap items-center gap-6 pt-2">
            <AddToCartButton productSlug={product.slug} />
            <span className="font-mono text-[0.82rem] uppercase tracking-[0.14em]">{product.price}</span>
          </div>
        </div>

        <div className="relative flex items-center lg:col-span-7">
          <div className="relative mx-auto w-full max-w-lg lg:ml-auto lg:max-w-2xl">
            <img
              alt={product.title}
              className="aspect-[4/5] w-full object-cover"
              style={{ filter: "grayscale(20%) contrast(1.1)" }}
              src={product.image}
            />
            <div className="mirror-fragment absolute inset-y-0 right-0 w-1/2 overflow-hidden">
              <img alt="" aria-hidden="true" className="absolute inset-y-0 -right-full h-full w-[200%] scale-x-[-1] object-cover opacity-60" src={product.image} />
              <div className="absolute inset-0 bg-white/10 mix-blend-overlay" />
            </div>
          </div>
        </div>
      </section>

      {/* Materials */}
      <section className="bg-stone-beige/30 py-16 md:py-32">
        <div className="site-shell">
          <div className="mb-12 md:mb-20">
            <h2 className="text-center font-serif text-[2rem] md:text-[2.8rem] md:text-[3.4rem]">The Honest Material</h2>
            <div className="embroidery-separator" />
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 md:gap-6">
            {materials.map((item) => (
              <article key={item.title} className="space-y-5">
                <div className="group relative aspect-square overflow-hidden bg-charcoal">
                  <img alt={item.title} className="h-full w-full object-cover opacity-80 transition-transform duration-700 group-hover:scale-110" src={item.image} />
                </div>
                <div className="space-y-2">
                  <h3 className="label-caps">{item.title}</h3>
                  <p className="text-base leading-8 text-foreground/70">{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Symbolism section */}
      <section className="site-shell overflow-hidden py-20 md:py-40">
        <div className="artifact-grid items-center">
          <div className="relative col-span-12 lg:col-span-8">
            <div className="pointer-events-none absolute -left-4 -top-12 select-none font-serif text-[4rem] leading-none text-couture-red/10 sm:-left-8 sm:-top-16 sm:text-[6rem] md:text-[11rem]">
              КОД РОДА
            </div>
            <img
              alt="Symbolic Detail"
              className="aspect-video w-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCVNicx6BX7QK8-0S_xcnEC5OIPGkKfvUDChUtiI-G1t9Bkh2W9A6x4-aZZg1ZxRobK8rJzH4lll1yxq453fDfiLJ07UoJQasMpFW7CFhaOsAFAQwfcCiyTByw4h0vNvuoEusZADXXAD6pj9o4d41vLsFXzL01dChZ--KMmqn9RcXbjuQNarNZegP3FHOt2daIMbHrp5o7Sbk_oAG91bD6kM67FPxqING6QU9fiX7KlAlllqjoabSmXLiwIOw4un884KvpI3JJUOW4S"
            />
            <div className="etched-glass mt-6 p-6 sm:p-8 lg:absolute lg:-right-24 lg:top-1/2 lg:mt-0 lg:w-3/5 lg:-translate-y-1/2 lg:p-12">
              <span className="font-mono text-[0.82rem] uppercase tracking-[0.14em] text-couture-red">
                {product.symbolismLabel}
              </span>
              <h2 className="mt-3 font-serif text-[1.8rem] italic sm:text-[2.4rem] md:mt-4 md:text-[3.2rem]">
                {product.symbolismTitle}
              </h2>
              <p className="mt-4 text-base leading-7 text-foreground/80 md:mt-6 md:text-lg md:leading-8">
                {product.symbolismBody}
              </p>
              <p className="mt-4 text-base leading-7 text-foreground/72 md:text-lg md:leading-8">
                {product.symbolismBody2}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Human Precision */}
      <section className="bg-charcoal px-5 py-20 text-linen md:px-16 md:py-32">
        <div className="mx-auto max-w-4xl space-y-10 text-center md:space-y-12">
          <h2 className="font-serif text-[2rem] md:text-[3.4rem]">Human Precision</h2>
          <div className="group relative cursor-pointer">
            <div className="aspect-video overflow-hidden bg-black/20">
              <img
                className="h-full w-full object-cover opacity-50 transition-transform duration-1000 group-hover:scale-105"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAmofw-Jl3CJtnxftqTYfRCfvMEZbwTFj9jJp9qj6qNia6D9BZ39ELrH5OIpc_-asXTq_9197RDp0w9y2MaYsazzHK5c3KzOfl1uPmxgYsd1FaIi4HELFmwvI0I7oqTe7e5MLDgGc1W0MK-wfoJtFpxqsD4-gZEyABj3x5tlK9ZLFScCUDw60daJKsCYvmBJgE6mh7cFHHw8DjQO1RqeldU6YcNV8x5tpoF8HJSFswbArPbPD8WeRip_1Bw_ePpMMjB3Alq1IDjz7Tk"
                alt="Craftsmanship"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur-sm transition-transform group-hover:scale-110 md:h-20 md:w-20">
                  <Play className="ml-1 size-6 md:size-7" />
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6 pt-4 md:grid-cols-4 md:pt-8">
            {stats.map(([value, label]) => (
              <div key={label} className="space-y-2">
                <span className="block font-mono text-xl md:text-2xl">{value}</span>
                <span className="label-caps text-linen/60">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lookbook */}
      <section className="site-shell py-20 md:py-32">
        <h2 className="label-caps mb-8 md:mb-12">The Pairing Guide</h2>
        <div className="grid grid-cols-2 gap-3 md:h-[50rem] md:grid-cols-4 md:grid-rows-2 md:gap-4">
          {lookbook.map((item, i) => (
            <div key={i} className={`relative overflow-hidden bg-black/5 ${item.mobileAspect} md:aspect-auto ${item.colSpan}`}>
              <img className="h-full w-full object-cover grayscale transition-all duration-700 hover:grayscale-0" src={item.src} alt={`Lookbook ${i + 1}`} />
              {item.label ? (
                <div className="absolute bottom-4 left-4 md:bottom-8 md:left-8">
                  <span className="font-mono text-[0.75rem] uppercase tracking-[0.12em] md:text-[0.82rem]">{item.label}</span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
