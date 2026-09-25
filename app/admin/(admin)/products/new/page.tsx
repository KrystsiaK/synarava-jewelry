import Link from "next/link";

import { ProductCreateRoute } from "@/components/admin/products/product-route-editor";
import { getAdminCatalogData } from "@/lib/content/catalog";
import { getAdminTranslationLocales } from "@/lib/i18n/admin-translation-locales";

export default async function NewProductPage() {
  const [{ collections }, translationLocales] = await Promise.all([
    getAdminCatalogData(),
    getAdminTranslationLocales(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // CAT // NEW ]</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="adm-page-title">New product</h1>
            <p className="adm-page-subtitle">
              Start with the essentials, then add catalog placement, content, media, and product-page details.
            </p>
          </div>
          <Link href="/admin/products" className="adm-btn-ghost">
            Back to table
          </Link>
        </div>
      </div>

      <ProductCreateRoute collections={collections} translationLocales={translationLocales} />
    </div>
  );
}
