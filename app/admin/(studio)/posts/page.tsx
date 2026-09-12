import { getAdminPosts } from "@/app/admin/actions/posts";
import { isJournalNavVisible } from "@/lib/content/journal-visibility";
import { JournalVisibilityToggle } from "@/components/admin/posts/journal-visibility-toggle";
import { PostsCms } from "@/components/admin/posts/posts-cms";

export default async function AdminPostsPage() {
  const [posts, journalVisible] = await Promise.all([getAdminPosts(), isJournalNavVisible()]);
  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // POSTS ]</p>
        <h1 className="adm-page-title">Posts</h1>
        <p className="adm-page-subtitle">Write, review, and publish every journal story in English and Portuguese.</p>
      </div>
      <JournalVisibilityToggle initialVisible={journalVisible} />
      <PostsCms posts={posts} />
    </div>
  );
}
