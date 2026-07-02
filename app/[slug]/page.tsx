import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getPageBySlug } from "@/lib/content/catalog";
import { ArtifactLink } from "@/components/ui/artifact-button";

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
  const { slug } = await params;

  if (RESERVED_SLUGS.has(slug)) {
    return {};
  }

  const page = await getPageBySlug(slug);
  if (!page) {
    return {};
  }

  return {
    title: page.title,
    description: page.excerpt || page.title,
    alternates: { canonical: `/${slug}` },
    openGraph: {
      url: `/${slug}`,
      title: page.title,
      description: page.excerpt || page.title,
    },
  };
}

export default async function StaticCmsPage({ params }: Props) {
  const { slug } = await params;

  if (RESERVED_SLUGS.has(slug)) {
    notFound();
  }

  const page = await getPageBySlug(slug);
  if (!page || slug === "home" || slug === "about" || slug === "manifesto") {
    notFound();
  }

  const content = (page.content ?? {}) as Record<string, string | undefined>;

  return (
    <main className="artifact-shell min-h-screen pt-24 pb-20 md:pt-28 md:pb-32">
      <section className="site-shell">
        <div className="mx-auto max-w-4xl">
          <p className="label-caps text-accent">
            {content.eyebrow ?? `Page / ${slug}`}
          </p>
          <h1 className="mt-4 font-serif text-[2.7rem] leading-none text-foreground sm:text-[3.3rem] md:text-[4.4rem]">
            {page.title}
          </h1>
          {page.excerpt ? (
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
              {page.excerpt}
            </p>
          ) : null}

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
