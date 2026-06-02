import { saveCategoryAction, saveCollectionAction, saveProductAction, saveTagAction } from "@/app/admin/actions";
import { getAdminCatalogData } from "@/lib/content/catalog";

const adminFieldClass =
  "admin-field w-full min-w-0 border border-stroke bg-transparent px-4 py-3 outline-none focus:border-accent";

function centsToPrice(cents: number) {
  return (cents / 100).toFixed(2);
}

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

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <div className="space-y-6">
          <form action={saveProductAction} encType="multipart/form-data" className="panel grid gap-4 p-6">
            <div className="flex items-center justify-between gap-4 border-b border-stroke pb-4">
              <div>
                <p className="label-caps text-accent">Create product</p>
                <h2 className="mt-2 font-serif text-[2rem]">New storefront piece</h2>
              </div>
              <button
                type="submit"
                className="bg-charcoal px-5 py-3 label-caps text-white transition-colors hover:bg-couture-red"
              >
                Save product
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="label-caps text-muted">Name</span>
                <input name="name" className={adminFieldClass} />
              </label>
              <label className="grid gap-2">
                <span className="label-caps text-muted">Slug</span>
                <input name="slug" className={adminFieldClass} />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2">
                <span className="label-caps text-muted">SKU</span>
                <input name="sku" className={adminFieldClass} />
              </label>
              <label className="grid gap-2">
                <span className="label-caps text-muted">Series label</span>
                <input name="seriesLabel" className={adminFieldClass} />
              </label>
              <label className="grid gap-2">
                <span className="label-caps text-muted">Price EUR</span>
                <input
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  className={adminFieldClass}
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="label-caps text-muted">Short description</span>
              <textarea name="shortDescription" rows={3} className={adminFieldClass} />
            </label>

            <label className="grid gap-2">
              <span className="label-caps text-muted">Description</span>
              <textarea name="description" rows={4} className={adminFieldClass} />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="label-caps text-muted">Material line</span>
                <input name="materialLine" className={adminFieldClass} />
              </label>
              <label className="grid gap-2">
                <span className="label-caps text-muted">Product image</span>
                <input name="imageFile" type="file" accept="image/*" className={adminFieldClass} />
              </label>
            </div>

            <div className="grid gap-4">
              <div className="border-t border-stroke pt-4">
                <p className="label-caps text-accent">Product symbolism override</p>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-foreground/60">
                  These fields are optional. If you leave them empty, the product page will use the
                  default symbolism block from the selected collection.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="label-caps text-muted">Symbolism label</span>
                  <input name="symbolismLabel" placeholder="Symbolic Language" className={adminFieldClass} />
                </label>
                <label className="grid gap-2">
                  <span className="label-caps text-muted">Symbolism title</span>
                  <input name="symbolismTitle" placeholder="Wood, Lava, Embroidery" className={adminFieldClass} />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="label-caps text-muted">Symbolism body</span>
                <textarea name="symbolismBody" rows={4} className={adminFieldClass} />
              </label>

              <label className="grid gap-2">
                <span className="label-caps text-muted">Symbolism secondary body</span>
                <textarea name="symbolismBody2" rows={3} className={adminFieldClass} />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2">
                <span className="label-caps text-muted">Category</span>
                <select name="categorySlug" className={adminFieldClass}>
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="label-caps text-muted">Collection</span>
                <select name="collectionSlug" className={adminFieldClass}>
                  <option value="">No collection</option>
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.slug}>
                      {collection.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="label-caps text-muted">Tags</span>
                <input
                  name="tags"
                  placeholder="lava, heritage, symbolic"
                  className={adminFieldClass}
                />
              </label>
            </div>
          </form>

          <div className="grid gap-6 md:grid-cols-2">
            <form action={saveCategoryAction} className="panel grid gap-4 p-6">
              <div>
                <p className="label-caps text-accent">Taxonomy</p>
                <h2 className="mt-2 font-serif text-[1.8rem]">Add category</h2>
              </div>
              <input name="name" placeholder="Bracelets" className={adminFieldClass} />
              <input name="slug" placeholder="bracelets" className={adminFieldClass} />
              <textarea name="description" rows={3} placeholder="What this group means" className={adminFieldClass} />
              <button type="submit" className="w-fit border border-stroke px-4 py-3 label-caps transition-colors hover:border-accent hover:text-accent">
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
              <button type="submit" className="w-fit border border-stroke px-4 py-3 label-caps transition-colors hover:border-accent hover:text-accent">
                Save tag
              </button>
            </form>
          </div>
        </div>

        <div className="panel p-6">
          <p className="label-caps text-muted">Current catalog</p>
          <div className="mt-6 space-y-6">
            {products.map((product) => (
              <details key={product.id} className="border-t border-stroke pt-6">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-serif text-[1.45rem]">{product.name}</p>
                      <p className="text-sm text-foreground/55">/{product.slug}</p>
                    </div>
                    <span className="label-caps text-muted">
                      {centsToPrice(product.priceCents)} EUR
                    </span>
                  </div>
                </summary>

                <form action={saveProductAction} encType="multipart/form-data" className="mt-5 grid gap-4">
                  <input type="hidden" name="productId" value={product.id} />

                  <div className="grid gap-4 md:grid-cols-2">
                    <input name="name" defaultValue={product.name} className={adminFieldClass} />
                    <input name="slug" defaultValue={product.slug} className={adminFieldClass} />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <input name="sku" defaultValue={product.sku} className={adminFieldClass} />
                    <input name="seriesLabel" defaultValue={product.seriesLabel ?? ""} className={adminFieldClass} />
                    <input
                      name="price"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      defaultValue={centsToPrice(product.priceCents)}
                      className={adminFieldClass}
                    />
                  </div>

                  <textarea name="shortDescription" rows={3} defaultValue={product.shortDescription ?? ""} className={adminFieldClass} />
                  <textarea name="description" rows={4} defaultValue={product.description ?? ""} className={adminFieldClass} />

                  <div className="grid gap-4 md:grid-cols-2">
                    <input name="materialLine" defaultValue={product.materialLine ?? ""} className={adminFieldClass} />
                    <div className="grid gap-2">
                      <input type="hidden" name="existingImageUrl" value={product.imageUrl ?? ""} />
                      <input name="imageFile" type="file" accept="image/*" className={adminFieldClass} />
                      {product.imageUrl ? (
                        <div className="flex items-center gap-3 border border-stroke p-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-14 w-14 object-cover"
                          />
                          <div className="space-y-1">
                            <p className="label-caps text-muted">Current image</p>
                            <p className="text-sm text-foreground/60">{product.imageUrl}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-foreground/50">No image uploaded yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 border-t border-stroke pt-4">
                    <div>
                      <p className="label-caps text-accent">Product symbolism override</p>
                      <p className="mt-2 text-sm leading-7 text-foreground/60">
                        Leave these fields empty if this product should inherit the symbolism block
                        from its collection.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <input
                        name="symbolismLabel"
                        defaultValue={product.symbolismLabel ?? ""}
                        placeholder="Symbolic Language"
                        className={adminFieldClass}
                      />
                      <input
                        name="symbolismTitle"
                        defaultValue={product.symbolismTitle ?? ""}
                        placeholder="Wood, Lava, Embroidery"
                        className={adminFieldClass}
                      />
                    </div>

                    <textarea
                      name="symbolismBody"
                      rows={4}
                      defaultValue={product.symbolismBody ?? ""}
                      className={adminFieldClass}
                    />

                    <textarea
                      name="symbolismBody2"
                      rows={3}
                      defaultValue={product.symbolismBody2 ?? ""}
                      className={adminFieldClass}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <select
                      name="categorySlug"
                      defaultValue={product.category?.slug ?? ""}
                      className={adminFieldClass}
                    >
                      <option value="">No category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.slug}>
                          {category.name}
                        </option>
                      ))}
                    </select>

                    <select
                      name="collectionSlug"
                      defaultValue={product.collections[0]?.collection.slug ?? ""}
                      className={adminFieldClass}
                    >
                      <option value="">No collection</option>
                      {collections.map((collection) => (
                        <option key={collection.id} value={collection.slug}>
                          {collection.name}
                        </option>
                      ))}
                    </select>

                    <input
                      name="tags"
                      defaultValue={product.tags.map((item) => item.tag.slug).join(", ")}
                      className={adminFieldClass}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-wrap gap-2">
                      {product.tags.map((item) => (
                        <span
                          key={item.id}
                          className="border border-stroke px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-foreground/60"
                        >
                          {item.tag.name}
                        </span>
                      ))}
                    </div>

                    <button
                      type="submit"
                      className="bg-charcoal px-4 py-3 label-caps text-white transition-colors hover:bg-couture-red"
                    >
                      Update
                    </button>
                  </div>
                </form>
              </details>
            ))}
          </div>

          <div className="mt-8 grid gap-4 border-t border-stroke pt-6 md:grid-cols-2">
            <div>
              <p className="label-caps text-muted">Categories</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {categories.map((category) => (
                  <span
                    key={category.id}
                    className="border border-stroke px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-foreground/60"
                  >
                    {category.name}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="label-caps text-muted">Tags</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="border border-stroke px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-foreground/60"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-stroke pt-6">
            <p className="label-caps text-muted">Collection default symbolism</p>
            <div className="mt-5 space-y-5">
              {collections.map((collection) => (
                <form key={collection.id} action={saveCollectionAction} className="grid gap-4 border-t border-stroke pt-5 first:border-t-0 first:pt-0">
                  <input type="hidden" name="collectionId" value={collection.id} />
                  <input type="hidden" name="slug" value={collection.slug} />

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-serif text-[1.45rem]">{collection.name}</p>
                      <p className="text-sm text-foreground/55">/{collection.slug}</p>
                    </div>
                    <button
                      type="submit"
                      className="border border-stroke px-4 py-3 label-caps transition-colors hover:border-accent hover:text-accent"
                    >
                      Save collection defaults
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="label-caps text-muted">Collection name</span>
                      <input name="name" defaultValue={collection.name} className={adminFieldClass} />
                    </label>
                    <label className="grid gap-2">
                      <span className="label-caps text-muted">Subtitle</span>
                      <input name="subtitle" defaultValue={collection.subtitle ?? ""} className={adminFieldClass} />
                    </label>
                  </div>

                  <label className="grid gap-2">
                    <span className="label-caps text-muted">Description</span>
                    <textarea name="description" rows={3} defaultValue={collection.description ?? ""} className={adminFieldClass} />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="label-caps text-muted">Default symbolism label</span>
                      <input
                        name="symbolismLabel"
                        defaultValue={collection.symbolismLabel ?? ""}
                        placeholder="Symbolic Language"
                        className={adminFieldClass}
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="label-caps text-muted">Default symbolism title</span>
                      <input
                        name="symbolismTitle"
                        defaultValue={collection.symbolismTitle ?? ""}
                        placeholder="Wood, Lava, Embroidery"
                        className={adminFieldClass}
                      />
                    </label>
                  </div>

                  <label className="grid gap-2">
                    <span className="label-caps text-muted">Default symbolism body</span>
                    <textarea
                      name="symbolismBody"
                      rows={4}
                      defaultValue={collection.symbolismBody ?? ""}
                      className={adminFieldClass}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="label-caps text-muted">Default symbolism secondary body</span>
                    <textarea
                      name="symbolismBody2"
                      rows={3}
                      defaultValue={collection.symbolismBody2 ?? ""}
                      className={adminFieldClass}
                    />
                  </label>
                </form>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
