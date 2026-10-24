"use client";

/**
 * Product adapter for ConflictResolver — load/preview/apply + whole-record pull/push.
 * Choice chrome lives only in components/synarava-cms/conflict-resolver.
 */

import { useMemo } from "react";

import {
  applyCatalogConflictResolutionAction,
  loadCatalogConflictSignalsAction,
  loadProductCatalogConflictAction,
  previewCatalogConflictResolutionAction,
  pullSingleProductFromShopifyAction,
  pushSingleProductToShopifyAction,
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
  filterConflictFieldsForView,
  filterSignalsForView,
  isProductScoped,
  isProductTypeConflictField,
  productTypeApplyImpactNote,
  type CatalogConflictViewScope,
} from "@/components/admin/products/catalog-conflict-view";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

export type { CatalogConflictViewScope } from "@/components/admin/products/catalog-conflict-view";
export {
  fieldMatchesViewLocale,
  fieldMatchesViewSection,
  filterConflictFieldsForView,
  filterSignalsForView,
} from "@/components/admin/products/catalog-conflict-view";

type ProductSummary = { id: string; name: string; sku: string | null };
type ToastTone = "success" | "error" | "info";

function toPreviewModel(
  model: NonNullable<Awaited<ReturnType<typeof previewCatalogConflictResolutionAction>>["preview"]>,
): ConflictPreviewModel {
  const productTypeIds = new Set(
    model.entries
      .filter((entry) => isProductTypeConflictField(entry.field))
      .map((entry) => entry.productId),
  );
  return {
    truncated: model.truncated,
    excluded: model.excluded.map((item) => ({
      entityId: item.productId,
      fieldKey: item.fieldKey,
      label: item.label,
      reason: item.reason,
    })),
    entries: model.entries.map((entry) => ({
      entityId: entry.productId,
      field: entry.field,
      direction: entry.direction,
      willClearNonEmptyValue: entry.willClearNonEmptyValue,
      impactNote: isProductTypeConflictField(entry.field)
        ? productTypeApplyImpactNote(productTypeIds.size)
        : null,
    })),
  };
}

function createProductAdapter(viewScope: CatalogConflictViewScope): ConflictResolverAdapter {
  return {
    entityNoun: "product",
    entityNounPlural: "products",
    ariaLabel: "Product conflicts",
    supportsWholeRecord: true,
    async loadEntityFields(entityId) {
      const result = await loadProductCatalogConflictAction(entityId);
      if (result.error) return { fields: [], error: result.error };
      return {
        fields: filterConflictFieldsForView(result.conflict?.fields ?? [], viewScope),
      };
    },
    async previewSelections(selections) {
      const result = await previewCatalogConflictResolutionAction({
        kind: "MANUAL",
        selections: selections.map((item) => ({
          productId: item.entityId,
          fieldKey: item.fieldKey,
          direction: item.direction,
        })),
      });
      if (result.error) return { preview: null, error: result.error };
      if (!result.preview) return { preview: null };
      return { preview: toPreviewModel(result.preview) };
    },
    async applySelections({ acknowledgeClears, entries }) {
      const result = await applyCatalogConflictResolutionAction({
        acknowledgeClears,
        entries: entries.map((entry) => ({
          productId: entry.entityId,
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
                entityId: item.productId,
                ok: item.ok,
                message: item.message,
              })),
            }
          : null,
        success: result.success,
        error: result.error,
        warning: result.warning,
      };
    },
    async applyWholeRecord(entityId, direction) {
      const result = direction === CONFLICT_DIRECTIONS.SHOPIFY_TO_SYNARAVA
        ? await pullSingleProductFromShopifyAction(entityId, true)
        : await pushSingleProductToShopifyAction(entityId, true);
      if (result.error) return { ok: false, error: result.error };
      return { ok: true, success: result.success };
    },
  };
}

/** Opens the shared ConflictResolver for product catalog / editor scopes. */
export function CatalogConflictWorkspace({
  open,
  onClose,
  signals,
  onSignalsChange,
  products,
  focusedProductId,
  viewScope = { kind: "catalog" },
  formBlocked = false,
  onToast,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  signals: CatalogConflictSignals;
  onSignalsChange: (signals: CatalogConflictSignals) => void;
  products: ProductSummary[];
  focusedProductId: string | null;
  viewScope?: CatalogConflictViewScope;
  formBlocked?: boolean;
  onToast: (message: string, tone: ToastTone) => void;
  onApplied?: (info: { productIds: string[]; appliedCount: number }) => void;
}) {
  const scopedSignals = useMemo(() => filterSignalsForView(signals, viewScope), [signals, viewScope]);
  const scopedFocusId = isProductScoped(viewScope) ? viewScope.productId : focusedProductId;
  const adapter = useMemo(() => createProductAdapter(viewScope), [viewScope]);
  const listed = useMemo(
    () => products.map((product) => ({
      id: product.id,
      name: product.name,
      detail: product.sku ? `SKU ${product.sku}` : null,
    })),
    [products],
  );
  const entities = useMemo(
    () => mergeConflictEntities(listed, scopedSignals, (signal) => (
      signal.sku ? `SKU ${signal.sku}` : null
    )),
    [listed, scopedSignals],
  );
  const ensureId = isProductScoped(viewScope) ? viewScope.productId : null;
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
      formBlocked={formBlocked}
      onToast={onToast}
      onApplied={async (info) => {
        if (onApplied) {
          onApplied({ productIds: info.entityIds, appliedCount: info.appliedCount });
        } else if (info.appliedCount > 0) {
          const refreshed = await loadCatalogConflictSignalsAction();
          if (refreshed.signals) onSignalsChange(refreshed.signals);
          else if (refreshed.error) onToast(refreshed.error, "info");
        }
      }}
    />
  );
}
