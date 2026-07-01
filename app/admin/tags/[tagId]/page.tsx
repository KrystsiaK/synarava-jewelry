import Link from "next/link";

import { TagEditor } from "@/components/admin/tags-cms";
import { getAdminCatalogData } from "@/lib/content/catalog";

export default async function EditTagPage({
  params,
}: {
  params: Promise<{ tagId: string }>;
}) {
  const { tagId } = await params;
  const { tags } = await getAdminCatalogData();
  const tag = tags.find((item) => item.id === tagId);

  if (!tag) {
    return (
      <div className="space-y-8">
        <div>
          <p className="adm-section-tag mb-3">[ SYN-ADM // TAX // TAG // MISSING ]</p>
          <h1 className="adm-page-title">Tag not found</h1>
          <p className="adm-page-subtitle">
            The tag may have been deleted or the edit URL is no longer valid.
          </p>
        </div>
        <Link href="/admin/tags" className="adm-btn-primary">
          Back to tags
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // TAX // TAG // EDIT ]</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="adm-page-title">{tag.name}</h1>
            <p className="adm-page-subtitle">
              Edit one tag. Deleting it detaches the tag from products.
            </p>
          </div>
          <Link href="/admin/tags" className="adm-btn-ghost">
            Back to tags
          </Link>
        </div>
      </div>

      <TagEditor tag={tag} />
    </div>
  );
}
