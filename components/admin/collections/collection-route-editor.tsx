"use client";

import { useRouter } from "next/navigation";

import { CreateCollectionForm } from "@/components/admin/collections/collection-create-form";
import { EditCollectionForm } from "@/components/admin/collections/collection-edit-form";
import type { SavedCollectionPayload } from "@/app/admin/actions/collections";

export function CollectionCreateRoute() {
  const router = useRouter();

  return (
    <CreateCollectionForm
      onCreated={(collection) => {
        router.push(`/admin/collections/${collection.id}`);
        router.refresh();
      }}
    />
  );
}

export function CollectionEditRoute({
  collection,
}: {
  collection: SavedCollectionPayload;
}) {
  const router = useRouter();

  return (
    <EditCollectionForm
      collection={collection}
      onUpdated={() => router.refresh()}
      onDeleted={() => {
        router.push("/admin/collections");
        router.refresh();
      }}
    />
  );
}
