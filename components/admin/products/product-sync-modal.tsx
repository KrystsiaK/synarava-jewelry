"use client";

import { useState, useTransition } from "react";
import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, ChevronUp } from "lucide-react";

import {
  inspectProductSyncAction,
  pullSingleProductFromShopifyAction,
  pushSingleProductToShopifyAction,
} from "@/app/admin/actions/sync";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { AnimatedModal } from "@/components/ui/animated-modal";
import type { ProductRecord } from "@/components/admin/products/product-types";
import type { ProductSyncInspection, ShopifyReconciliationPreview } from "@/lib/shopify/product-sync";

type RemoteItem = ShopifyReconciliationPreview["remote"][number];
type InspectionCacheEntry =
  | { status: "loading" }
  | { status: "ready"; inspection: ProductSyncInspection }
  | { status: "error"; message: string };

export function ProductSyncModal({
  open,
  onClose,
  preview,
  pending,
  selectedRemoteIds,
  setSelectedRemoteIds,
  selectedLocalIds,
  setSelectedLocalIds,
  selectedArchiveIds,
  setSelectedArchiveIds,
  toggleSelection,
  runSync,
  confirmSync,
  confirmArchive,
  onResolved,
}: {
  open: boolean;
  onClose: () => void;
  preview: ShopifyReconciliationPreview | null;
  pending: boolean;
  selectedRemoteIds: string[];
  setSelectedRemoteIds: (ids: string[]) => void;
  selectedLocalIds: string[];
  setSelectedLocalIds: (ids: string[]) => void;
  selectedArchiveIds: string[];
  setSelectedArchiveIds: (ids: string[]) => void;
  toggleSelection: (id: string, selected: string[], setSelected: (ids: string[]) => void) => void;
  runSync: (remoteProductIds: string[], localProductIds: string[]) => void;
  confirmSync: (remoteProductIds: string[], localProductIds: string[], title: string) => void;
  confirmArchive: (productIds: string[]) => void;
  onResolved: (shopifyProductId: string, product?: ProductRecord) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inspections, setInspections] = useState<Record<string, InspectionCacheEntry>>({});
  const [isResolving, startResolving] = useTransition();
  const { pushToast } = useAdminToast();

  if (!preview) return null;

  const actionableRemote = preview.remote.filter((item) => item.action !== "UP_TO_DATE");

  function toggleExpand(item: RemoteItem) {
    const key = item.shopifyProductId;
    const opening = expandedId !== key;
    setExpandedId(opening ? key : null);
    if (opening && item.action === "CONFLICT" && item.localProductId && !inspections[key]) {
      setInspections((current) => ({ ...current, [key]: { status: "loading" } }));
      void inspectProductSyncAction(item.localProductId).then((result) => {
        setInspections((current) => ({
          ...current,
          [key]: result.inspection
            ? { status: "ready", inspection: result.inspection }
            : { status: "error", message: result.error ?? "Could not load the Shopify comparison." },
        }));
      });
    }
  }

  function resolve(item: RemoteItem, choice: "synarava" | "shopify") {
    if (!item.localProductId) return;
    const localProductId = item.localProductId;
    startResolving(async () => {
      const result = choice === "synarava"
        ? await pushSingleProductToShopifyAction(localProductId, true)
        : await pullSingleProductFromShopifyAction(localProductId, true);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) {
        pushToast({ message: result.success, tone: "success" });
        onResolved(item.shopifyProductId, result.product);
        setExpandedId(null);
      }
    });
  }

  return (
    <AnimatedModal
      open={open}
      onClose={onClose}
      className="adm-panel pointer-events-auto grid max-h-[85vh] w-full max-w-4xl gap-4 overflow-y-auto p-6"
      portalClassName="admin-modal-root"
      zIndexClassName="z-[200]"
      backdropZIndexClassName="z-[190]"
      ariaLabel="Resolve Shopify sync conflicts"
    >
      <div className="flex flex-col gap-3 border-b border-[var(--adm-border)] pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="adm-section-tag">[ SYNC PREVIEW — READY FOR REVIEW ]</p>
          <p className="mt-2 text-xs text-[var(--adm-muted)]">
            Shopify webhooks pull changes automatically. An action appears only while the local copy still differs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="adm-btn-secondary"
            disabled={pending || selectedRemoteIds.length + selectedLocalIds.length === 0}
            onClick={() => confirmSync(selectedRemoteIds, selectedLocalIds, "Sync selected products")}
          >
            Sync selected ({selectedRemoteIds.length + selectedLocalIds.length})
          </button>
          <button
            type="button"
            className="adm-btn-primary"
            disabled={pending || (preview.remote.every((item) => item.action === "CONFLICT" || item.action === "UP_TO_DATE") && preview.pushToShopify.length === 0)}
            onClick={() => confirmSync(
              preview.remote.filter((item) => item.action !== "CONFLICT" && item.action !== "UP_TO_DATE").map((item) => item.shopifyProductId),
              preview.pushToShopify.map((item) => item.productId),
              "Apply all previewed catalog changes",
            )}
          >
            {pending ? "Applying..." : "Apply all changes"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="adm-label">From Shopify ({actionableRemote.length})</p>
            <button
              type="button"
              className="adm-btn-ghost min-h-8 px-2 py-1 text-[0.62rem]"
              disabled={pending || preview.remote.every((item) => item.action === "CONFLICT" || item.action === "UP_TO_DATE")}
              onClick={() => confirmSync(
                preview.remote.filter((item) => item.action !== "CONFLICT" && item.action !== "UP_TO_DATE").map((item) => item.shopifyProductId),
                [],
                "Import all Shopify changes",
              )}
            >
              Import all
            </button>
          </div>
          <div className="mt-2 grid gap-2">
            {actionableRemote.length === 0 ? (
              <p className="text-[var(--adm-muted)]">Nothing to review — every matched product is already synced.</p>
            ) : null}
            {actionableRemote.map((item) => {
              const hasConflict = item.action === "CONFLICT";
              const checked = selectedRemoteIds.includes(item.shopifyProductId);
              const expanded = expandedId === item.shopifyProductId;
              const inspectionEntry = inspections[item.shopifyProductId];
              return (
                <div key={item.shopifyProductId} className="border border-[var(--adm-border)] p-3 text-xs">
                  <div className="flex gap-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${item.title} for import`}
                      checked={checked}
                      disabled={hasConflict || pending}
                      onChange={() => toggleSelection(item.shopifyProductId, selectedRemoteIds, setSelectedRemoteIds)}
                      className="mt-0.5 size-4 shrink-0 !p-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[var(--adm-ink)]">{item.title}</p>
                      <p className="mt-1 text-[var(--adm-muted)]">{item.sku} · {item.action.replaceAll("_", " ")}</p>
                      {item.localName ? <p className="mt-1 text-[var(--adm-subtle)]">Matches local: {item.localName}</p> : null}
                      {item.changes.length > 0 ? (
                        <p className="mt-1 text-[var(--adm-subtle)]">Shopify changed: {item.changes.join(", ")}</p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {hasConflict ? (
                          <button
                            type="button"
                            className="adm-btn-ghost inline-flex min-h-8 items-center gap-2 px-2 py-1 text-[0.62rem]"
                            disabled={pending}
                            onClick={() => toggleExpand(item)}
                          >
                            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                            {expanded ? "Hide comparison" : "Review conflict"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="adm-btn-ghost inline-flex min-h-8 items-center gap-2 px-2 py-1 text-[0.62rem]"
                            disabled={pending}
                            onClick={() => runSync([item.shopifyProductId], [])}
                          >
                            <ArrowDownToLine className="size-3.5" />
                            {item.action === "CREATE_LOCAL" ? "Import" : "Pull update"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {expanded && hasConflict ? (
                    <div className="mt-3 border-t border-[var(--adm-border)] pt-3">
                      {!inspectionEntry || inspectionEntry.status === "loading" ? (
                        <p className="text-[var(--adm-muted)]">Loading comparison…</p>
                      ) : inspectionEntry.status === "error" ? (
                        <p className="text-[var(--adm-danger)]">{inspectionEntry.message}</p>
                      ) : (
                        <>
                          <div className="grid min-w-0 grid-cols-[minmax(6rem,1fr)_minmax(8rem,1fr)_minmax(8rem,1fr)] gap-3 pb-2 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[var(--adm-subtle)]">
                            <span>Field</span><span>Synarava</span><span>Shopify</span>
                          </div>
                          {inspectionEntry.inspection.differences.map((difference) => (
                            <div key={difference.field} className="grid min-w-0 grid-cols-[minmax(6rem,1fr)_minmax(8rem,1fr)_minmax(8rem,1fr)] gap-3 border-t border-[var(--adm-border)] py-2 text-[var(--adm-muted)]">
                              <span className="font-semibold text-[var(--adm-ink)]">{difference.field}</span>
                              <span className="break-words">{difference.local}</span>
                              <span className="break-words">{difference.shopify}</span>
                            </div>
                          ))}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="adm-btn-ghost"
                              disabled={isResolving}
                              onClick={() => resolve(item, "shopify")}
                            >
                              Use Shopify version
                            </button>
                            <button
                              type="button"
                              className="adm-btn-secondary"
                              disabled={isResolving}
                              onClick={() => resolve(item, "synarava")}
                            >
                              Keep Synarava and push
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="adm-label">Push to Shopify ({preview.pushToShopify.length})</p>
            <button
              type="button"
              className="adm-btn-ghost min-h-8 px-2 py-1 text-[0.62rem]"
              disabled={pending || preview.pushToShopify.length === 0}
              onClick={() => confirmSync([], preview.pushToShopify.map((item) => item.productId), "Push all local products")}
            >
              Push all
            </button>
          </div>
          <div className="mt-2 grid gap-2">
            {preview.pushToShopify.map((item) => (
              <div key={item.productId} className="flex gap-3 border border-[var(--adm-border)] p-3 text-xs">
                <input
                  type="checkbox"
                  aria-label={`Select ${item.name} to push to Shopify`}
                  checked={selectedLocalIds.includes(item.productId)}
                  disabled={pending}
                  onChange={() => toggleSelection(item.productId, selectedLocalIds, setSelectedLocalIds)}
                  className="mt-0.5 size-4 shrink-0 !p-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--adm-ink)]">{item.name}</p>
                  <p className="mt-1 text-[var(--adm-muted)]">{item.sku} · /{item.slug}</p>
                  <button
                    type="button"
                    className="adm-btn-ghost mt-3 inline-flex min-h-8 items-center gap-2 px-2 py-1 text-[0.62rem]"
                    disabled={pending}
                    onClick={() => runSync([], [item.productId])}
                  >
                    <ArrowUpFromLine className="size-3.5" />
                    Push
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="adm-label">Archive locally ({preview.archiveLocal.length})</p>
            <button
              type="button"
              className="adm-btn-danger min-h-8 px-2 py-1 text-[0.62rem]"
              disabled={pending || selectedArchiveIds.length === 0}
              onClick={() => confirmArchive(selectedArchiveIds)}
            >
              Archive selected
            </button>
          </div>
          <div className="mt-2 grid gap-2">
            {preview.archiveLocal.length === 0 ? (
              <p className="text-xs text-[var(--adm-muted)]">Nothing would be archived.</p>
            ) : null}
            {preview.archiveLocal.map((item) => (
              <div key={item.productId} className="flex gap-3 border border-[var(--adm-border)] p-3 text-xs">
                <input
                  type="checkbox"
                  aria-label={`Select ${item.name} to archive locally`}
                  checked={selectedArchiveIds.includes(item.productId)}
                  disabled={pending}
                  onChange={() => toggleSelection(item.productId, selectedArchiveIds, setSelectedArchiveIds)}
                  className="mt-0.5 size-4 shrink-0 !p-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--adm-ink)]">{item.name}</p>
                  <p className="mt-1 break-all text-[var(--adm-muted)]">{item.shopifyProductId}</p>
                  <button
                    type="button"
                    className="adm-btn-danger mt-3 min-h-8 px-2 py-1 text-[0.62rem]"
                    disabled={pending}
                    onClick={() => confirmArchive([item.productId])}
                  >
                    Archive
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AnimatedModal>
  );
}
