import Link from "next/link";
import { notFound } from "next/navigation";

import { getSavedPostPayload } from "@/app/admin/actions/posts";
import { PostEditorForm } from "@/components/admin/posts/post-editor-form";

export default async function EditPostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const post = await getSavedPostPayload(postId).catch(() => null);
  if (!post) notFound();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="adm-section-tag mb-3">[ SYN-ADM // POSTS // EDIT ]</p>
          <h1 className="adm-page-title">
            {post.translations.find((translation) => translation.locale === "EN")?.title || post.slug}
          </h1>
          <p className="adm-page-subtitle">Edit the English and Portuguese editions of this story.</p>
        </div>
        <Link href="/admin/posts" className="adm-btn-ghost">Back to posts</Link>
      </div>
      <PostEditorForm post={post} />
    </div>
  );
}
