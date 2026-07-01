import Link from "next/link";

import { CategoryEditor } from "@/components/admin/categories-cms";
import { getAdminCatalogData } from "@/lib/content/catalog";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  const { categories } = await getAdminCatalogData();
  const category = categories.find((item) => item.id === categoryId);

  if (!category) {
    return (
      <div className="space-y-8">
        <div>
          <p className="adm-section-tag mb-3">[ SYN-ADM // TAX // CAT // MISSING ]</p>
          <h1 className="adm-page-title">Category not found</h1>
          <p className="adm-page-subtitle">
            The category may have been deleted or the edit URL is no longer valid.
          </p>
        </div>
        <Link href="/admin/categories" className="adm-btn-primary">
          Back to categories
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // TAX // CAT // EDIT ]</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="adm-page-title">{category.name}</h1>
            <p className="adm-page-subtitle">
              Edit one category. Deleting it will leave products uncategorized.
            </p>
          </div>
          <Link href="/admin/categories" className="adm-btn-ghost">
            Back to categories
          </Link>
        </div>
      </div>

      <CategoryEditor category={category} />
    </div>
  );
}
