"use client";

import { HardDriveUpload, RefreshCw } from "lucide-react";

import { useAdminShopifyCheckRunning } from "@/components/admin/translations/admin-shopify-check-context";
import { AdminButton, AdminIconButton, AdminStatusBadge } from "@/components/synarava-cms";
import type { ProductSyncInspection } from "@/lib/shopify/product-sync";
import { centsToPrice } from "@/components/admin/products/product-helpers";
import type { ProductRecord } from "@/components/admin/products/product-types";
import { formatAdminDateTime } from "@/lib/format/admin-date";
import type { CatalogConflictProductSignal } from "@/lib/shopify/catalog-conflict-signals";
import { needsSkuAssignment } from "@/lib/sku/pending-sku";

export function ProgressBar({ pending }: { pending: boolean }) {
  if (!pending) return null;

  return (
    <div data-component="ProgressBar" className="adm-progress-bar" role="progressbar" aria-label="Saving product">
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
  iconOnly = false,
}: {
  onOpenConfirm: () => void;
  pending: boolean;
  iconOnly?: boolean;
}) {
  const checkRunning = useAdminShopifyCheckRunning();
  const blocked = pending || checkRunning;
  const label = pending
    ? "Saving product…"
    : checkRunning
      ? "Shopify check in progress. Save is paused until it finishes."
      : "Save product locally. Shopify does not change until you push.";

  if (iconOnly) {
    return (
      <span data-component="SaveButtons">
        <AdminIconButton
          label={pending ? "Saving product" : checkRunning ? "Save paused" : "Save product"}
          tooltip={label}
          disabled={blocked}
          onClick={onOpenConfirm}
        >
          {pending ? (
            <RefreshCw className="size-3.5 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : (
            <HardDriveUpload className="size-3.5" strokeWidth={2} aria-hidden="true" />
          )}
        </AdminIconButton>
      </span>
    );
  }

  return (
    <AdminButton
      data-component="SaveButtons"
      variant="primary"
      busy={pending}
      disabled={blocked}
      onClick={onOpenConfirm}
      aria-label={pending ? "Saving product" : checkRunning ? "Save paused" : "Save product"}
    >
      {pending ? "Saving..." : "Save product"}
    </AdminButton>
  );
}

export function ProductShopifyHeader({
  product,
  signal,
  conflictCount,
  dirty,
  pending,
  onPush,
  onResolve,
}: {
  product: ProductRecord;
  signal?: CatalogConflictProductSignal;
  conflictCount: number;
  dirty: boolean;
  pending: boolean;
  onPush: () => void;
  onResolve: () => void;
}) {
  const presence = signal?.presence;
  const status = presence === "SHOPIFY_ONLY"
    ? "Only in Shopify"
    : presence === "SYNARAVA_ONLY" || !product.shopifyProductId
      ? "Only in Synarava"
      : conflictCount > 0
        ? `${conflictCount} conflict${conflictCount === 1 ? "" : "s"}`
        : "In sync";
  const action = presence === "SHOPIFY_ONLY"
    ? { label: "Pull", run: onResolve }
    : presence === "SYNARAVA_ONLY" && product.shopifyProductId
      ? { label: "Resolve", run: onResolve }
      : !product.shopifyProductId
        ? { label: "Create in Shopify", run: onPush }
        : conflictCount > 0
          ? { label: "Resolve", run: onResolve }
          : product.syncStatus === "PENDING" || product.syncStatus === "FAILED"
            ? { label: "Push", run: onPush }
            : null;
  const sku = product.variants[0]?.sku ?? product.sku;
  const disabledReason = dirty
    ? "Save changes first"
    : action?.run === onPush && product.variants.length === 0
      ? "Save core fields first"
      : action?.run === onPush && needsSkuAssignment(sku)
        ? "SKU required"
        : null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2" data-component="ProductShopifyHeader">
      <AdminStatusBadge tone={status === "In sync" ? "published" : conflictCount > 0 ? "error" : "pending"}>
        {status}
      </AdminStatusBadge>
      {action ? (
        <AdminButton
          variant={conflictCount > 0 ? "primary" : "secondary"}
          busy={pending}
          disabled={pending || Boolean(disabledReason)}
          onClick={action.run}
        >
          {action.label}
        </AdminButton>
      ) : null}
      {disabledReason ? <span className="text-xs text-[var(--adm-danger)]">{disabledReason}</span> : null}
    </div>
  );
}

export function ProductSyncStrip({ product, inspection }: {
  product: ProductRecord;
  inspection: ProductSyncInspection | null;
}) {
  const totalStock = product.variants.reduce((sum, variant) => sum + variant.stockOnHand, 0);
  const shopifyPublications = inspection?.publications ?? [];
  const storefrontState = product.status === "ACTIVE" && product.visibility === "PUBLIC"
    ? "Published"
    : product.status === "UNLISTED" && product.visibility === "UNLISTED"
      ? "Unlisted · direct link"
    : product.status === "ARCHIVED"
      ? "Archived"
      : "Draft / hidden";

  return (
    <section data-component="ProductSyncStrip" className="grid gap-4 border bg-[var(--adm-bg-soft)] p-4" style={{ borderColor: "var(--adm-border)" }} aria-label="Commerce synchronization">
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
          <p className="adm-section-tag">Site state</p>
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
          <p className="mt-2 text-xs font-semibold text-[var(--adm-ink)]">{product.lastSyncedAt ? formatAdminDateTime(product.lastSyncedAt) : "Never"}</p>
          <p className="mt-1 text-xs text-[var(--adm-muted)]">{product.shopifyUpdatedAt ? `Shopify updated ${formatAdminDateTime(product.shopifyUpdatedAt)}` : "No Shopify timestamp yet"}</p>
        </div>
      </div>

      {product.variants.length > 0 ? (
        <div className="overflow-x-auto pt-1">
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
