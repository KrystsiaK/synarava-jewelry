"use client";

import { useRouter } from "next/navigation";

import {
  CreateProductForm,
  EditProductForm,
} from "@/components/admin/products/products-cms";
import type { SavedProductPayload } from "@/app/admin/actions/products";
import type { AdminIssueSummary } from "@/components/admin/shared/admin-issue-types";

type CollectionOption = { id: string; slug: string; name: string };

export function ProductCreateRoute({
  collections,
}: {
  collections: CollectionOption[];
}) {
  const router = useRouter();

  return (
    <CreateProductForm
      collections={collections}
      onCreated={(product) => {
        router.push(`/admin/products/${product.id}`);
        router.refresh();
      }}
    />
  );
}

export function ProductEditRoute({
  product,
  collections,
  issues = [],
}: {
  product: SavedProductPayload;
  collections: CollectionOption[];
  issues?: AdminIssueSummary[];
}) {
  const router = useRouter();

  return (
    <EditProductForm
      product={product}
      collections={collections}
      issues={issues}
      onUpdated={() => router.refresh()}
      onDeleted={() => {
        router.push("/admin/products");
        router.refresh();
      }}
    />
  );
}
