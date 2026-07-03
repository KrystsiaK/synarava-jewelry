"use client";

import { useRouter } from "next/navigation";

import { CreatePageForm, PageEditor } from "@/components/admin/pages-cms";
import type { SavedPagePayload } from "@/app/admin/actions";

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
}: {
  page: SavedPagePayload;
}) {
  const router = useRouter();

  return (
    <PageEditor
      page={page}
      onUpdated={() => router.refresh()}
    />
  );
}
