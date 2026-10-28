"use client";

import { useTransition } from "react";

import {
  moveProductMediaAction,
  removeProductMediaAction,
  setPrimaryProductMediaAction,
  updateProductMediaAltAction,
  type ProductMediaActionState,
} from "@/app/admin/actions/products";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import type { ProductRecord } from "@/components/admin/products/product-types";
import {
  AdminMediaGallery,
  type AdminMediaGalleryItem,
} from "@/components/synarava-cms";
import {
  galleryFrameId,
  galleryFramePreviewUrl,
  parseLocalAssetId,
  readGalleryFrames,
  seedFramesFromLocalRows,
  validateGalleryUploadFile,
} from "@/lib/products/gallery";

function unifiedGalleryItems(product: ProductRecord): AdminMediaGalleryItem[] {
  const tree = readGalleryFrames(product.extras, product.shopifySnapshot);
  const frames =
    tree.length > 0
      ? tree
      : seedFramesFromLocalRows(
          (product.media ?? []).map((item) => ({
            assetId: item.assetId,
            alt: item.alt,
            url: item.url,
            width: item.width,
            height: item.height,
          })),
        );

  return frames.flatMap((node) => {
    const id = galleryFrameId(node);
    const url = galleryFramePreviewUrl(node);
    if (!id || !url) return [];
    const alt =
      node && typeof node === "object" && !Array.isArray(node) && typeof (node as { alt?: unknown }).alt === "string"
        ? (node as { alt: string }).alt
        : "";
    return [{
      id,
      url,
      alt,
      pendingUpload: Boolean(parseLocalAssetId(id)),
    }];
  });
}

export function ProductMediaManager({
  product,
  onChange,
  ensureProduct,
}: {
  product: ProductRecord | null;
  onChange: (product: ProductRecord) => void;
  ensureProduct?: () => Promise<ProductRecord | null>;
}) {
  const [pending, startTransition] = useTransition();
  const { pushToast } = useAdminToast();
  const items = product ? unifiedGalleryItems(product) : [];

  function apply(result: ProductMediaActionState) {
    if (result.error) pushToast({ message: result.error, tone: "error" });
    if (result.success) pushToast({ message: result.success, tone: "success" });
    if (result.product) onChange(result.product);
  }

  function upload(files: FileList | null) {
    if (!files?.length) return;
    startTransition(async () => {
      let targetProduct = product ?? await ensureProduct?.() ?? null;
      if (!targetProduct) {
        pushToast({ message: "The draft could not be created. Try again.", tone: "error" });
        return;
      }
      for (const file of Array.from(files)) {
        const clientError = validateGalleryUploadFile(file);
        if (clientError) {
          pushToast({ message: `${file.name}: ${clientError}`, tone: "error" });
          continue;
        }
        const formData = new FormData();
        formData.set("productId", targetProduct.id);
        formData.set("file", file);
        const response = await fetch("/admin/api/products/media", { method: "POST", body: formData });
        const result = await response.json() as ProductMediaActionState;
        if (!response.ok && !result.error) result.error = "Gallery upload failed.";
        if (result.error) {
          pushToast({ message: `${file.name}: ${result.error}`, tone: "error" });
          if (result.product) {
            onChange(result.product);
            targetProduct = result.product;
          }
          continue;
        }
        apply(result);
        if (result.product) targetProduct = result.product;
      }
    });
  }

  function mutate(action: () => Promise<ProductMediaActionState>) {
    startTransition(async () => apply(await action()));
  }

  return (
    <div id="field-imageUrl" data-component="ProductMediaManager">
      <AdminMediaGallery
        items={items}
        disabled={pending}
        description={
          <>
            Upload up to 250 images. Position 1 is the catalog cover. Gallery lives in the OUR commerce tree
            (`extras.media`); uploads and removes write through there for conflict detect. Remove drops
            a frame locally; Push omits it from Shopify so the remote media is deleted. Descriptive alt text is
            part of the publish checklist (Shopify <code className="text-[0.7rem]">MEDIA_IMAGE.alt</code>).
          </>
        }
        onAdd={(files) => upload(files)}
        onMove={(frameId, toIndex) => {
          if (!product) return;
          mutate(() => moveProductMediaAction(product.id, frameId, toIndex));
        }}
        onRemove={(frameId) => {
          if (!product) return;
          mutate(() => removeProductMediaAction(product.id, frameId));
        }}
        onSetCover={(frameId) => {
          if (!product) return;
          mutate(() => setPrimaryProductMediaAction(product.id, frameId));
        }}
        onAlt={(frameId, alt) => {
          if (!product) return;
          mutate(() => updateProductMediaAltAction(product.id, frameId, alt));
        }}
      />
    </div>
  );
}
