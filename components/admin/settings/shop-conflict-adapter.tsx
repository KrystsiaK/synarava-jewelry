"use client";

/** SHOP ConflictResolver adapter — free-shipping threshold leaf only. */

import {
  applyShopConflictResolutionAction,
  loadShopCatalogConflictAction,
  previewShopConflictResolutionAction,
} from "@/app/admin/actions/announcement-bar";
import {
  asManualApplyAction,
  asManualPreviewAction,
  createManualConflictAdapter,
  mapManualPreviewEntries,
  ConflictResolverWorkspace,
} from "@/components/admin/shared/conflict-resolver-workspace";
import { FREE_SHIPPING_THRESHOLD_RESOURCE_ID } from "@/lib/content/announcement-bar-fields";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";
import { useMemo } from "react";

function shopSignals(leafCount: number): CatalogConflictSignals {
  return {
    state: "ready",
    totalCount: leafCount,
    checkedAt: null,
    recentlyUpdatedProducts: {},
    products: leafCount > 0
      ? {
          [FREE_SHIPPING_THRESHOLD_RESOURCE_ID]: {
            shared: true,
            sharedCount: leafCount,
            leafCount,
            differenceCount: leafCount,
            sections: ["shopify"],
            locales: [],
            name: "Free shipping threshold",
          },
        }
      : {},
  };
}

const shopAdapter = createManualConflictAdapter({
  entityNoun: "shop setting",
  entityNounPlural: "shop settings",
  ariaLabel: "Shop commerce conflicts",
  entityIdField: "shopId",
  supportsWholeRecord: false,
  async loadEntityFields(entityId) {
    const result = await loadShopCatalogConflictAction(entityId);
    if (result.error) return { fields: [], error: result.error };
    return { fields: result.conflict?.fields ?? [] };
  },
  previewAction: asManualPreviewAction(previewShopConflictResolutionAction),
  applyAction: asManualApplyAction(applyShopConflictResolutionAction),
  mapPreview: (model) => mapManualPreviewEntries(model, "shopId"),
});

export function ShopThresholdConflictWorkspace({
  open,
  onClose,
  conflictLeafCount,
  onToast,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  conflictLeafCount: number;
  onToast: (message: string, tone: "success" | "error" | "info") => void;
  onApplied?: () => void;
}) {
  const signals = useMemo(() => shopSignals(conflictLeafCount), [conflictLeafCount]);
  const entities = useMemo(
    () => [{
      id: FREE_SHIPPING_THRESHOLD_RESOURCE_ID,
      name: "Free shipping threshold",
      detail: "Portugal delivery profile",
    }],
    [],
  );

  return (
    <ConflictResolverWorkspace
      open={open}
      onClose={onClose}
      signals={signals}
      entityIds={[FREE_SHIPPING_THRESHOLD_RESOURCE_ID]}
      entities={entities}
      focusedEntityId={FREE_SHIPPING_THRESHOLD_RESOURCE_ID}
      adapter={shopAdapter}
      onToast={onToast}
      onApplied={async () => {
        onApplied?.();
      }}
    />
  );
}
