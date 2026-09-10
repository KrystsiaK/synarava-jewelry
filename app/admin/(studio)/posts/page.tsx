import { getAdminPosts } from "@/app/admin/actions/posts";
import { PostsCms } from "@/components/admin/posts/posts-cms";

export default async function AdminPostsPage() {
  const posts = await getAdminPosts();
  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // POSTS ]</p>
        <h1 className="adm-page-title">Posts</h1>
        <p className="adm-page-subtitle">Write, review, and publish every journal story in English and Portuguese.</p>
      </div>
      <PostsCms posts={posts} />
    </div>
  );
}
