"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { CreatePageForm } from "@/components/admin/pages/page-create-form";
import { PageEditor } from "@/components/admin/pages/page-editor-form";
import type { SavedPagePayload } from "@/app/admin/actions/pages";
import type { HomeArchiveCollectionOption, HomeEditProductOption } from "@/components/admin/pages/page-editor-form";
import type { AdminTranslationLocale } from "@/lib/i18n/admin-translation-locales";
import { refreshPreservingScroll } from "@/lib/admin/preserve-scroll";

function pageUpdatedAtMs(page: Pick<SavedPagePayload, "updatedAt">) {
  return new Date(page.updatedAt).getTime();
}

export function PageCreateRoute({ translationLocales }: { translationLocales: AdminTranslationLocale[] }) {
  const router = useRouter();

  return (
    <CreatePageForm
      translationLocales={translationLocales}
      onCreated={(page) => {
        router.push(`/admin/pages/${page.slug}`);
        router.refresh();
      }}
    />
  );
}

export function PageEditRoute({
  page: serverPage,
  productOptions,
  collectionOptions,
  translationLocales,
}: {
  page: SavedPagePayload;
  productOptions?: HomeEditProductOption[];
  collectionOptions?: HomeArchiveCollectionOption[];
  translationLocales: AdminTranslationLocale[];
}) {
  const router = useRouter();
  // Apply the save payload immediately so Product showcase / Final CTA slots
  // rehydrate before (or without) a fresh RSC round-trip. Soft refresh alone
  // can briefly keep the pre-save page, which wiped selections until a hard reload.
  const [page, setPage] = useState(serverPage);
  const serverUpdatedAt = pageUpdatedAtMs(serverPage);
  const [seenServerUpdatedAt, setSeenServerUpdatedAt] = useState(serverUpdatedAt);
  if (serverUpdatedAt !== seenServerUpdatedAt) {
    setSeenServerUpdatedAt(serverUpdatedAt);
    if (serverUpdatedAt >= pageUpdatedAtMs(page)) {
      setPage(serverPage);
    }
  }

  return (
    <PageEditor
      page={page}
      productOptions={productOptions}
      collectionOptions={collectionOptions}
      translationLocales={translationLocales}
      onUpdated={(saved) => {
        setPage(saved);
        refreshPreservingScroll(router);
      }}
    />
  );
}
