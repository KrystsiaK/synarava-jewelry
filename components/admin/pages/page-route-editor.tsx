"use client";

import { useRouter } from "next/navigation";

import { CreatePageForm } from "@/components/admin/pages/page-create-form";
import { PageEditor } from "@/components/admin/pages/page-editor-form";
import type { SavedPagePayload } from "@/app/admin/actions/pages";
import type { HomeEditProductOption } from "@/components/admin/pages/page-editor-form";
import type { AdminTranslationLocale } from "@/lib/i18n/admin-translation-locales";

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
  page,
  productOptions,
  translationLocales,
}: {
  page: SavedPagePayload;
  productOptions?: HomeEditProductOption[];
  translationLocales: AdminTranslationLocale[];
}) {
  const router = useRouter();

  return (
    <PageEditor
      page={page}
      productOptions={productOptions}
      translationLocales={translationLocales}
      onUpdated={() => router.refresh()}
    />
  );
}
