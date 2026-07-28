import { PageEditRoute } from "@/components/admin/page-route-editor";
import { getAdminCatalogData } from "@/lib/content/catalog";

export default async function AdminHomePage() {
  const { pages } = await getAdminCatalogData();
  const page = pages.find((item) => item.slug === "home");
  if (!page) return null;

  return <EditorialPage title="Home" description="Control the storefront hero, call to action, and featured editorial copy." page={page} />;
}

function EditorialPage({ title, description, page }: { title: string; description: string; page: NonNullable<Awaited<ReturnType<typeof getAdminCatalogData>>>["pages"][number] }) {
  return <div className="space-y-8"><div><p className="adm-section-tag mb-3">[ SYN-ADM // {title.toUpperCase()} ]</p><h1 className="adm-page-title">{title}</h1><p className="adm-page-subtitle">{description}</p></div><PageEditRoute page={page} /></div>;
}
