import Link from "next/link";

import { PostEditorForm } from "@/components/admin/posts/post-editor-form";

export default function NewPostPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="adm-section-tag mb-3">[ SYN-ADM // POSTS // NEW ]</p>
          <h1 className="adm-page-title">New post</h1>
          <p className="adm-page-subtitle">Draft both languages, review them, then publish one shared URL.</p>
        </div>
        <Link href="/admin/posts" className="adm-btn-ghost">Back to posts</Link>
      </div>
      <PostEditorForm />
    </div>
  );
}
