"use client";

/**
 * Product adapter for ConflictResolver — data → rows + preview/apply only.
 * No choice chrome here; the ONE UI lives in components/synarava-cms/conflict-resolver.
 */

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import {
  applyCatalogConflictResolutionAction,
  loadCatalogConflictSignalsAction,
  loadProductCatalogConflictAction,
  previewCatalogConflictResolutionAction,
} from "@/app/admin/actions/sync";
import { refreshPreservingScroll } from "@/lib/admin/preserve-scroll";
import {
  ConflictResolver,
  type ConflictEntitySummary,
  type ConflictPreviewModel,
  type ConflictResolverAdapter,
} from "@/components/synarava-cms/conflict-resolver";
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
  const router = useRouter();
  const scopedSignals = useMemo(() => filterSignalsForView(signals, viewScope), [signals, viewScope]);
  const scopedFocusId = isProductScoped(viewScope) ? viewScope.productId : focusedProductId;
  const adapter = useMemo(() => createProductAdapter(viewScope), [viewScope]);
  const entitiesById = useMemo(() => {
    const map = new Map<string, ConflictEntitySummary>();
    for (const product of products) {
      map.set(product.id, { id: product.id, name: product.name, detail: product.sku ? `SKU ${product.sku}` : null });
    }
    for (const [productId, signal] of Object.entries(scopedSignals.products)) {
      if (!map.has(productId) && signal.name) {
        map.set(productId, {
          id: productId,
          name: signal.name,
          detail: signal.sku ? `SKU ${signal.sku}` : null,
        });
      }
    }
    return map;
  }, [products, scopedSignals.products]);
  const entityList = useMemo(() => [...entitiesById.values()], [entitiesById]);
  const entityIds = useMemo(() => {
    const ids = Object.keys(scopedSignals.products);
    if (isProductScoped(viewScope) && !ids.includes(viewScope.productId)) {
      return [viewScope.productId, ...ids];
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
        refreshPreservingScroll(router);
      }}
    />
  );
}
