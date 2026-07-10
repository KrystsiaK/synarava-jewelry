import { CategoriesTable } from "@/components/admin/categories-cms";
import { getAdminCatalogData } from "@/lib/content/catalog";

export default async function AdminCategoriesPage() {
  const { categories } = await getAdminCatalogData();

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // TAX // CAT ]</p>
        <h1 className="adm-page-title">Categories</h1>
        <p className="adm-page-subtitle">
          Product category records. Edit each category on its own route.
        </p>
      </div>

      <CategoriesTable categories={categories} />
    </div>
  );
}
