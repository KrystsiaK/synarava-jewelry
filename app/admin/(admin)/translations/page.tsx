import { LanguagesPanel } from "@/components/admin/translations/languages-panel";
import { TranslationsCms } from "@/components/admin/translations/translations-cms";
import {
  findDuplicateRouteSegments,
  findEnglishSourceViolation,
  listStorefrontLocales,
} from "@/lib/i18n/storefront-locale-registry";
import { RETIRED_PAGE_SLUGS } from "@/lib/content/built-in-pages";
import { db } from "@/lib/db";
import { hasWriteLocalesScope } from "@/lib/shopify/locale-mutations";
import {
  getLatestReconcileDifferences,
  getLatestReconcileRun,
} from "@/lib/shopify/reconciliation-run";

type PageProps = {
  searchParams?: Promise<{ entityType?: string; entityId?: string; locale?: string }>;
};

export default async function AdminTranslationsPage({ searchParams }: PageProps) {
  const requested = await searchParams;
  const [run, differences, pages, locales, hasWriteLocales] = await Promise.all([
    getLatestReconcileRun(),
    getLatestReconcileDifferences(),
    db.page.findMany({
      where: { slug: { notIn: [...RETIRED_PAGE_SLUGS] } },
      select: { id: true, slug: true },
    }),
    listStorefrontLocales(),
    hasWriteLocalesScope().catch(() => false),
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
        <h1 className="adm-page-title">Translations</h1>
        <p className="adm-page-subtitle">
          Compare Synarava and Shopify translations, then choose which side wins for each difference.
        </p>
      </header>
      <LanguagesPanel
        locales={locales}
        duplicateSegments={findDuplicateRouteSegments(locales)}
        sourceViolation={findEnglishSourceViolation(locales)}
        hasWriteLocales={hasWriteLocales}
      />
      <TranslationsCms initialRun={run} differences={rows} />
    </div>
  );
}
