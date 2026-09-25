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

/**
 * Survives `router.refresh()` remounts. Soft refresh can remount this client
 * route with a stale RSC `page` (empty product slots) even though the save
 * already wrote products — a plain useState reset would wipe the UI until a
 * hard reload. Keep the newest save payload at module scope for this page id.
 */
const savedPageById = new Map<string, SavedPagePayload>();

/** Test-only: drop cached save payloads between cases. */
export function clearAdminPageSaveCache() {
  savedPageById.clear();
}

function resolveInitialPage(serverPage: SavedPagePayload): SavedPagePayload {
  const cached = savedPageById.get(serverPage.id);
  if (cached && pageUpdatedAtMs(cached) >= pageUpdatedAtMs(serverPage)) {
    return cached;
  }
  return serverPage;
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
  const [page, setPage] = useState(() => resolveInitialPage(serverPage));
  const serverUpdatedAt = pageUpdatedAtMs(serverPage);
  const [seenServerUpdatedAt, setSeenServerUpdatedAt] = useState(serverUpdatedAt);
  if (serverUpdatedAt !== seenServerUpdatedAt) {
    setSeenServerUpdatedAt(serverUpdatedAt);
    setPage(resolveInitialPage(serverPage));
  }

  return (
    <PageEditor
      page={page}
      productOptions={productOptions}
      collectionOptions={collectionOptions}
      translationLocales={translationLocales}
      onUpdated={(saved) => {
        savedPageById.set(saved.id, saved);
        setPage(saved);
        refreshPreservingScroll(router);
      }}
    />
  );
}
