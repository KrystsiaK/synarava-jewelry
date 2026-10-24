import { LanguagesPanel } from "@/components/admin/translations/languages-panel";
import { TranslationsSyncSummary } from "@/components/admin/translations/translations-sync-summary";
import { requireAdminSession } from "@/lib/auth/admin-session";
import {
  findDuplicateRouteSegments,
  findEnglishSourceViolation,
  listStorefrontLocales,
} from "@/lib/i18n/storefront-locale-registry";
import { hasWriteLocalesScope } from "@/lib/shopify/locale-mutations";
import { runSyncWaterfall, selectAdminNavSyncCounts } from "@/lib/sync";

export default async function AdminTranslationsPage() {
  const session = await requireAdminSession();
  const [locales, hasWriteLocales, waterfall] = await Promise.all([
    listStorefrontLocales(),
    hasWriteLocalesScope().catch(() => false),
    runSyncWaterfall({
      scope: { kind: "catalog" },
      requestedBy: session.username,
      skipRefresh: true,
    }).catch(() => null),
  ]);

  const counts = waterfall
    ? selectAdminNavSyncCounts(waterfall.result)
    : selectAdminNavSyncCounts({
        checkedAt: null,
        state: "disconnected",
        leaves: [],
        recentlyUpdatedProducts: {},
      });

  return (
    <div className="space-y-7">
      <header>
        <h1 className="adm-page-title">Translations</h1>
        <p className="adm-page-subtitle">
          Manage languages and see where Synarava and Shopify differ. Choose Keep ours or Take Shopify
          on the product, collection, or page that owns the field.
        </p>
      </header>
      <LanguagesPanel
        locales={locales}
        duplicateSegments={findDuplicateRouteSegments(locales)}
        sourceViolation={findEnglishSourceViolation(locales)}
        hasWriteLocales={hasWriteLocales}
      />
      <TranslationsSyncSummary
        counts={counts}
        checkedAt={waterfall?.result.checkedAt ?? null}
        state={waterfall?.result.state ?? "disconnected"}
      />
    </div>
  );
}
