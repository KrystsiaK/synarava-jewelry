import { saveCategoryAction, saveTagAction } from "@/app/admin/actions";
import { ProductsCms } from "@/components/admin/products-cms";
import { getAdminCatalogData } from "@/lib/content/catalog";

const adminFieldClass =
  "admin-field w-full min-w-0 border border-stroke bg-transparent px-4 py-3 outline-none focus:border-accent";

export default async function AdminProductsPage() {
  const { products, categories, tags, collections } = await getAdminCatalogData();

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <p className="label-caps text-accent">Catalog</p>
        <h1 className="font-serif text-[3rem] leading-none md:text-[4rem]">Products, categories, tags</h1>
        <p className="max-w-2xl text-lg leading-8 text-foreground/68">
          Add or edit store items together with the taxonomy that powers search and filtering on
          the public shop page.
        </p>
      </header>

      <ProductsCms
        initialProducts={products}
        categories={categories}
        tags={tags}
        collections={collections}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <form action={saveCategoryAction} className="panel grid gap-4 p-6">
          <div>
            <p className="label-caps text-accent">Taxonomy</p>
            <h2 className="mt-2 font-serif text-[1.8rem]">Add category</h2>
          </div>
          <input name="name" placeholder="Bracelets" className={adminFieldClass} />
          <input name="slug" placeholder="bracelets" className={adminFieldClass} />
          <textarea
            name="description"
            rows={3}
            placeholder="What this group means"
            className={adminFieldClass}
          />
          <button
            type="submit"
            className="w-fit border border-stroke px-4 py-3 label-caps transition-colors hover:border-accent hover:text-accent"
          >
            Save category
          </button>
        </form>

        <form action={saveTagAction} className="panel grid gap-4 p-6">
          <div>
            <p className="label-caps text-accent">Search tags</p>
            <h2 className="mt-2 font-serif text-[1.8rem]">Add tag</h2>
          </div>
          <input name="name" placeholder="Lava" className={adminFieldClass} />
          <input name="slug" placeholder="lava" className={adminFieldClass} />
          <button
            type="submit"
            className="w-fit border border-stroke px-4 py-3 label-caps transition-colors hover:border-accent hover:text-accent"
          >
            Save tag
          </button>
        </form>
      </div>
    </div>
  );
}
