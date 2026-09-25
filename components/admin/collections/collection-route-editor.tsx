"use client";

import { useRouter } from "next/navigation";

import { CreateCollectionForm } from "@/components/admin/collections/collection-create-form";
import { EditCollectionForm } from "@/components/admin/collections/collection-edit-form";
import type { SavedCollectionPayload } from "@/app/admin/actions/collections";
import type { AdminIssueSummary } from "@/components/admin/shared/admin-issue-types";
import type { AdminTranslationLocale } from "@/lib/i18n/admin-translation-locales";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";
import { refreshPreservingScroll } from "@/lib/admin/preserve-scroll";

export function CollectionCreateRoute({ translationLocales }: { translationLocales: AdminTranslationLocale[] }) {
  const router = useRouter();

  return (
    <CreateCollectionForm
      translationLocales={translationLocales}
      onCreated={(collection) => {
        router.push(`/admin/collections/${collection.id}`);
        router.refresh();
      }}
    />
  );
}

export function CollectionEditRoute({
  collection,
  translationLocales,
  issues = [],
  initialConflictSignals,
}: {
  collection: SavedCollectionPayload;
  translationLocales: AdminTranslationLocale[];
  issues?: AdminIssueSummary[];
  initialConflictSignals?: CatalogConflictSignals;
}) {
  const router = useRouter();

  return (
    <EditCollectionForm
      collection={collection}
      translationLocales={translationLocales}
      issues={issues}
      initialConflictSignals={initialConflictSignals}
      onUpdated={() => refreshPreservingScroll(router)}
      onDeleted={() => {
        router.push("/admin/collections");
        router.refresh();
      }}
    />
  );
}
