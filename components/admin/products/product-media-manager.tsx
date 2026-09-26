"use client";

import { useRef, useTransition } from "react";
import Image from "next/image";

import {
  moveProductMediaAction,
  removeProductMediaAction,
  setPrimaryProductMediaAction,
  type ProductMediaActionState,
} from "@/app/admin/actions/products";
import { AdminFieldIssue } from "@/components/admin/issues/admin-issues-cms";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import type { AdminIssueSummary } from "@/components/admin/shared/admin-issue-types";
import { issuesForField } from "@/components/admin/products/product-helpers";
import type { ProductRecord } from "@/components/admin/products/product-types";
import { mediaFramesFromProductSnapshots } from "@/lib/shopify/shopify-snapshot-media";

export function ProductMediaManager({
  product,
  onChange,
  ensureProduct,
  issues = [],
}: {
  product: ProductRecord | null;
  onChange: (product: ProductRecord) => void;
  ensureProduct?: () => Promise<ProductRecord | null>;
  issues?: AdminIssueSummary[];
}) {
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const { pushToast } = useAdminToast();
  const coverIssues = issuesForField(issues, "field-imageUrl");
  const hasCoverIssues = coverIssues.length > 0;
  const shopifyFrames = product
    ? mediaFramesFromProductSnapshots({
      shopifySnapshot: product.shopifySnapshot,
      workingSnapshot: product.workingSnapshot,
    })
    : [];

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
        const formData = new FormData();
        formData.set("productId", targetProduct.id);
        formData.set("alt", file.name.replace(/\.[^.]+$/, ""));
        formData.set("file", file);
        const response = await fetch("/admin/api/products/media", { method: "POST", body: formData });
        const result = await response.json() as ProductMediaActionState;
        if (!response.ok && !result.error) result.error = "Gallery upload failed.";
        apply(result);
        if (result.product) targetProduct = result.product;
        if (result.error) break;
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function mutate(action: () => Promise<ProductMediaActionState>) {
    startTransition(async () => apply(await action()));
  }

  return (
    <section
      id="field-imageUrl"
      data-component="ProductMediaManager"
      className={`grid gap-4 border p-4 ${
        hasCoverIssues ? "border-[var(--adm-danger)]" : "border-[var(--adm-border)]"
      }`}
      style={
        hasCoverIssues
          ? { background: "color-mix(in srgb, var(--adm-field) 92%, var(--adm-danger) 8%)" }
          : undefined
      }
      aria-label="Product gallery"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="adm-label">Product gallery</p>
          <p className="mt-1 text-xs text-[var(--adm-muted)]">
            Upload up to 250 images. Position 1 is the catalog cover and is sent first to Shopify.
          </p>
          <AdminFieldIssue issues={coverIssues} />
        </div>
        <label className={`adm-btn-ghost ${pending ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
          {pending ? "Uploading…" : "Add images"}
          <input ref={inputRef} type="file" accept="image/*" multiple className="sr-only" onChange={(event) => upload(event.target.files)} disabled={pending} />
        </label>
      </div>
      {product?.media.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {product.media.map((item, index) => {
            const primary = product.primaryAssetId === item.assetId;
            return (
              <article key={item.id} className="grid gap-3 border border-[var(--adm-border)] p-3">
                <div className="relative aspect-square overflow-hidden bg-[var(--adm-bg-soft)]">
                  <Image src={item.url} alt={item.alt || product.name} fill sizes="(max-width: 640px) 100vw, 320px" className="object-cover" />
                  <span className="absolute left-2 top-2 bg-[var(--adm-ink)] px-2 py-1 text-[0.62rem] font-bold uppercase tracking-wider text-[var(--adm-bg)]">{primary ? "01 · Cover" : String(index + 1).padStart(2, "0")}</span>
                </div>
                <p className="truncate text-xs text-[var(--adm-muted)]">{item.alt || `Image ${index + 1}`}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="adm-btn-ghost min-h-9 px-3" disabled={pending || index === 0} onClick={() => mutate(() => moveProductMediaAction(item.id, -1))}>←</button>
                  <button type="button" className="adm-btn-ghost min-h-9 px-3" disabled={pending || index === product.media.length - 1} onClick={() => mutate(() => moveProductMediaAction(item.id, 1))}>→</button>
                  {!primary ? <button type="button" className="adm-btn-ghost min-h-9 px-3" disabled={pending} onClick={() => mutate(() => setPrimaryProductMediaAction(item.id))}>Move to first</button> : null}
                  <button type="button" className="adm-btn-danger min-h-9 px-3" disabled={pending} onClick={() => mutate(() => removeProductMediaAction(item.id))}>Remove</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : shopifyFrames.length > 0 ? (
        <div className="grid gap-3">
          <p className="rounded-lg border border-[var(--adm-border)] bg-[var(--adm-bg)] p-3 text-xs text-[var(--adm-muted)]">
            These images live on Shopify. The storefront already uses them. Synarava has no local gallery rows yet —
            use Sync → Pull to align commerce snapshots, or Add images here to upload Synarava-managed files (Push sends those to Shopify).
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shopifyFrames.map((frame, index) => (
              <article key={frame.id ?? frame.url} className="grid gap-3 border border-[var(--adm-border)] p-3">
                <div className="relative aspect-square overflow-hidden bg-[var(--adm-bg-soft)]">
                  <Image src={frame.url} alt={frame.alt || product?.name || "Shopify image"} fill sizes="(max-width: 640px) 100vw, 320px" className="object-cover" />
                  <span className="absolute left-2 top-2 bg-[var(--adm-ink)] px-2 py-1 text-[0.62rem] font-bold uppercase tracking-wider text-[var(--adm-bg)]">
                    {index === 0 ? "01 · Shopify" : String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <p className="truncate text-xs text-[var(--adm-muted)]">{frame.alt}</p>
              </article>
            ))}
          </div>
        </div>
      ) : product?.imageUrl ? (
        <article className="grid max-w-sm gap-3 border border-[var(--adm-border)] p-3">
          <div className="relative aspect-square overflow-hidden bg-[var(--adm-bg-soft)]">
            <Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 640px) 100vw, 320px" className="object-cover" />
            <span className="absolute left-2 top-2 bg-[var(--adm-ink)] px-2 py-1 text-[0.62rem] font-bold uppercase tracking-wider text-[var(--adm-bg)]">01 · Cover</span>
          </div>
          <p className="text-xs text-[var(--adm-muted)]">
            Legacy cover image. Upload to the gallery to manage ordering, or keep this cover until the next gallery upload replaces it.
          </p>
        </article>
      ) : (
        <p className="text-sm text-[var(--adm-muted)]">No gallery images yet. Add images to build the product gallery.</p>
      )}
    </section>
  );
}
