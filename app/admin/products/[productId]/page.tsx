import Link from "next/link";

import { ProductEditRoute } from "@/components/admin/product-route-editor";
import { getAdminCatalogData } from "@/lib/content/catalog";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const { products, categories, collections } = await getAdminCatalogData();
  const product = products.find((item) => item.id === productId);

  if (!product) {
    return (
      <div className="space-y-8">
        <div>
          <p className="adm-section-tag mb-3">[ SYN-ADM // CAT // MISSING ]</p>
          <h1 className="adm-page-title">Product not found</h1>
          <p className="adm-page-subtitle">
            The product may have been deleted or the edit URL is no longer valid.
          </p>
        </div>
        <Link href="/admin/products" className="adm-btn-primary">
          Back to products
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // CAT // EDIT ]</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="adm-page-title">{product.name}</h1>
            <p className="adm-page-subtitle">
              Edit one product record. The catalog table remains separate for scanning and filtering.
            </p>
          </div>
          <Link href="/admin/products" className="adm-btn-ghost">
            Back to table
          </Link>
        </div>
      </div>

      <ProductEditRoute product={product} categories={categories} collections={collections} />
    </div>
  );
}
