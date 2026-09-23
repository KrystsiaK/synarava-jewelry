import { LocaleRegistryPanel } from "@/components/admin/translations/locale-registry-panel";
import { TranslationsCms } from "@/components/admin/translations/translations-cms";
import {
  findDuplicateRouteSegments,
  findEnglishSourceViolation,
  listStorefrontLocales,
} from "@/lib/i18n/storefront-locale-registry";
import { db } from "@/lib/db";
import {
  getLatestReconcileDifferences,
  getLatestReconcileRun,
} from "@/lib/shopify/reconciliation-run";

type PageProps = {
  searchParams?: Promise<{ entityType?: string; entityId?: string; locale?: string }>;
};

export default async function AdminTranslationsPage({ searchParams }: PageProps) {
  const requested = await searchParams;
  const [run, differences, pages, locales] = await Promise.all([
    getLatestReconcileRun(),
    getLatestReconcileDifferences(),
    db.page.findMany({ select: { id: true, slug: true } }),
    listStorefrontLocales(),
  ]);
  const pageSlugs = new Map(pages.map((page) => [page.id, page.slug]));

  const rows = differences.map((difference) => {
    let href = "/admin/settings";
    if (difference.rootEntityType === "PRODUCT") href = `/admin/products/${difference.rootEntityId}`;
    if (difference.rootEntityType === "COLLECTION") href = `/admin/collections/${difference.rootEntityId}`;
    if (difference.rootEntityType === "PAGE") {
      const slug = pageSlugs.get(difference.rootEntityId);
      href = `/admin/pages/${slug ?? difference.rootEntityId}`;
    }
    return { ...difference, href };
  }).filter((difference) =>
    (!requested?.entityType || difference.rootEntityType === requested.entityType)
    && (!requested?.entityId || difference.rootEntityId === requested.entityId)
    && (!requested?.locale || difference.locale === requested.locale),
  );

  return (
    <div className="space-y-7">
      <header>
        <h1 className="adm-page-title">Shopify sync</h1>
        <p className="adm-page-subtitle">
          Review only the translated fields that differ. Nothing is changed until you choose which version to keep.
        </p>
      </header>
      <LocaleRegistryPanel
        locales={locales}
        duplicateSegments={findDuplicateRouteSegments(locales)}
        sourceViolation={findEnglishSourceViolation(locales)}
      />
      <TranslationsCms initialRun={run} differences={rows} />
    </div>
  );
}
