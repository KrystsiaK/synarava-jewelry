"use client";

/** Product ConflictResolver adapter — entity actions/labels only. */

import {
  applyCatalogConflictResolutionAction,
  loadProductCatalogConflictAction,
  previewCatalogConflictResolutionAction,
  pullSingleProductFromShopifyAction,
  pushSingleProductToShopifyAction,
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
  filterConflictFieldsForView,
  filterSignalsForView,
  isProductScoped,
  withProductTypeImpactNotes,
  type CatalogConflictViewScope,
} from "@/components/admin/products/catalog-conflict-view";

export const CatalogConflictWorkspace = createEntityConflictWorkspace<
  CatalogConflictViewScope,
  { id: string; name: string; sku: string | null },
  { productIds: string[]; appliedCount: number }
>({
  defaultViewScope: { kind: "catalog" },
  filterSignals: filterSignalsForView,
  resolveFocusId: (scope, focusedId) => (isProductScoped(scope) ? scope.productId : focusedId),
  resolveEnsureId: (scope) => (isProductScoped(scope) ? scope.productId : null),
  toListed: (p) => ({ id: p.id, name: p.name, detail: p.sku ? `SKU ${p.sku}` : null }),
  detailFromSignal: (s) => (s.sku ? `SKU ${s.sku}` : null),
  signalRefreshMode: "catalog-reload",
  mapApplied: (info) => ({ productIds: info.entityIds, appliedCount: info.appliedCount }),
  createAdapter: (viewScope) => createManualConflictAdapter({
    entityNoun: "product",
    entityNounPlural: "products",
    ariaLabel: "Product conflicts",
    entityIdField: "productId",
    supportsWholeRecord: true,
    async loadEntityFields(entityId) {
      const result = await loadProductCatalogConflictAction(entityId);
      if (result.error) return { fields: [], error: result.error };
      return { fields: filterConflictFieldsForView(result.conflict?.fields ?? [], viewScope) };
    },
    previewAction: asManualPreviewAction(previewCatalogConflictResolutionAction),
    applyAction: asManualApplyAction(applyCatalogConflictResolutionAction),
    mapPreview: (model) => mapManualPreviewEntries(
      { ...model, entries: withProductTypeImpactNotes(model.entries) },
      "productId",
    ),
    /** ONE entry for blocked commerce whole-record pull/push (force). */
    async applyWholeRecord(entityId, direction, expectedFingerprints) {
      const result = direction === CONFLICT_DIRECTIONS.SHOPIFY_TO_SYNARAVA
        ? await pullSingleProductFromShopifyAction(entityId, true, expectedFingerprints)
        : await pushSingleProductToShopifyAction(
          entityId,
          { authorizeCommerceConflictOverwrite: true, pushRegisteredTranslations: false },
          expectedFingerprints,
        );
      if (result.error) return { ok: false, error: result.error };
      return { ok: true, success: result.success };
    },
  }),
});
