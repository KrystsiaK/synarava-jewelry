import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPublishedPost } from "@/lib/content/posts";
import { isJournalNavVisible } from "@/lib/content/journal-visibility";
import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ slug }, locale, journalVisible] = await Promise.all([params, getRequestLocale(), isJournalNavVisible()]);
  if (!journalVisible) return {};
  const post = await getPublishedPost(slug, locale);
  if (!post) return {};

  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt,
    alternates: buildAlternates(locale, `/journal/${slug}`),
    openGraph: {
      url: localePath(locale, `/journal/${slug}`),
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.excerpt,
      images: post.coverUrl ? [{ url: post.coverUrl, alt: post.coverAlt ?? post.title }] : undefined,
    },
  };
}

export default async function JournalPostPage({ params }: Props) {
  const [{ slug }, locale, journalVisible] = await Promise.all([params, getRequestLocale(), isJournalNavVisible()]);
  if (!journalVisible) notFound();
  const post = await getPublishedPost(slug, locale);
  if (!post) notFound();

  const paragraphs = post.body.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);

  return (
    <main className="artifact-shell min-h-screen pb-24 pt-28 md:pb-36 md:pt-36">
      <article className="site-shell">
        <header className="mx-auto max-w-4xl text-center">
          <p className="label-caps text-accent">
            {new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(post.publishedAt)}
          </p>
          <h1 className="mt-5 font-serif text-[3rem] leading-[0.98] text-foreground sm:text-[4rem] md:text-[5.5rem]">
            {post.title}
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-muted">{post.excerpt}</p>
        </header>

        {post.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- S3 keys may be served through the authenticated media proxy.
          <img src={post.coverUrl} alt={post.coverAlt ?? post.title} className="mx-auto mt-12 aspect-[16/9] w-full max-w-6xl object-cover" />
        ) : null}

        <div className="mx-auto mt-14 max-w-2xl space-y-7 text-base leading-8 text-foreground/80 md:text-lg md:leading-9">
          {paragraphs.map((paragraph, index) => <p key={`${post.id}-${index}`}>{paragraph}</p>)}
        </div>
      </article>
    </main>
  );
}
