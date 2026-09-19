import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPageBySlug } from "@/lib/content/catalog";
import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";
import { ArtifactLink } from "@/components/ui/artifact-button";
import { PageHeroImage } from "@/components/ui/page-hero-image";

type Props = {
  params: Promise<{ slug: string }>;
};

const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "cart",
  "checkout",
  "collections",
  "login",
  "offer",
  "products",
  "register",
  "reset-password",
  "shop",
]);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);

  if (RESERVED_SLUGS.has(slug)) {
    return {};
  }

  const page = await getPageBySlug(slug, locale);
  if (!page) {
    return {};
  }

  return {
    title: page.title,
    description: page.excerpt || page.title,
    alternates: buildAlternates(locale, `/${slug}`),
    openGraph: {
      url: localePath(locale, `/${slug}`),
      title: page.title,
      description: page.excerpt || page.title,
      images: [{ url: page.content.heroImage ?? "/og-default.jpg", width: 1200, height: 630, alt: page.title }],
    },
  };
}

export default async function StaticCmsPage({ params }: Props) {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);

  if (RESERVED_SLUGS.has(slug)) {
    notFound();
  }

  const page = await getPageBySlug(slug, locale);
  if (!page || slug === "home" || slug === "about" || slug === "manifesto") {
    notFound();
  }

  const content = (page.content ?? {}) as Record<string, string | undefined>;
  const heroImage = content.heroImage;

  return (
    <main className="artifact-shell min-h-screen pb-20 md:pb-32">
      <header className={heroImage ? "relative flex min-h-[68svh] items-end overflow-hidden border-b border-stroke pb-12 pt-24 md:min-h-[76svh] md:pb-16 md:pt-28" : "pt-24 md:pt-28"}>
        <PageHeroImage src={heroImage} />
        <div className="site-shell relative z-10 w-full">
          <div className="mx-auto max-w-4xl">
            <p className={heroImage ? "label-caps text-white/75" : "label-caps text-accent"}>
              {content.eyebrow ?? `Page / ${slug}`}
            </p>
            <h1 className={heroImage ? "mt-4 font-serif text-[2.7rem] leading-none text-white sm:text-[3.3rem] md:text-[4.4rem]" : "mt-4 font-serif text-[2.7rem] leading-none text-foreground sm:text-[3.3rem] md:text-[4.4rem]"}>
              {page.title}
            </h1>
            {page.excerpt ? (
              <p className={heroImage ? "mt-6 max-w-2xl text-lg leading-8 text-white/75" : "mt-6 max-w-2xl text-lg leading-8 text-muted"}>
                {page.excerpt}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <section className="site-shell">
        <div className="mx-auto max-w-4xl">
          <div className="mt-12 grid gap-10 border-t border-foreground/10 pt-10 md:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
            <div className="space-y-6">
              {content.body ? (
                <p className="text-base leading-8 text-foreground/78 md:text-lg">
                  {content.body}
                </p>
              ) : null}

              {content.quote ? (
                <blockquote className="border-l border-accent/40 pl-5 font-serif text-xl leading-9 text-foreground/82">
                  {content.quote}
                </blockquote>
              ) : null}
            </div>

            <aside className="panel h-fit space-y-5 p-6">
              {content.secondaryTitle ? (
                <h2 className="font-serif text-2xl text-foreground">
                  {content.secondaryTitle}
                </h2>
              ) : null}
              {content.secondaryBody ? (
                <p className="text-sm leading-7 text-muted">
                  {content.secondaryBody}
                </p>
              ) : null}
              {content.ctaLabel && content.ctaHref ? (
                <ArtifactLink href={content.ctaHref}>{content.ctaLabel}</ArtifactLink>
              ) : null}
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
