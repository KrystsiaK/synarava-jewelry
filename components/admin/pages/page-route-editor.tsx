"use client";

import { useRouter } from "next/navigation";

import { CreatePageForm } from "@/components/admin/pages/page-create-form";
import { PageEditor } from "@/components/admin/pages/page-editor-form";
import type { SavedPagePayload } from "@/app/admin/actions/pages";
import type { HomeEditProductOption } from "@/components/admin/pages/page-editor-form";

export function PageCreateRoute() {
  const router = useRouter();

  return (
    <CreatePageForm
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
}: {
  page: SavedPagePayload;
  productOptions?: HomeEditProductOption[];
}) {
  const router = useRouter();

  return (
    <PageEditor
      page={page}
      productOptions={productOptions}
      onUpdated={() => router.refresh()}
    />
  );
}
