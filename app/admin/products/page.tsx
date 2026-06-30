import { saveCategoryAction, saveTagAction } from "@/app/admin/actions";
import { ProductsCms } from "@/components/admin/products-cms";
import { getAdminCatalogData } from "@/lib/content/catalog";

export default async function AdminProductsPage() {
  const { products, categories, tags, collections } = await getAdminCatalogData();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // CAT ]</p>
        <h1 className="adm-page-title">
          Catalog
        </h1>
        <p className="adm-page-subtitle">
          Products, categories, tags, media, and storefront publishing state.
        </p>
      </div>

      <ProductsCms
        initialProducts={products}
        categories={categories}
        tags={tags}
        collections={collections}
      />

      {/* Taxonomy editors */}
      <div
        className="grid gap-4 md:grid-cols-2"
      >
        <form action={saveCategoryAction} className="adm-panel grid gap-4 p-5">
          <div>
            <p className="adm-section-tag">[ TAXONOMY // CATEGORY ]</p>
            <h2 className="adm-title-sm mt-2">
              Add category
            </h2>
          </div>
          <input name="name" placeholder="Bracelets" className="adm-field" />
          <input name="slug" placeholder="bracelets" className="adm-field" />
          <textarea
            name="description"
            rows={3}
            placeholder="What this group means"
            className="adm-field"
          />
          <button type="submit" className="adm-btn-ghost w-fit">
            Save category
          </button>
        </form>

        <form action={saveTagAction} className="adm-panel grid gap-4 p-5">
          <div>
            <p className="adm-section-tag">[ TAXONOMY // TAG ]</p>
            <h2 className="adm-title-sm mt-2">
              Add tag
            </h2>
          </div>
          <input name="name" placeholder="Lava" className="adm-field" />
          <input name="slug" placeholder="lava" className="adm-field" />
          <button type="submit" className="adm-btn-ghost w-fit">
            Save tag
          </button>
        </form>
      </div>
    </div>
  );
}
