"use client";

import { useRouter } from "next/navigation";

import {
  CreateProductForm,
  EditProductForm,
} from "@/components/admin/products-cms";
import type {
  SavedCategoryPayload,
  SavedProductPayload,
} from "@/app/admin/actions";

type CollectionOption = { id: string; slug: string; name: string };

export function ProductCreateRoute({
  categories,
  collections,
}: {
  categories: SavedCategoryPayload[];
  collections: CollectionOption[];
}) {
  const router = useRouter();

  return (
    <CreateProductForm
      categories={categories}
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
  categories,
  collections,
}: {
  product: SavedProductPayload;
  categories: SavedCategoryPayload[];
  collections: CollectionOption[];
}) {
  const router = useRouter();

  return (
    <EditProductForm
      product={product}
      categories={categories}
      collections={collections}
      onUpdated={() => router.refresh()}
      onDeleted={() => {
        router.push("/admin/products");
        router.refresh();
      }}
    />
  );
}
