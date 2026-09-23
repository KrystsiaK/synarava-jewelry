"use client";

import { ArrowDownToLine, ArrowUpFromLine, Check, Clock3, HardDriveUpload, RefreshCw, TriangleAlert } from "lucide-react";

import { AnimatedModal } from "@/components/ui/animated-modal";
import { Tooltip } from "@/components/ui/tooltip";
import type { ProductSyncInspection } from "@/lib/shopify/product-sync";
import { centsToPrice } from "@/components/admin/products/product-helpers";
import type { ProductRecord } from "@/components/admin/products/product-types";

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
  const label = pending ? "Saving product…" : "Save product locally. Shopify does not change until you push.";
  const button = (
    <button
      data-component="SaveButtons"
      type="button"
      onClick={onOpenConfirm}
      disabled={pending}
      className={
        iconOnly
          ? "adm-btn-ghost grid size-12 place-items-center p-0"
          : "adm-btn-primary"
      }
      aria-label={pending ? "Saving product" : "Save product"}
    >
      {iconOnly ? (
        pending ? (
          <RefreshCw className="size-7 animate-spin" strokeWidth={2.75} aria-hidden="true" />
        ) : (
          <HardDriveUpload className="size-7" strokeWidth={2.75} aria-hidden="true" />
        )
      ) : pending ? (
        "Saving..."
      ) : (
        "Save product"
      )}
    </button>
  );

  if (!iconOnly) return button;
  return <Tooltip content={label}>{button}</Tooltip>;
}

function syncPresentation(product: ProductRecord, dirty: boolean, inspection: ProductSyncInspection | null) {
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
  const actionable = syncState === "UNLINKED"
    || syncState === "LOCAL_CHANGES"
    || syncState === "REMOTE_CHANGES"
    || syncState === "CONFLICT"
    || syncState === "REMOTE_MISSING";
  const actionLabel = syncState === "UNLINKED"
    ? "Create in Shopify"
    : syncState === "LOCAL_CHANGES"
      ? "Push to Shopify"
      : syncState === "REMOTE_CHANGES"
        ? "Pull update"
        : syncState === "CONFLICT"
          ? "Resolve conflict"
          : "Review";
  return { syncState, healthy, failed, stateLabel, stateDescription, actionable, actionLabel };
}

export function ProductSyncStrip({ product, dirty, inspection, pending, onCheck, onOpenDetail }: {
  product: ProductRecord;
  dirty: boolean;
  inspection: ProductSyncInspection | null;
  pending: boolean;
  onCheck: () => void;
  onOpenDetail: () => void;
}) {
  const { healthy, failed, stateLabel, stateDescription, actionable, actionLabel } =
    syncPresentation(product, dirty, inspection);
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

  return (
    <section data-component="ProductSyncStrip" className="grid gap-4 border bg-[var(--adm-bg-soft)] p-4" style={{ borderColor: "var(--adm-border)" }} aria-label="Commerce synchronization">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-[var(--adm-accent)] text-[var(--adm-accent)]"><Icon className="size-4" /></span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{stateLabel}</p>
              <span className={healthy ? "adm-badge-published" : "adm-badge-draft"}>{stateLabel}</span>
            </div>
            <p className="mt-1 max-w-3xl text-xs text-[var(--adm-subtle)]">
              {product.syncError ?? stateDescription}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {product.shopifyProductId ? (
            <button
              type="button"
              className="adm-btn-ghost inline-flex items-center justify-center gap-2"
              onClick={onCheck}
              disabled={pending || dirty}
              aria-label="Check Shopify"
              title="Check Shopify"
            >
              <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
            </button>
          ) : null}
          {actionable ? (
            <button
              type="button"
              className={failed ? "adm-btn-danger inline-flex items-center justify-center gap-2" : "adm-btn-secondary inline-flex items-center justify-center gap-2"}
              onClick={onOpenDetail}
              disabled={pending || dirty}
            >
              {actionLabel}
            </button>
          ) : null}
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
          <p className="mt-2 text-xs font-semibold text-[var(--adm-ink)]">{product.lastSyncedAt ? new Date(product.lastSyncedAt).toLocaleString() : "Never"}</p>
          <p className="mt-1 text-xs text-[var(--adm-muted)]">{product.shopifyUpdatedAt ? `Shopify updated ${new Date(product.shopifyUpdatedAt).toLocaleString()}` : "No Shopify timestamp yet"}</p>
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

export function ProductSyncDetailModal({ open, onClose, product, dirty, inspection, pending, onPull, onPush, onResolve }: {
  open: boolean;
  onClose: () => void;
  product: ProductRecord;
  dirty: boolean;
  inspection: ProductSyncInspection | null;
  pending: boolean;
  onPull: () => void;
  onPush: () => void;
  onResolve: (resolution: "shopify" | "synarava") => void;
}) {
  const { syncState, stateLabel, stateDescription } = syncPresentation(product, dirty, inspection);
  const canPush = !dirty && product.variants.length > 0 && (syncState === "LOCAL_CHANGES" || syncState === "UNLINKED");
  // A linked Shopify product can always be refreshed. Timestamp equality only
  // means no remote edit was detected; it does not guarantee that a newer
  // local projection (for example shopifySnapshot) has already been hydrated.
  // The server action still blocks destructive pulls when saved local commerce
  // changes or a conflict are present.
  const canPull = !dirty && Boolean(product.shopifyProductId) && syncState !== "REMOTE_MISSING";
  const pullLabel = syncState === "REMOTE_CHANGES" ? "Pull Shopify update" : "Refresh from Shopify";

  return (
    <AnimatedModal
      open={open}
      onClose={onClose}
      className="adm-panel pointer-events-auto grid max-h-[85vh] w-full max-w-2xl gap-4 overflow-y-auto p-6"
      portalClassName="admin-modal-root"
      zIndexClassName="z-[200]"
      backdropZIndexClassName="z-[190]"
      ariaLabel="Resolve Shopify commerce sync"
    >
      <div>
        <p className="adm-section-tag">[ COMMERCE SYNC — {stateLabel.toUpperCase()} ]</p>
        <p className="mt-2 text-xs text-[var(--adm-muted)]">{product.syncError ?? stateDescription}</p>
      </div>

      <div className="flex flex-wrap gap-2 border-y border-[var(--adm-border)] py-4">
        <button type="button" className="adm-btn-ghost inline-flex items-center justify-center gap-2" onClick={onPull} disabled={pending || !canPull}>
          <ArrowDownToLine className="size-4" />
          {pending ? "Refreshing..." : pullLabel}
        </button>
        <button type="button" className="adm-btn-secondary inline-flex items-center justify-center gap-2" onClick={onPush} disabled={pending || !canPush}>
          <ArrowUpFromLine className="size-4" />
          {pending ? "Syncing..." : product.variants.length === 0 ? "Save core fields first" : product.shopifyProductId ? "Push to Shopify" : "Create in Shopify"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="adm-section-tag">Shopify-backed commerce core</p>
          <p className="mt-2 text-xs leading-5 text-[var(--adm-muted)]">Name, handle, base description, primary image, status, publication, and primary SKU/price/inventory can be pushed. Shopify variant IDs, all variants, and their inventory are pulled back as the confirmed commerce state.</p>
        </div>
        <div>
          <p className="adm-section-tag">Synarava CMS layer</p>
          <p className="mt-2 text-xs leading-5 text-[var(--adm-muted)]">Additional photography, category and collection curation, symbolism, materials, process story, lookbook, and site search presentation stay local and survive every Shopify pull.</p>
        </div>
      </div>

      {inspection && inspection.differences.length > 0 ? (
        <div className="border-t border-[var(--adm-border)] pt-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="adm-section-tag">Changed commerce fields ({inspection.differences.length})</p>
              <p className="mt-1 text-xs text-[var(--adm-muted)]">
                {syncState === "LOCAL_CHANGES"
                  ? "These Synarava values will be pushed to Shopify."
                  : syncState === "REMOTE_CHANGES"
                    ? "These Shopify values will be pulled into Synarava."
                    : "Only Shopify-backed fields are compared. Synarava CMS fields are excluded."}
              </p>
            </div>
            {syncState === "CONFLICT" ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="adm-btn-ghost" disabled={pending} onClick={() => onResolve("shopify")}>Use Shopify version</button>
                <button type="button" className="adm-btn-secondary" disabled={pending} onClick={() => onResolve("synarava")}>Keep Synarava and push</button>
              </div>
            ) : null}
          </div>
          <div className="mt-3 overflow-x-auto">
            <div className="grid min-w-[30rem] grid-cols-[minmax(8rem,1fr)_minmax(8rem,1fr)_minmax(8rem,1fr)] gap-3 px-2 pb-2 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[var(--adm-subtle)]">
              <span>Field</span>
              <span className={syncState === "LOCAL_CHANGES" ? "text-[var(--adm-accent)]" : undefined}>
                Synarava{syncState === "LOCAL_CHANGES" ? " → wins" : ""}
              </span>
              <span className={syncState === "REMOTE_CHANGES" ? "text-[var(--adm-accent)]" : undefined}>
                Shopify{syncState === "REMOTE_CHANGES" ? " → wins" : ""}
              </span>
            </div>
            {inspection.differences.map((difference) => (
              <div key={difference.field} className="grid min-w-[30rem] grid-cols-[minmax(8rem,1fr)_minmax(8rem,1fr)_minmax(8rem,1fr)] gap-3 border-t border-[var(--adm-border)] px-2 py-2 text-xs text-[var(--adm-muted)]">
                <span className="font-semibold text-[var(--adm-ink)]">{difference.field}</span>
                <span className="break-words">{difference.local}</span>
                <span className="break-words">{difference.shopify}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </AnimatedModal>
  );
}
