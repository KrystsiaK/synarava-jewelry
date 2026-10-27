import { LanguagesPanel } from "@/components/admin/translations/languages-panel";
import { requireAdminSession } from "@/lib/auth/admin-session";
import {
  findDuplicateRouteSegments,
  findEnglishSourceViolation,
  listStorefrontLocales,
} from "@/lib/i18n/storefront-locale-registry";
import { hasWriteLocalesScope } from "@/lib/shopify/locale-mutations";

export default async function AdminTranslationsPage() {
  await requireAdminSession();
  const [locales, hasWriteLocales] = await Promise.all([
    listStorefrontLocales(),
    hasWriteLocalesScope().catch(() => false),
  ]);

  return (
    <div className="space-y-7">
      <header>
        <h1 className="adm-page-title">Translations</h1>
        <p className="adm-page-subtitle">
          Manage languages: add, hide, restore, export, or import a language bundle. Import always
          shows a preview before anything is written. Resolve Shopify field differences on the
          Catalog, Collections, Pages, or Shared section that owns the field.
        </p>
      </header>
      <LanguagesPanel
        locales={locales}
        duplicateSegments={findDuplicateRouteSegments(locales)}
        sourceViolation={findEnglishSourceViolation(locales)}
        hasWriteLocales={hasWriteLocales}
      />
    </div>
  );
}
