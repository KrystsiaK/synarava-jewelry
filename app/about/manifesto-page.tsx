import type { Metadata } from "next";
import Image from "next/image";

import { PrimaryCtaButton } from "@/components/ui";
import { getPageBySlug } from "@/lib/content/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageBySlug("manifesto");
  const content = page?.content ?? {};

  return {
    title: page?.title || "Manifesto",
    description: page?.excerpt || undefined,
    alternates: { canonical: "/about/manifesto" },
    openGraph: {
      url: "/about/manifesto",
      images: content.heroImage
        ? [{ url: content.heroImage, width: 1200, height: 630, alt: page?.title || "Manifesto" }]
        : [],
    },
  };
}

export default async function ManifestoPage() {
  const page = await getPageBySlug("manifesto");
  const content = page?.content ?? {};

  return (
    <main className="artifact-shell min-h-screen overflow-hidden bg-background pt-24 md:pt-28">
      <section className="site-shell grid min-h-[calc(100svh-7rem)] items-center gap-12 py-16 md:grid-cols-12 md:py-24">
        <div className="md:col-span-7">
          {content.eyebrow ? (
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              {content.eyebrow}
            </p>
          ) : null}
          {page?.title ? (
            <h1 className="max-w-[12ch] text-balance font-serif text-[clamp(3.2rem,8vw,7rem)] leading-[0.88] tracking-[-0.04em]">
              {page.title}
            </h1>
          ) : null}
          {page?.excerpt ? (
            <p className="mt-8 max-w-xl text-pretty text-lg leading-8 text-foreground/70">
              {page.excerpt}
            </p>
          ) : null}
        </div>

        {content.heroImage ? (
          <div className="relative aspect-[3/4] overflow-hidden bg-surface md:col-span-5">
            <Image
              src={content.heroImage}
              alt={page?.title || ""}
              fill
              preload
              quality={85}
              sizes="(max-width: 768px) 100vw, 42vw"
              className="object-cover"
            />
          </div>
        ) : null}
      </section>

      {content.body || content.quote ? (
        <section className="border-y border-foreground/10 bg-surface py-24 md:py-36">
          <div className="site-shell grid gap-12 md:grid-cols-12">
            {content.quote ? (
              <blockquote className="text-balance font-serif text-[clamp(2.4rem,5vw,4.8rem)] italic leading-[1.02] md:col-span-6">
                {content.quote}
              </blockquote>
            ) : null}
            {content.body ? (
              <p className="max-w-2xl text-pretty text-base leading-8 text-foreground/68 md:col-span-5 md:col-start-8 md:text-lg">
                {content.body}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {content.secondaryTitle || content.secondaryBody ? (
        <section className="site-shell py-24 md:py-36">
          {content.secondaryTitle ? (
            <h2 className="max-w-4xl text-balance font-serif text-[clamp(2.8rem,6vw,5.5rem)] leading-[0.92]">
              {content.secondaryTitle}
            </h2>
          ) : null}
          {content.secondaryBody ? (
            <p className="mt-8 max-w-2xl text-pretty text-base leading-8 text-foreground/68 md:text-lg">
              {content.secondaryBody}
            </p>
          ) : null}
          {content.ctaHref && content.ctaLabel ? (
            <div className="mt-10">
              <PrimaryCtaButton href={content.ctaHref}>{content.ctaLabel}</PrimaryCtaButton>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
