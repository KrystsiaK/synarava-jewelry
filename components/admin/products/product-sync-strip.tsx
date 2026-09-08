"use client";

import { ArrowDownToLine, ArrowUpFromLine, Check, Clock3, RefreshCw, TriangleAlert } from "lucide-react";

import type { ProductSyncInspection } from "@/lib/shopify/product-sync";
import { centsToPrice } from "@/components/admin/products/product-helpers";
import type { ProductRecord } from "@/components/admin/products/product-types";

export function ProgressBar({ pending }: { pending: boolean }) {
  if (!pending) return null;

  return (
    <div className="adm-progress-bar" role="progressbar" aria-label="Saving product">
      <div
        className={[
          "adm-progress-fill",
          pending ? "adm-progress-fill--active" : "",
        ].join(" ")}
      />
    </div>
  );
}

export function SaveButtons({
  onOpenConfirm,
  pending,
}: {
  onOpenConfirm: () => void;
  pending: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpenConfirm}
      disabled={pending}
      className="adm-btn-primary"
    >
      {pending ? "Saving..." : "Save product"}
    </button>
  );
}

export function ProductSyncStrip({ product, dirty, inspection, pending, onCheck, onPull, onPush, onResolve }: {
  product: ProductRecord;
  dirty: boolean;
  inspection: ProductSyncInspection | null;
  pending: boolean;
  onCheck: () => void;
  onPull: () => void;
  onPush: () => void;
  onResolve: (resolution: "shopify" | "synarava") => void;
}) {
  const fallbackState: ProductSyncInspection["state"] = product.shopifyProductId
    ? product.syncStatus === "PENDING" || product.syncStatus === "FAILED"
      ? "LOCAL_CHANGES"
      : product.syncStatus === "CONFLICT"
        ? "CONFLICT"
        : "SYNCED"
    : "UNLINKED";
  const syncState = dirty ? "UNSAVED" : inspection?.state ?? fallbackState;
  const healthy = syncState === "SYNCED";
  const failed = syncState === "CONFLICT" || syncState === "REMOTE_MISSING" || product.syncStatus === "FAILED";
  const Icon = healthy ? Check : failed ? TriangleAlert : Clock3;
  const totalStock = product.variants.reduce((sum, variant) => sum + variant.stockOnHand, 0);
  const shopifyPublications = inspection?.publications ?? [];
  const storefrontState = product.status === "ACTIVE" && product.visibility === "PUBLIC"
    ? "Published"
    : product.status === "UNLISTED" && product.visibility === "UNLISTED"
      ? "Unlisted · direct link"
    : product.status === "ARCHIVED"
      ? "Archived"
      : "Draft / hidden";
  const stateLabel = syncState === "UNSAVED"
    ? "Unsaved changes"
    : syncState === "LOCAL_CHANGES"
      ? "Ready to push"
      : syncState === "REMOTE_CHANGES"
        ? "Shopify update available"
        : syncState === "CONFLICT"
          ? "Conflict needs a decision"
          : syncState === "REMOTE_MISSING"
            ? "Shopify product missing"
            : syncState === "UNLINKED"
              ? "Not connected to Shopify"
              : "Shopify commerce core synced";
  const stateDescription = syncState === "UNSAVED"
    ? "Save locally before Push or Pull. Unsaved form values will never be overwritten."
    : syncState === "LOCAL_CHANGES"
      ? "Local commerce changes are saved and ready. Shopify has not been changed yet."
      : syncState === "REMOTE_CHANGES"
        ? "Shopify has newer commerce data. Pull applies it while preserving the Synarava CMS layer."
        : syncState === "CONFLICT"
          ? "Saved commerce changes exist on both sides. Choose which version should win."
          : syncState === "REMOTE_MISSING"
            ? "The linked Shopify product could not be found. No automatic action was taken."
            : syncState === "UNLINKED"
              ? "This local product has not been linked. Its first push creates the Shopify commerce record."
              : "Shopify commerce data matches the last confirmed local state. Synarava CMS content remains local.";
  const canPush = !dirty && product.variants.length > 0 && (syncState === "LOCAL_CHANGES" || syncState === "UNLINKED");
  // A linked Shopify product can always be refreshed. Timestamp equality only
  // means no remote edit was detected; it does not guarantee that a newer
  // local projection (for example shopifySnapshot) has already been hydrated.
  // The server action still blocks destructive pulls when saved local commerce
  // changes or a conflict are present.
  const canPull = !dirty && Boolean(product.shopifyProductId) && syncState !== "REMOTE_MISSING";
  const pullLabel = syncState === "REMOTE_CHANGES" ? "Pull Shopify update" : "Refresh from Shopify";
  return (
    <section className="grid gap-4 border bg-[var(--adm-bg-soft)] p-4" style={{ borderColor: "var(--adm-border)" }} aria-label="Commerce synchronization">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-[var(--adm-accent)] text-[var(--adm-accent)]"><Icon className="size-4" /></span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{stateLabel}</p>
              <span className={healthy ? "adm-badge-published" : "adm-badge-draft"}>{syncState}</span>
            </div>
            <p className="mt-1 max-w-3xl text-xs text-[var(--adm-subtle)]">
              {product.syncError ?? stateDescription}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {product.shopifyProductId ? (
            <button type="button" className="adm-btn-ghost inline-flex items-center justify-center gap-2" onClick={onCheck} disabled={pending || dirty}>
              <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
              Check Shopify
            </button>
          ) : null}
          <button type="button" className="adm-btn-ghost inline-flex items-center justify-center gap-2" onClick={onPull} disabled={pending || !canPull}>
            <ArrowDownToLine className="size-4" />
            {pending ? "Refreshing..." : pullLabel}
          </button>
          <button type="button" className="adm-btn-secondary inline-flex items-center justify-center gap-2" onClick={onPush} disabled={pending || !canPush}>
            <ArrowUpFromLine className="size-4" />
            {pending ? "Syncing..." : product.variants.length === 0 ? "Save core fields first" : product.shopifyProductId ? "Push to Shopify" : "Create in Shopify"}
          </button>
        </div>
      </div>

      <div className="grid border-y border-[var(--adm-border)] sm:grid-cols-2 xl:grid-cols-4">
        <div className="py-3 sm:pr-4 xl:border-r xl:border-[var(--adm-border)]">
          <p className="adm-section-tag">Shopify link</p>
          <p className="mt-2 break-all text-xs font-semibold text-[var(--adm-ink)]">{product.shopifyProductId ?? "Not linked"}</p>
          <p className="mt-1 text-xs text-[var(--adm-muted)]">{product.shopifyHandle ? `/${product.shopifyHandle}` : "A Shopify ID will appear after the first push."}</p>
        </div>
        <div className="border-t border-[var(--adm-border)] py-3 sm:border-l sm:border-t-0 sm:px-4 xl:border-l-0 xl:border-r">
          <p className="adm-section-tag">Available quantity</p>
          <p className="mt-2 text-lg font-semibold text-[var(--adm-ink)]">{totalStock}</p>
          <p className="mt-1 text-xs text-[var(--adm-muted)]">Across {product.variants.length} variant{product.variants.length === 1 ? "" : "s"}</p>
        </div>
        <div className="border-t border-[var(--adm-border)] py-3 sm:pr-4 xl:border-r xl:border-t-0 xl:px-4">
          <p className="adm-section-tag">Storefront state</p>
          <p className="mt-2 text-sm font-semibold text-[var(--adm-ink)]">{storefrontState}</p>
          <p className="mt-1 text-xs text-[var(--adm-muted)]">
            {product.shopifyProductId
              ? shopifyPublications.length > 0
                ? `Shopify: ${shopifyPublications.join(", ")}`
                : inspection ? "Shopify: no active publication" : "Checking Shopify publications…"
              : "Not created in Shopify yet"}
          </p>
        </div>
        <div className="border-t border-[var(--adm-border)] py-3 sm:border-l sm:pl-4 xl:border-l-0 xl:border-t-0">
          <p className="adm-section-tag">Last confirmed sync</p>
          <p className="mt-2 text-xs font-semibold text-[var(--adm-ink)]">{product.lastSyncedAt ? new Date(product.lastSyncedAt).toLocaleString() : "Never"}</p>
          <p className="mt-1 text-xs text-[var(--adm-muted)]">{product.shopifyUpdatedAt ? `Shopify updated ${new Date(product.shopifyUpdatedAt).toLocaleString()}` : "No Shopify timestamp yet"}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div>
          <p className="adm-section-tag">Shopify-backed commerce core</p>
          <p className="mt-2 text-xs leading-5 text-[var(--adm-muted)]">Name, handle, base description, primary image, status, publication, and primary SKU/price/inventory can be pushed. Shopify variant IDs, all variants, and their inventory are pulled back as the confirmed commerce state.</p>
        </div>
        <div>
          <p className="adm-section-tag">Synarava CMS layer</p>
          <p className="mt-2 text-xs leading-5 text-[var(--adm-muted)]">Additional photography, category and collection curation, symbolism, materials, process story, lookbook, and storefront search presentation stay local and survive every Shopify pull.</p>
        </div>
      </div>

      {inspection && inspection.differences.length > 0 && (syncState === "REMOTE_CHANGES" || syncState === "CONFLICT") ? (
        <div className="border-t border-[var(--adm-border)] pt-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="adm-section-tag">Changed commerce fields ({inspection.differences.length})</p>
              <p className="mt-1 text-xs text-[var(--adm-muted)]">Only Shopify-backed fields are compared. Synarava CMS fields are excluded.</p>
            </div>
            {syncState === "CONFLICT" ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="adm-btn-ghost" disabled={pending} onClick={() => onResolve("shopify")}>Use Shopify version</button>
                <button type="button" className="adm-btn-secondary" disabled={pending} onClick={() => onResolve("synarava")}>Keep Synarava and push</button>
              </div>
            ) : null}
          </div>
          <div className="mt-3 overflow-x-auto">
            <div className="grid min-w-[34rem] grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(10rem,1fr)] gap-3 px-2 pb-2 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[var(--adm-subtle)]">
              <span>Field</span><span>Synarava</span><span>Shopify</span>
            </div>
            {inspection.differences.map((difference) => (
              <div key={difference.field} className="grid min-w-[34rem] grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(10rem,1fr)] gap-3 border-t border-[var(--adm-border)] px-2 py-2 text-xs text-[var(--adm-muted)]">
                <span className="font-semibold text-[var(--adm-ink)]">{difference.field}</span>
                <span className="break-words">{difference.local}</span>
                <span className="break-words">{difference.shopify}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {product.variants.length > 0 ? (
        <div className="overflow-x-auto border-t border-[var(--adm-border)] pt-3">
          <div className="grid min-w-[46rem] grid-cols-[minmax(10rem,1fr)_8rem_7rem_7rem_7rem_8rem] gap-3 px-2 pb-2 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[var(--adm-subtle)]">
            <span>Variant</span><span>SKU</span><span>Price</span><span>Compare at</span><span>Available</span><span>Shopify</span>
          </div>
          {product.variants.map((variant) => (
            <div key={variant.id} className="grid min-w-[46rem] grid-cols-[minmax(10rem,1fr)_8rem_7rem_7rem_7rem_8rem] gap-3 border-t border-[var(--adm-border)] px-2 py-2 text-xs text-[var(--adm-muted)]">
              <span className="font-semibold text-[var(--adm-ink)]">{variant.title}</span>
              <span>{variant.sku}</span>
              <span>{centsToPrice(variant.priceCents)} EUR</span>
              <span>{variant.compareAtCents == null ? "—" : `${centsToPrice(variant.compareAtCents)} EUR`}</span>
              <span>{variant.stockOnHand}</span>
              <span>{variant.shopifyVariantId ? "Linked" : "Local only"}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--adm-danger)]">No commerce variant exists. Enter the available quantity and save the product to create its primary variant before synchronization.</p>
      )}
    </section>
  );
}
