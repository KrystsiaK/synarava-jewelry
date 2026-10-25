"use client";

/** Collection ConflictResolver adapter — entity actions/labels only. No whole-record path. */

import {
  applyCollectionConflictResolutionAction,
  loadCollectionCatalogConflictAction,
  previewCollectionConflictResolutionAction,
} from "@/app/admin/actions/sync";
import { CONFLICT_DIRECTIONS } from "@/components/synarava-cms/conflict-resolver";
import {
  asManualApplyAction,
  asManualPreviewAction,
  createEntityConflictWorkspace,
  createManualConflictAdapter,
  mapManualPreviewEntries,
} from "@/components/admin/shared/conflict-resolver-workspace";
import {
  filterCollectionFieldsForView,
  filterCollectionSignalsForView,
  isCollectionScoped,
  type CollectionConflictViewScope,
} from "@/components/admin/collections/collection-conflict-view";

export const CollectionConflictWorkspace = createEntityConflictWorkspace<
  CollectionConflictViewScope,
  { id: string; name: string; slug?: string | null }
>({
  defaultViewScope: { kind: "catalog" },
  filterSignals: filterCollectionSignalsForView,
  resolveFocusId: (scope, focusedId) => (isCollectionScoped(scope) ? scope.collectionId : focusedId),
  resolveEnsureId: (scope) => (isCollectionScoped(scope) ? scope.collectionId : null),
  toListed: (c) => ({ id: c.id, name: c.name, detail: c.slug ? `/${c.slug}` : null }),
  detailFromSignal: (s) => (s.handle ? `/${s.handle}` : null),
  signalRefreshMode: "prune-applied",
  createAdapter: (viewScope) => createManualConflictAdapter({
    entityNoun: "collection",
    entityNounPlural: "collections",
    ariaLabel: "Collection conflicts",
    entityIdField: "collectionId",
    supportsWholeRecord: false,
    async loadEntityFields(entityId) {
      const result = await loadCollectionCatalogConflictAction(entityId);
      if (result.error) return { fields: [], error: result.error };
      return { fields: filterCollectionFieldsForView(result.conflict?.fields ?? [], viewScope) };
    },
    previewAction: asManualPreviewAction(previewCollectionConflictResolutionAction),
    applyAction: asManualApplyAction(applyCollectionConflictResolutionAction),
    mapPreview(model) {
      return mapManualPreviewEntries(model, "collectionId", (entry) => {
        const deletesLocal = entry.field.origin === "PRESENCE"
          && entry.field.presenceDifference?.kind === "SYNARAVA_ONLY"
          && entry.direction === CONFLICT_DIRECTIONS.SHOPIFY_TO_SYNARAVA;
        return {
          ...entry,
          willClearNonEmptyValue: entry.willClearNonEmptyValue || deletesLocal,
          impactNote: deletesLocal
            ? "This removes the collection from Synarava. Products stay; only the collection record is removed."
            : null,
        };
      });
    },
  }),
});
