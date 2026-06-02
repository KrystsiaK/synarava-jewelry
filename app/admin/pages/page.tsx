import { savePageAction } from "@/app/admin/actions";
import { getAdminCatalogData } from "@/lib/content/catalog";

export default async function AdminPagesPage() {
  const { pages } = await getAdminCatalogData();

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <p className="label-caps text-accent">Pages</p>
        <h1 className="font-serif text-[3rem] leading-none md:text-[4rem]">Edit home and about</h1>
        <p className="max-w-2xl text-lg leading-8 text-foreground/68">
          Minimal page CMS for the key editorial routes. Right now it covers the storefront text
          layer for home, about, and manifesto.
        </p>
      </header>

      <div className="grid gap-6">
        {pages.map((page) => {
          const content = (page.content ?? {}) as Record<string, string | undefined>;

          return (
            <form key={page.id} action={savePageAction} className="panel grid gap-5 p-6">
              <input type="hidden" name="slug" value={page.slug} />

              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke pb-4">
                <div>
                  <p className="label-caps text-accent">/{page.slug}</p>
                  <h2 className="mt-2 font-serif text-[2rem]">{page.title}</h2>
                </div>
                <button
                  type="submit"
                  className="bg-charcoal px-5 py-3 label-caps text-white transition-colors hover:bg-couture-red"
                >
                  Save page
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="label-caps text-muted">Title</span>
                  <input
                    name="title"
                    defaultValue={page.title}
                    className="border border-stroke bg-transparent px-4 py-3 outline-none transition-colors focus:border-accent"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="label-caps text-muted">Eyebrow</span>
                  <input
                    name="eyebrow"
                    defaultValue={content.eyebrow ?? ""}
                    className="border border-stroke bg-transparent px-4 py-3 outline-none transition-colors focus:border-accent"
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="label-caps text-muted">Excerpt</span>
                <textarea
                  name="excerpt"
                  defaultValue={page.excerpt ?? ""}
                  rows={3}
                  className="border border-stroke bg-transparent px-4 py-3 outline-none transition-colors focus:border-accent"
                />
              </label>

              <label className="grid gap-2">
                <span className="label-caps text-muted">Body</span>
                <textarea
                  name="body"
                  defaultValue={content.body ?? ""}
                  rows={5}
                  className="border border-stroke bg-transparent px-4 py-3 outline-none transition-colors focus:border-accent"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="label-caps text-muted">CTA label</span>
                  <input
                    name="ctaLabel"
                    defaultValue={content.ctaLabel ?? ""}
                    className="border border-stroke bg-transparent px-4 py-3 outline-none transition-colors focus:border-accent"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="label-caps text-muted">CTA href</span>
                  <input
                    name="ctaHref"
                    defaultValue={content.ctaHref ?? ""}
                    className="border border-stroke bg-transparent px-4 py-3 outline-none transition-colors focus:border-accent"
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="label-caps text-muted">Quote</span>
                <textarea
                  name="quote"
                  defaultValue={content.quote ?? ""}
                  rows={4}
                  className="border border-stroke bg-transparent px-4 py-3 outline-none transition-colors focus:border-accent"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="label-caps text-muted">Secondary title</span>
                  <input
                    name="secondaryTitle"
                    defaultValue={content.secondaryTitle ?? ""}
                    className="border border-stroke bg-transparent px-4 py-3 outline-none transition-colors focus:border-accent"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="label-caps text-muted">Secondary body</span>
                  <textarea
                    name="secondaryBody"
                    defaultValue={content.secondaryBody ?? ""}
                    rows={3}
                    className="border border-stroke bg-transparent px-4 py-3 outline-none transition-colors focus:border-accent"
                  />
                </label>
              </div>
            </form>
          );
        })}
      </div>
    </div>
  );
}
