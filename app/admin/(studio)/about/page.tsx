import { PageEditRoute } from "@/components/admin/page-route-editor";
import { getAdminCatalogData } from "@/lib/content/catalog";

export default async function AdminAboutPage() {
  const { pages } = await getAdminCatalogData();
  const page = pages.find((item) => item.slug === "about");
  if (!page) return null;

  return <div className="space-y-8"><div><p className="adm-section-tag mb-3">[ SYN-ADM // ABOUT ]</p><h1 className="adm-page-title">About</h1><p className="adm-page-subtitle">Control the studio story, call to action, manifesto copy, and hero media.</p></div><PageEditRoute page={page} /></div>;
}
