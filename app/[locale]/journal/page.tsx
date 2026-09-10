import type { Metadata } from "next";
import Link from "next/link";

import { listPublishedPosts } from "@/lib/content/posts";
import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { buildAlternates } from "@/lib/seo/alternates";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const title = locale === "pt" ? "Diário" : "Journal";
  const description = locale === "pt"
    ? "Histórias, materiais e processos por trás da Synarava."
    : "Stories, materials, and processes behind Synarava.";

  return { title, description, alternates: buildAlternates(locale, "/journal") };
}

export default async function JournalPage() {
  const locale = await getRequestLocale();
  const posts = await listPublishedPosts(locale);

  return (
    <main className="artifact-shell min-h-screen pb-24 pt-28 md:pb-32 md:pt-36">
      <section className="site-shell">
        <p className="label-caps text-accent">{locale === "pt" ? "[ DIÁRIO ]" : "[ JOURNAL ]"}</p>
        <h1 className="mt-4 max-w-4xl font-serif text-[3rem] leading-none text-foreground sm:text-[4rem] md:text-[5.5rem]">
          {locale === "pt" ? "Histórias de matéria e significado." : "Stories of matter and meaning."}
        </h1>

        {posts.length > 0 ? (
          <div className="mt-14 grid gap-px overflow-hidden border border-foreground/10 bg-foreground/10 md:grid-cols-2">
            {posts.map((post) => (
              <article key={post.id} className="bg-background p-6 md:p-9">
                <p className="label-caps text-muted">
                  {new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(post.publishedAt)}
                </p>
                <h2 className="mt-4 font-serif text-3xl leading-tight text-foreground">
                  <Link href={localePath(locale, `/journal/${post.slug}`)} className="hover:text-accent">
                    {post.title}
                  </Link>
                </h2>
                <p className="mt-4 text-sm leading-7 text-muted">{post.excerpt}</p>
                <Link href={localePath(locale, `/journal/${post.slug}`)} className="mt-7 inline-flex label-caps text-accent">
                  {locale === "pt" ? "Ler história →" : "Read story →"}
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-12 max-w-xl text-base leading-8 text-muted">
            {locale === "pt" ? "As primeiras histórias estão a ser preparadas." : "The first stories are being prepared."}
          </p>
        )}
      </section>
    </main>
  );
}
