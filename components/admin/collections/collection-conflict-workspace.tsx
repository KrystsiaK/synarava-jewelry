"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  applyCollectionConflictResolutionAction,
  loadCollectionCatalogConflictAction,
  previewCollectionConflictResolutionAction,
} from "@/app/admin/actions/sync";
import { refreshPreservingScroll } from "@/lib/admin/preserve-scroll";
import {
  FieldConflictBusyOverlay,
  FieldConflictDetailsModal,
  FieldConflictListModal,
  FieldConflictPreviewModal,
  type FieldConflictEntitySummary,
  type FieldConflictPreviewModel,
} from "@/components/admin/shared/field-conflict-panel";
import type {
  CatalogConflictDirection,
} from "@/lib/shopify/catalog-conflict";
import type { CollectionCatalogConflict } from "@/lib/shopify/collection-conflict";
import type {
  CollectionConflictApplyScope,
  CollectionConflictPreview,
} from "@/lib/shopify/collection-conflict-apply";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";
import {
  fieldMatchesCollectionViewLocale,
  filterCollectionFieldsForView,
  filterCollectionSignalsForView,
  isCollectionScoped,
  type CollectionConflictViewScope,
} from "@/components/admin/collections/collection-conflict-view";

export type { CollectionConflictViewScope } from "@/components/admin/collections/collection-conflict-view";
export { fieldMatchesCollectionViewLocale } from "@/components/admin/collections/collection-conflict-view";

type CollectionSummary = { id: string; name: string; slug?: string | null };
type ToastTone = "success" | "error" | "info";

/** Thin wrapper: orchestration only — UI is FieldConflictPanel. */
export function CollectionConflictWorkspace({
  open,
  onClose,
  signals,
  onSignalsChange,
  collections,
  focusedCollectionId,
  viewScope = { kind: "catalog" },
  onToast,
}: {
  open: boolean;
  onClose: () => void;
  signals: CatalogConflictSignals;
  onSignalsChange: (signals: CatalogConflictSignals) => void;
  collections: CollectionSummary[];
  focusedCollectionId: string | null;
  viewScope?: CollectionConflictViewScope;
  onToast: (message: string, tone: ToastTone) => void;
}) {
  const [details, setDetails] = useState<CollectionCatalogConflict | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selections, setSelections] = useState<Record<string, CatalogConflictDirection>>({});
  const [preview, setPreview] = useState<CollectionConflictPreview | null>(null);
  const [activeScope, setActiveScope] = useState<CollectionConflictApplyScope | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const router = useRouter();
  const scopedSignals = useMemo(() => filterCollectionSignalsForView(signals, viewScope), [signals, viewScope]);
  const scopedFocusId = isCollectionScoped(viewScope) ? viewScope.collectionId : focusedCollectionId;
  const hideBulk = isCollectionScoped(viewScope);
  const entitiesById = useMemo(() => {
    const map = new Map<string, FieldConflictEntitySummary>();
    for (const collection of collections) {
      map.set(collection.id, {
        id: collection.id,
        name: collection.name,
        detail: collection.slug ? `/${collection.slug}` : null,
      });
    }
    for (const [collectionId, signal] of Object.entries(scopedSignals.products)) {
      if (!map.has(collectionId) && signal.name) {
        map.set(collectionId, {
          id: collectionId,
          name: signal.name,
          detail: signal.handle ? `/${signal.handle}` : null,
        });
      }
    }
    return map;
  }, [collections, scopedSignals.products]);
  const entityList = useMemo(() => [...entitiesById.values()], [entitiesById]);
  const busy = applying || detailsLoading || previewLoading;

  function toPanelPreview(model: CollectionConflictPreview): FieldConflictPreviewModel {
    return {
      truncated: model.truncated,
      excluded: model.excluded.map((item) => ({
        entityId: item.collectionId,
        fieldKey: item.fieldKey,
        label: item.label,
        reason: item.reason,
      })),
      entries: model.entries.map((entry) => {
        const presenceKind = entry.field.presenceDifference?.kind;
        const deletesLocal = entry.field.origin === "PRESENCE"
          && presenceKind === "SYNARAVA_ONLY"
          && entry.direction === "SHOPIFY_TO_SYNARAVA";
        return {
          entityId: entry.collectionId,
          field: entry.field,
          direction: entry.direction,
          willClearNonEmptyValue: entry.willClearNonEmptyValue || deletesLocal,
          impactNote: deletesLocal
            ? "This removes the collection from Synarava. Products stay; only the collection record is removed."
            : null,
        };
      }),
    };
  }

  function closeAll() {
    if (applying) return;
    setPreview(null);
    setDetails(null);
    setDetailsLoading(false);
    setPreviewLoading(false);
    setSelections({});
    setResultMessage(null);
    onClose();
  }

  function openPreview(scope: CollectionConflictApplyScope) {
    if (applying) return;
    setResultMessage(null);
    setPreviewLoading(true);
    void previewCollectionConflictResolutionAction(scope)
      .then((result) => {
        if (result.error) {
          onToast(result.error, "error");
          return;
        }
        if (result.preview) {
          const nextPreview = viewScope.kind === "collectionLocale"
            ? {
                ...result.preview,
                entries: result.preview.entries.filter((entry) =>
                  fieldMatchesCollectionViewLocale(entry.field, viewScope.locale)),
              }
            : result.preview;
          setActiveScope(scope);
          setPreview(nextPreview);
        }
      })
      .finally(() => setPreviewLoading(false));
  }

  function openDetails(collectionId: string) {
    if (applying) return;
    setDetails(null);
    setSelections({});
    setDetailsLoading(true);
    void loadCollectionCatalogConflictAction(collectionId)
      .then((result) => {
        if (result.error) {
          onToast(result.error, "error");
          return;
        }
        if (result.conflict) {
          setDetails({
            ...result.conflict,
            fields: filterCollectionFieldsForView(result.conflict.fields, viewScope),
          });
        }
      })
      .finally(() => setDetailsLoading(false));
  }

  function openCollectionDirection(collectionId: string, direction: CatalogConflictDirection) {
    if (viewScope.kind !== "collectionLocale") {
      openPreview({ kind: "COLLECTION", collectionId, direction });
      return;
    }
    setPreviewLoading(true);
    void loadCollectionCatalogConflictAction(collectionId)
      .then((result) => {
        if (result.error) {
          onToast(result.error, "error");
          setPreviewLoading(false);
          return;
        }
        const visibleFields = filterCollectionFieldsForView(result.conflict?.fields ?? [], viewScope);
        const fields = visibleFields
          .filter((field) => !field.blockedReason && field.allowedDirections.includes(direction));
        if (fields.length === 0) {
          if (visibleFields.length > 0) {
            setDetails({ collectionId, fields: visibleFields });
            setSelections({});
            setPreviewLoading(false);
            return;
          }
          onToast("Nothing left to sync for this language in that direction.", "info");
          setPreviewLoading(false);
          return;
        }
        setPreviewLoading(false);
        openPreview({
          kind: "MANUAL",
          selections: fields.map((field) => ({ collectionId, fieldKey: field.fieldKey, direction })),
        });
      })
      .catch(() => setPreviewLoading(false));
  }

  useEffect(() => {
    if (!open || !isCollectionScoped(viewScope)) return;
    const collectionId = viewScope.collectionId;
    const scope = viewScope;
    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (cancelled) return;
        setDetails(null);
        setSelections({});
        setDetailsLoading(true);
        return loadCollectionCatalogConflictAction(collectionId);
      })
      .then((result) => {
        if (cancelled || !result) return;
        if (result.error) {
          onToast(result.error, "error");
          return;
        }
        if (result.conflict) {
          setDetails({
            ...result.conflict,
            fields: filterCollectionFieldsForView(result.conflict.fields, scope),
          });
        }
      })
      .finally(() => {
        if (!cancelled) setDetailsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, viewScope.kind, isCollectionScoped(viewScope) ? viewScope.collectionId : null, viewScope.kind === "collectionLocale" ? viewScope.locale : null]);

  function confirm(acknowledgeClears: boolean) {
    if (!preview || applying) return;
    const submittedPreview = preview;
    const submittedScope = activeScope;
    setDetails(null);
    setResultMessage(null);
    // Close the list for bulk / collection-scoped flows; keep the preview for the lasting result.
    if (submittedScope?.kind === "BULK" || isCollectionScoped(viewScope)) onClose();
    setApplying(true);
    void (async () => {
      try {
        const result = await applyCollectionConflictResolutionAction({
          acknowledgeClears,
          entries: submittedPreview.entries.map((entry) => ({
            collectionId: entry.collectionId,
            fieldKey: entry.field.fieldKey,
            direction: entry.direction,
            expectedLocalFingerprint: entry.field.localFingerprint,
            expectedShopifyFingerprint: entry.field.shopifyFingerprint,
          })),
        });
        if (!result.outcome) {
          const message = result.error ?? "Could not apply the changes.";
          setResultMessage(message);
          onToast(message, "error");
          return;
        }
        const failureDetail = result.outcome.results
          .filter((item) => !item.ok)
          .map((item) => item.message)
          .filter(Boolean)
          .slice(0, 2)
          .join(" · ");
        if (result.error) {
          const message = failureDetail ? `${result.error} ${failureDetail}` : result.error;
          setResultMessage(message);
          onToast(message, result.outcome.appliedCount > 0 ? "info" : "error");
        } else if (result.success) {
          setResultMessage(result.success);
          onToast(result.success, result.outcome.failedCount ? "info" : "success");
        }
        const successful = new Set(result.outcome.results.filter((item) => item.ok).map((item) => item.collectionId));
        const fullyResolved = [...successful].filter((collectionId) =>
          !result.outcome!.results.some((item) => item.collectionId === collectionId && !item.ok)
          && !submittedPreview.excluded.some((item) => item.collectionId === collectionId),
        );
        setApplying(false);
        if (fullyResolved.length > 0) {
          const nextProducts = { ...signals.products };
          fullyResolved.forEach((collectionId) => delete nextProducts[collectionId]);
          onSignalsChange({ ...signals, products: nextProducts, totalCount: Object.keys(nextProducts).length });
        }
        setSelections({});
        refreshPreservingScroll(router);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not apply the changes.";
        setResultMessage(message);
        onToast(message, "error");
      } finally {
        setApplying(false);
      }
    })();
  }

  const panelPreview = preview ? toPanelPreview(preview) : null;

  return (
    <>
      <FieldConflictListModal
        open={open}
        onClose={closeAll}
        signals={scopedSignals}
        entities={entityList}
        focusedEntityId={scopedFocusId}
        busy={busy}
        hideBulk={hideBulk}
        entityNoun="collection"
        entityNounPlural="collections"
        ariaLabel="Collection differences"
        onAction={(action) => {
          if (action.kind === "details") openDetails(action.entityId);
          else if (action.kind === "entity") openCollectionDirection(action.entityId, action.direction);
          else openPreview({ kind: "BULK", direction: action.direction });
        }}
      />
      {details || detailsLoading ? (
        <FieldConflictDetailsModal
          open
          title={details ? (entitiesById.get(details.collectionId)?.name ?? "Collection") : "Collection"}
          fields={details?.fields ?? []}
          selections={selections}
          loading={detailsLoading}
          applying={applying}
          entityId={details?.collectionId ?? null}
          onClose={() => { if (!applying) { setDetails(null); setDetailsLoading(false); setSelections({}); } }}
          onSelect={(fieldKey, direction) => setSelections((current) => ({ ...current, [fieldKey]: direction }))}
          onSelectAll={(direction) => setSelections((current) => {
            if (!details) return current;
            const next = { ...current };
            for (const field of details.fields) {
              if (!field.blockedReason && field.allowedDirections.includes(direction)) next[field.fieldKey] = direction;
            }
            return next;
          })}
          onContinue={() => details && openPreview({
            kind: "MANUAL",
            selections: Object.entries(selections).map(([fieldKey, direction]) => ({
              collectionId: details.collectionId,
              fieldKey,
              direction,
            })),
          })}
        />
      ) : null}
      {panelPreview ? (
        <FieldConflictPreviewModal
          preview={panelPreview}
          entitiesById={entitiesById}
          applying={applying}
          resultMessage={resultMessage}
          onClose={() => { if (!applying) { setPreview(null); setResultMessage(null); } }}
          onConfirm={confirm}
        />
      ) : null}
      {previewLoading ? <FieldConflictBusyOverlay mode="toast" label="Building preview…" /> : null}
      {applying ? <FieldConflictBusyOverlay mode="blocking" label="Working with Shopify…" /> : null}
    </>
  );
}
