import { TagsTable } from "@/components/admin/tags-cms";
import { getAdminCatalogData } from "@/lib/content/catalog";

export default async function AdminTagsPage() {
  const { tags } = await getAdminCatalogData();

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // TAX // TAG ]</p>
        <h1 className="adm-page-title">Tags</h1>
        <p className="adm-page-subtitle">
          Product tag records. Edit each tag on its own route.
        </p>
      </div>

      <TagsTable tags={tags} />
    </div>
  );
}
