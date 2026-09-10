import Link from "next/link";
import { notFound } from "next/navigation";

import { getSavedPostPayload } from "@/app/admin/actions/posts";

export default async function PostPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ postId: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const [{ postId }, query] = await Promise.all([params, searchParams]);
  const locale = query.locale === "pt" ? "PT" : "EN";
  const post = await getSavedPostPayload(postId).catch(() => null);
  if (!post) notFound();
  const translation = post.translations.find((item) => item.locale === locale);
  if (!translation) notFound();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="adm-section-tag mb-3">[ POST PREVIEW // {locale} ]</p>
          <h1 className="adm-page-title">{translation.title || "Untitled post"}</h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/posts/${post.id}/preview?locale=${locale === "EN" ? "pt" : "en"}`} className="adm-btn-ghost">
            Preview {locale === "EN" ? "PT" : "EN"}
          </Link>
          <Link href={`/admin/posts/${post.id}`} className="adm-btn-primary">Back to editor</Link>
        </div>
      </div>

      <article className="border border-[var(--adm-border)] bg-[var(--adm-bg-soft)] px-6 py-10 md:px-14 md:py-16">
        <header className="mx-auto max-w-3xl text-center">
          <p className="adm-section-tag">DRAFT PREVIEW · /{locale.toLowerCase()}/journal/{post.slug}</p>
          <h2 className="mt-5 font-serif text-4xl leading-tight md:text-6xl" style={{ color: "var(--adm-ink)" }}>{translation.title}</h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-8" style={{ color: "var(--adm-muted)" }}>{translation.excerpt}</p>
        </header>
        {post.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.coverUrl} alt={translation.title} className="mx-auto mt-10 aspect-video w-full max-w-5xl object-cover" />
        ) : null}
        <div className="mx-auto mt-12 max-w-2xl space-y-6 text-base leading-8" style={{ color: "var(--adm-ink)" }}>
          {(translation.body ?? "").split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => (
            <p key={`${translation.id}-${index}`}>{paragraph}</p>
          ))}
        </div>
      </article>
    </div>
  );
}
