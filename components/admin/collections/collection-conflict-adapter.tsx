"use client";

/**
 * Collection adapter for ConflictResolver — data → rows + preview/apply only.
 * No choice chrome here; the ONE UI lives in components/synarava-cms/conflict-resolver.
 */

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import {
  applyCollectionConflictResolutionAction,
  loadCollectionCatalogConflictAction,
  previewCollectionConflictResolutionAction,
} from "@/app/admin/actions/sync";
import { refreshPreservingScroll } from "@/lib/admin/preserve-scroll";
import {
  CONFLICT_DIRECTIONS,
  ConflictResolver,
  type ConflictEntitySummary,
  type ConflictPreviewModel,
  type ConflictResolverAdapter,
} from "@/components/synarava-cms/conflict-resolver";
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
  const router = useRouter();
  const scopedSignals = useMemo(
    () => filterCollectionSignalsForView(signals, viewScope),
    [signals, viewScope],
  );
  const scopedFocusId = isCollectionScoped(viewScope) ? viewScope.collectionId : focusedCollectionId;
  const adapter = useMemo(() => createCollectionAdapter(viewScope), [viewScope]);
  const entitiesById = useMemo(() => {
    const map = new Map<string, ConflictEntitySummary>();
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
  const entityIds = useMemo(() => {
    const ids = Object.keys(scopedSignals.products);
    if (isCollectionScoped(viewScope) && !ids.includes(viewScope.collectionId)) {
      return [viewScope.collectionId, ...ids];
    }
    return ids;
  }, [scopedSignals.products, viewScope]);

  return (
    <ConflictResolver
      open={open}
      onClose={onClose}
      adapter={adapter}
      entityIds={entityIds}
      entities={entityList}
      focusedEntityId={scopedFocusId}
      onToast={onToast}
      onApplied={(info) => {
        if (info.appliedCount > 0) {
          const nextProducts = { ...signals.products };
          for (const entityId of info.entityIds) {
            const stillFailed = false;
            if (!stillFailed) delete nextProducts[entityId];
          }
          onSignalsChange({
            ...signals,
            products: nextProducts,
            totalCount: Object.keys(nextProducts).length,
          });
        }
        refreshPreservingScroll(router);
      }}
    />
  );
}
