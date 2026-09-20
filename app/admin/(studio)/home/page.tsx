import { PageEditRoute } from "@/components/admin/pages/page-route-editor";
import { getAdminCatalogData } from "@/lib/content/catalog";

export default async function AdminHomePage() {
  const { pages, products } = await getAdminCatalogData();
  const page = pages.find((item) => item.slug === "home");
  if (!page) return null;

  const productOptions = products
    .filter((product) => product.status === "ACTIVE" && product.visibility === "PUBLIC")
    .map((product) => ({ id: product.id, title: product.name, slug: product.slug }));

  return <EditorialPage title="Home" description="Control section visibility, localized editorial copy, calls to action, and contact details across the storefront home page." page={page} productOptions={productOptions} />;
}

function EditorialPage({ title, description, page, productOptions }: { title: string; description: string; page: NonNullable<Awaited<ReturnType<typeof getAdminCatalogData>>>["pages"][number]; productOptions: Array<{ id: string; title: string; slug: string }> }) {
  return <div className="space-y-8"><div><p className="adm-section-tag mb-3">[ SYN-ADM // {title.toUpperCase()} ]</p><h1 className="adm-page-title">{title}</h1><p className="adm-page-subtitle">{description}</p></div><PageEditRoute page={page} productOptions={productOptions} /></div>;
}
