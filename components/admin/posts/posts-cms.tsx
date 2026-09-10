import Link from "next/link";

import type { SavedPostPayload } from "@/app/admin/actions/posts";
import { postLocaleReadiness } from "@/lib/posts/localization";

export function PostsCms({ posts }: { posts: SavedPostPayload[] }) {
  return (
    <section className="adm-panel p-5">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--adm-border)] pb-4">
        <div>
          <p className="adm-section-tag">[ EDITORIAL CONTENT ]</p>
          <h2 className="adm-title-sm mt-2">Posts</h2>
        </div>
        <Link href="/admin/posts/new" className="adm-btn-primary">New post</Link>
      </div>

      <div className="mt-5 grid gap-2">
        {posts.length > 0 ? posts.map((post) => {
          const en = postLocaleReadiness(post.translations, "en");
          const pt = postLocaleReadiness(post.translations, "pt");
          return (
            <article key={post.id} className="grid gap-4 border border-[var(--adm-border)] p-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "var(--adm-ink)" }}>
                  {post.translations.find((translation) => translation.locale === "EN")?.title || post.slug}
                </h3>
                <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>/journal/{post.slug}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-[0.65rem] font-bold uppercase tracking-wider">
                <span className={en.complete && en.reviewed ? "adm-badge-published" : "adm-badge-draft"}>EN {en.percent}%</span>
                <span className={pt.complete && pt.reviewed ? "adm-badge-published" : "adm-badge-draft"}>PT {pt.percent}%</span>
                <span className={post.status === "PUBLISHED" ? "adm-badge-published" : "adm-badge-draft"}>{post.status}</span>
              </div>
              <Link href={`/admin/posts/${post.id}`} className="adm-btn-ghost text-center">Edit</Link>
            </article>
          );
        }) : (
          <p className="py-6 text-sm" style={{ color: "var(--adm-muted)" }}>No posts yet. Create the first bilingual story.</p>
        )}
      </div>
    </section>
  );
}
