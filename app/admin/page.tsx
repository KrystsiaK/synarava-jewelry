import Link from "next/link";

import { getAdminCatalogData } from "@/lib/content/catalog";

export default async function AdminDashboardPage() {
  const { pages, products, categories, tags, collections } = await getAdminCatalogData();

  const stats = [
    { label: "Pages", value: pages.length, href: "/admin/pages" },
    { label: "Products", value: products.length, href: "/admin/products" },
    { label: "Categories", value: categories.length, href: "/admin/products" },
    { label: "Tags", value: tags.length, href: "/admin/products" },
    { label: "Collections", value: collections.length, href: "/admin/collections" },
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <p className="label-caps text-accent">Overview</p>
        <h1 className="font-serif text-[3rem] leading-none md:text-[4rem]">Synarava admin</h1>
        <p className="max-w-2xl text-lg leading-8 text-foreground/68">
          Internal control room for storefront content. Pages, products, categories, tags, and the
          linked discovery logic all live off the same data model now.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="panel p-6 transition-colors hover:border-accent">
            <p className="label-caps text-muted">{stat.label}</p>
            <p className="mt-4 font-serif text-[2.5rem]">{stat.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="panel p-6">
          <p className="label-caps text-muted">Recent pages</p>
          <div className="mt-5 space-y-4">
            {pages.map((page) => (
              <div key={page.id} className="flex items-center justify-between border-t border-stroke pt-4">
                <div>
                  <p className="font-serif text-[1.35rem]">{page.title}</p>
                  <p className="text-sm text-foreground/55">/{page.slug}</p>
                </div>
                <Link href="/admin/pages" className="label-caps text-accent">
                  Edit
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-6">
          <p className="label-caps text-muted">Recent products</p>
          <div className="mt-5 space-y-4">
            {products.slice(0, 5).map((product) => (
              <div key={product.id} className="flex items-center justify-between border-t border-stroke pt-4">
                <div>
                  <p className="font-serif text-[1.35rem]">{product.name}</p>
                  <p className="text-sm text-foreground/55">/{product.slug}</p>
                </div>
                <Link href={`/products/${product.slug}`} className="label-caps text-accent">
                  View
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
