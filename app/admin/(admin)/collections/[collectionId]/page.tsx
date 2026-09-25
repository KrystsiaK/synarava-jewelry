import Link from "next/link";

import { CollectionEditRoute } from "@/components/admin/collections/collection-route-editor";
import { getAdminCatalogData } from "@/lib/content/catalog";
import { getAdminTranslationLocales } from "@/lib/i18n/admin-translation-locales";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";
import { getCollectionConflictSignals } from "@/lib/shopify/catalog-conflict-signals-server";

export default async function EditCollectionPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = await params;
  const [{ collections, issues }, conflictSignals, translationLocales] = await Promise.all([
    getAdminCatalogData(),
    getCollectionConflictSignals().catch((error): CatalogConflictSignals => {
      console.error("[admin/collections/edit] conflict signals failed", error);
      return {
        state: "failed",
        totalCount: null,
        checkedAt: null,
        products: {},
        recentlyUpdatedProducts: {},
      };
    }),
    getAdminTranslationLocales(),
  ]);
  const collection = collections.find((item) => item.id === collectionId);
  const collectionIssues = issues.filter(
    (issue) => issue.entityType === "COLLECTION" && issue.entityId === collectionId,
  );

  if (!collection) {
    return (
      <div className="space-y-8">
        <div>
          <p className="adm-section-tag mb-3">[ SYN-ADM // COL // MISSING ]</p>
          <h1 className="adm-page-title">Collection not found</h1>
          <p className="adm-page-subtitle">
            The collection may have been deleted or the edit URL is no longer valid.
          </p>
        </div>
        <Link href="/admin/collections" className="adm-btn-primary">
          Back to collections
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // COL // EDIT ]</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="adm-page-title">{collection.name}</h1>
            <p className="adm-page-subtitle">
              Edit one collection record. Products remain separate catalog records.
            </p>
          </div>
          <Link href="/admin/collections" className="adm-btn-ghost">
            Back to collections
          </Link>
        </div>
      </div>

      <CollectionEditRoute
        collection={collection}
        translationLocales={translationLocales}
        issues={collectionIssues}
        initialConflictSignals={conflictSignals}
      />
    </div>
  );
}
