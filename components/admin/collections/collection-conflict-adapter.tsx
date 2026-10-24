"use client";

/**
 * Collection adapter for ConflictResolver — load/preview/apply only.
 * No whole-record pull/push exists for collections (STOP gap for blocked commerce).
 */

import { useMemo } from "react";

import {
  applyCollectionConflictResolutionAction,
  loadCollectionCatalogConflictAction,
  previewCollectionConflictResolutionAction,
} from "@/app/admin/actions/sync";
import {
  CONFLICT_DIRECTIONS,
  type ConflictPreviewModel,
  type ConflictResolverAdapter,
} from "@/components/synarava-cms/conflict-resolver";
import {
  ConflictResolverWorkspace,
  mergeConflictEntities,
  useConflictEntityIds,
} from "@/components/admin/shared/conflict-resolver-workspace";
import {
  filterCollectionFieldsForView,
  filterCollectionSignalsForView,
  isCollectionScoped,
  type CollectionConflictViewScope,
} from "@/components/admin/collections/collection-conflict-view";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

export type { CollectionConflictViewScope } from "@/components/admin/collections/collection-conflict-view";
export { fieldMatchesCollectionViewLocale } from "@/components/admin/collections/collection-conflict-view";

type CollectionSummary = { id: string; name: string; slug?: string | null };
type ToastTone = "success" | "error" | "info";

function toPreviewModel(
  model: NonNullable<Awaited<ReturnType<typeof previewCollectionConflictResolutionAction>>["preview"]>,
): ConflictPreviewModel {
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
        && entry.direction === CONFLICT_DIRECTIONS.SHOPIFY_TO_SYNARAVA;
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

function createCollectionAdapter(viewScope: CollectionConflictViewScope): ConflictResolverAdapter {
  return {
    entityNoun: "collection",
    entityNounPlural: "collections",
    ariaLabel: "Collection conflicts",
    // No collection pullSingle/pushSingle — blocked commerce stays non-selectable.
    supportsWholeRecord: false,
    async loadEntityFields(entityId) {
      const result = await loadCollectionCatalogConflictAction(entityId);
      if (result.error) return { fields: [], error: result.error };
      return {
        fields: filterCollectionFieldsForView(result.conflict?.fields ?? [], viewScope),
      };
    },
    async previewSelections(selections) {
      const result = await previewCollectionConflictResolutionAction({
        kind: "MANUAL",
        selections: selections.map((item) => ({
          collectionId: item.entityId,
          fieldKey: item.fieldKey,
          direction: item.direction,
        })),
      });
      if (result.error) return { preview: null, error: result.error };
      if (!result.preview) return { preview: null };
      return { preview: toPreviewModel(result.preview) };
    },
    async applySelections({ acknowledgeClears, entries }) {
      const result = await applyCollectionConflictResolutionAction({
        acknowledgeClears,
        entries: entries.map((entry) => ({
          collectionId: entry.entityId,
          fieldKey: entry.fieldKey,
          direction: entry.direction,
          expectedLocalFingerprint: entry.expectedLocalFingerprint,
          expectedShopifyFingerprint: entry.expectedShopifyFingerprint,
        })),
      });
      return {
        outcome: result.outcome
          ? {
              appliedCount: result.outcome.appliedCount,
              failedCount: result.outcome.failedCount,
              results: result.outcome.results.map((item) => ({
                entityId: item.collectionId,
                ok: item.ok,
                message: item.message,
              })),
            }
          : null,
        success: result.success,
        error: result.error,
      };
    },
  };
}

/** Opens the shared ConflictResolver for collection catalog / editor scopes. */
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
  const scopedSignals = useMemo(
    () => filterCollectionSignalsForView(signals, viewScope),
    [signals, viewScope],
  );
  const scopedFocusId = isCollectionScoped(viewScope) ? viewScope.collectionId : focusedCollectionId;
  const adapter = useMemo(() => createCollectionAdapter(viewScope), [viewScope]);
  const listed = useMemo(
    () => collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      detail: collection.slug ? `/${collection.slug}` : null,
    })),
    [collections],
  );
  const entities = useMemo(
    () => mergeConflictEntities(listed, scopedSignals, (signal) => (
      signal.handle ? `/${signal.handle}` : null
    )),
    [listed, scopedSignals],
  );
  const ensureId = isCollectionScoped(viewScope) ? viewScope.collectionId : null;
  const entityIds = useConflictEntityIds(scopedSignals, ensureId);

  return (
    <ConflictResolverWorkspace
      open={open}
      onClose={onClose}
      signals={scopedSignals}
      entityIds={entityIds}
      entities={entities}
      focusedEntityId={scopedFocusId}
      adapter={adapter}
      onToast={onToast}
      onApplied={(info) => {
        if (info.appliedCount > 0) {
          const nextProducts = { ...signals.products };
          for (const entityId of info.entityIds) delete nextProducts[entityId];
          onSignalsChange({
            ...signals,
            products: nextProducts,
            totalCount: Object.keys(nextProducts).length,
          });
        }
      }}
    />
  );
}
