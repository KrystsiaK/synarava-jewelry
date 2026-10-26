export type ReconcileTrigger = "AUTO" | "MANUAL" | "ENTITY" | "LOCALE";
export type ReconcileRunStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED";

export type ReconcileScope = {
  locale?: string;
  entityType?: "PRODUCT" | "COLLECTION" | "PAGE" | "STOREFRONT_COPY";
  entityId?: string;
  bindingId?: string;
};

export type ReconcileRunSummary = {
  id: string;
  trigger: ReconcileTrigger;
  status: ReconcileRunStatus;
  checkedCount: number;
  differenceCount: number;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  /** Lease heartbeat — progress bumps this while QUEUED/RUNNING. */
  updatedAt: string;
};

export type ReconcileDifferenceView = {
  id: string;
  runId: string;
  bindingId: string;
  rootEntityType: "PRODUCT" | "COLLECTION" | "PAGE" | "STOREFRONT_COPY";
  rootEntityId: string;
  entityLabel: string;
  locale: string;
  fieldKey: string;
  fieldLabel: string;
  targetKind: "NATIVE" | "METAFIELD" | "METAOBJECT";
  /** Persisted rows may still hold legacy LOCAL_ONLY/SHOPIFY_ONLY; compare ignores those. */
  kind: "LOCAL_ONLY" | "SHOPIFY_ONLY" | "CONFLICT";
  localValue: unknown;
  shopifyValue: unknown;
  localFingerprint: string;
  shopifyFingerprint: string;
  shopifyUpdatedAt: string | null;
  shopifyOutdated: boolean | null;
};
