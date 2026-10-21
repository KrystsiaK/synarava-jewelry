"use client";

import { useRouter } from "next/navigation";

import { CreateProductForm } from "@/components/admin/products/product-create-form";
import { EditProductForm } from "@/components/admin/products/product-edit-form";
import type { SavedProductPayload } from "@/app/admin/actions/products";
import type { CollectionOption } from "@/components/admin/products/product-types";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";
import type { AdminTranslationLocale } from "@/lib/i18n/admin-translation-locales";
import { refreshPreservingScroll } from "@/lib/admin/preserve-scroll";

export function ProductCreateRoute({
  collections,
  translationLocales,
}: {
  collections: CollectionOption[];
  translationLocales: AdminTranslationLocale[];
}) {
  const router = useRouter();

  return (
    <CreateProductForm
      collections={collections}
      translationLocales={translationLocales}
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
  translationLocales,
  initialConflictSignals,
}: {
  product: SavedProductPayload;
  collections: CollectionOption[];
  translationLocales: AdminTranslationLocale[];
  initialConflictSignals?: CatalogConflictSignals;
}) {
  const router = useRouter();

  return (
    <EditProductForm
      product={product}
      collections={collections}
      translationLocales={translationLocales}
      initialConflictSignals={initialConflictSignals}
      onUpdated={() => refreshPreservingScroll(router)}
      onDeleted={() => {
        router.push("/admin/products");
        router.refresh();
      }}
    />
  );
}
