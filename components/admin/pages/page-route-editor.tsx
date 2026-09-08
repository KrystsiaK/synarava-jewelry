"use client";

import { useRouter } from "next/navigation";

import { CreatePageForm } from "@/components/admin/pages/page-create-form";
import { PageEditor } from "@/components/admin/pages/page-editor-form";
import type { SavedPagePayload } from "@/app/admin/actions/pages";

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
