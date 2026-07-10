import Link from "next/link";

import { ProductCreateRoute } from "@/components/admin/product-route-editor";
import { getAdminCatalogData } from "@/lib/content/catalog";

export default async function NewProductPage() {
  const { categories, collections } = await getAdminCatalogData();

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // CAT // NEW ]</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="adm-page-title">New product</h1>
            <p className="adm-page-subtitle">
              Create one catalog record. Product lists, categories, and tags stay on their own screens.
            </p>
          </div>
          <Link href="/admin/products" className="adm-btn-ghost">
            Back to table
          </Link>
        </div>
      </div>

      <ProductCreateRoute categories={categories} collections={collections} />
    </div>
  );
}
