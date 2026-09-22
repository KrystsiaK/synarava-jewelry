import { PageEditRoute } from "@/components/admin/pages/page-route-editor";
import { getAdminCatalogData } from "@/lib/content/catalog";
import { getAdminTranslationLocales } from "@/lib/i18n/admin-translation-locales";

export default async function AdminAboutPage() {
  const [{ pages }, translationLocales] = await Promise.all([
    getAdminCatalogData(),
    getAdminTranslationLocales(),
  ]);
  const page = pages.find((item) => item.slug === "about");
  if (!page) return null;

  return <div className="space-y-8"><div><p className="adm-section-tag mb-3">[ SYN-ADM // ABOUT ]</p><h1 className="adm-page-title">About</h1><p className="adm-page-subtitle">Control the brand story, call to action, manifesto copy, and hero media.</p></div><PageEditRoute page={page} translationLocales={translationLocales} /></div>;
}
