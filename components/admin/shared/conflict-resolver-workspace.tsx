"use client";

/**
 * Shared ConflictResolver shell + MANUAL adapter factory.
 * Entity adapters supply only labels, filters, action wiring, and preview notes.
 */

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { loadCatalogConflictSignalsAction } from "@/app/admin/actions/sync";
import { refreshPreservingScroll } from "@/lib/admin/preserve-scroll";
import {
  ConflictResolver,
  type ConflictApplyEntry,
  type ConflictApplyOutcome,
  type ConflictEntitySummary,
  type ConflictPreviewEntry,
  type ConflictPreviewModel,
  type ConflictResolverAdapter,
} from "@/components/synarava-cms/conflict-resolver";
import { resolveConflictEntitySummary } from "@/components/synarava-cms/conflict-resolver-confirm";
import type { CatalogConflictDirection, CatalogConflictField } from "@/lib/shopify/catalog-conflict";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

type ToastTone = "success" | "error" | "info";
type EntityIdField = "productId" | "collectionId";

type ManualPreviewRaw = {
  truncated?: boolean;
  excluded: Array<{ fieldKey: string; label: string; reason: string } & Partial<Record<EntityIdField, string>>>;
  entries: Array<{
    field: CatalogConflictField;
    direction: CatalogConflictDirection;
    willClearNonEmptyValue: boolean;
    impactNote?: string | null;
  } & Partial<Record<EntityIdField, string>>>;
};

type ManualApplyRaw = {
  outcome: {
    appliedCount: number;
    failedCount: number;
    results: Array<{ ok: boolean; message?: string | null; fieldKey?: string } & Partial<Record<EntityIdField, string>>>;
  } | null;
  success?: string;
  error?: string;
  warning?: string;
};

type ManualPreviewAction = (scope: {
  kind: "MANUAL";
  selections: Array<Record<string, string>>;
}) => Promise<{ preview?: ManualPreviewRaw | null; error?: string }>;

type ManualApplyAction = (input: {
  acknowledgeClears: boolean;
  entries: Array<Record<string, string>>;
}) => Promise<ManualApplyRaw>;

/** Widen server action signatures for the shared MANUAL factory. */
export function asManualPreviewAction(fn: unknown): ManualPreviewAction {
  return fn as ManualPreviewAction;
}

export function asManualApplyAction(fn: unknown): ManualApplyAction {
  return fn as ManualApplyAction;
}

function entityIdFrom(row: Partial<Record<EntityIdField, string>>, key: EntityIdField): string {
  return row[key] ?? "";
}

/** Shared load/preview/apply wiring — adapters pass entity-specific actions + mapPreview. */
export function createManualConflictAdapter(opts: {
  entityNoun: string;
  entityNounPlural: string;
  ariaLabel: string;
  entityIdField: EntityIdField;
  supportsWholeRecord?: boolean;
  loadEntityFields: (entityId: string) => Promise<{ fields: CatalogConflictField[]; error?: string }>;
  previewAction: ManualPreviewAction;
  applyAction: ManualApplyAction;
  mapPreview: (model: ManualPreviewRaw) => ConflictPreviewModel;
  applyWholeRecord?: ConflictResolverAdapter["applyWholeRecord"];
}): ConflictResolverAdapter {
  const idField = opts.entityIdField;
  return {
    entityNoun: opts.entityNoun,
    entityNounPlural: opts.entityNounPlural,
    ariaLabel: opts.ariaLabel,
    supportsWholeRecord: opts.supportsWholeRecord,
    loadEntityFields: opts.loadEntityFields,
    async previewSelections(selections) {
      const result = await opts.previewAction({
        kind: "MANUAL",
        selections: selections.map((item) => ({
          [idField]: item.entityId,
          fieldKey: item.fieldKey,
          direction: item.direction,
        })),
      });
      if (result.error) return { preview: null, error: result.error };
      if (!result.preview) return { preview: null };
      return { preview: opts.mapPreview(result.preview) };
    },
    async applySelections({ acknowledgeClears, entries }) {
      const result = await opts.applyAction({
        acknowledgeClears,
        entries: entries.map((entry) => ({
          [idField]: entry.entityId,
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
                entityId: entityIdFrom(item, idField),
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
    applyWholeRecord: opts.applyWholeRecord,
  };
}

/** Remap server preview rows (productId/collectionId) into ConflictPreviewModel entries. */
export function mapManualPreviewEntries(
  model: ManualPreviewRaw,
  entityIdField: EntityIdField,
  mapEntry: (entry: ConflictPreviewEntry) => ConflictPreviewEntry = (entry) => entry,
): ConflictPreviewModel {
  return {
    truncated: model.truncated,
    excluded: model.excluded.map((item) => ({
      entityId: entityIdFrom(item, entityIdField),
      fieldKey: item.fieldKey,
      label: item.label,
      reason: item.reason,
    })),
    entries: model.entries.map((entry) => mapEntry({
      entityId: entityIdFrom(entry, entityIdField),
      field: entry.field,
      direction: entry.direction,
      willClearNonEmptyValue: entry.willClearNonEmptyValue,
      impactNote: entry.impactNote ?? null,
    })),
  };
}

export type ManualPreviewRawModel = ManualPreviewRaw;

export function ConflictResolverWorkspace({
  open,
  onClose,
  signals,
  entityIds,
  entities,
  focusedEntityId,
  adapter,
  formBlocked = false,
  onToast,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  signals: CatalogConflictSignals;
  entityIds: string[];
  entities: ConflictEntitySummary[];
  focusedEntityId: string | null;
  adapter: ConflictResolverAdapter;
  formBlocked?: boolean;
  onToast: (message: string, tone: ToastTone) => void;
  onApplied?: (info: { entityIds: string[]; appliedCount: number }) => void | Promise<void>;
}) {
  const router = useRouter();
  void signals;

  return (
    <ConflictResolver
      open={open}
      onClose={onClose}
      adapter={adapter}
      entityIds={entityIds}
      entities={entities}
      focusedEntityId={focusedEntityId}
      formBlocked={formBlocked}
      onToast={onToast}
      onApplied={async (info) => {
        await onApplied?.(info);
        refreshPreservingScroll(router);
      }}
    />
  );
}

type SignalRefresh =
  | { mode: "catalog-reload"; onSignalsChange: (signals: CatalogConflictSignals) => void }
  | { mode: "prune-applied"; sourceSignals: CatalogConflictSignals; onSignalsChange: (signals: CatalogConflictSignals) => void }
  | { mode: "none" };

/** Shared listed+signals → entities/ids wiring for both entity adapters. */
export function ManualConflictWorkspaceShell({
  open,
  onClose,
  signals,
  listed,
  focusedEntityId,
  ensureId,
  detailFromSignal,
  adapter,
  formBlocked = false,
  onToast,
  signalRefresh = { mode: "none" },
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  signals: CatalogConflictSignals;
  listed: ConflictEntitySummary[];
  focusedEntityId: string | null;
  ensureId: string | null;
  detailFromSignal: (signal: CatalogConflictSignals["products"][string]) => string | null;
  adapter: ConflictResolverAdapter;
  formBlocked?: boolean;
  onToast: (message: string, tone: ToastTone) => void;
  signalRefresh?: SignalRefresh;
  onApplied?: (info: { entityIds: string[]; appliedCount: number }) => void | Promise<void>;
}) {
  const entities = useMemo(
    () => mergeConflictEntities(listed, signals, detailFromSignal, adapter.entityNoun),
    [listed, signals, detailFromSignal, adapter.entityNoun],
  );
  const entityIds = useConflictEntityIds(signals, ensureId);

  return (
    <ConflictResolverWorkspace
      open={open}
      onClose={onClose}
      signals={signals}
      entityIds={entityIds}
      entities={entities}
      focusedEntityId={focusedEntityId}
      adapter={adapter}
      formBlocked={formBlocked}
      onToast={onToast}
      onApplied={async (info) => {
        if (onApplied) {
          await onApplied(info);
        } else if (info.appliedCount > 0 && signalRefresh.mode === "catalog-reload") {
          const refreshed = await loadCatalogConflictSignalsAction();
          if (refreshed.signals) signalRefresh.onSignalsChange(refreshed.signals);
          else if (refreshed.error) onToast(refreshed.error, "info");
        } else if (info.appliedCount > 0 && signalRefresh.mode === "prune-applied") {
          const nextProducts = { ...signalRefresh.sourceSignals.products };
          for (const entityId of info.entityIds) delete nextProducts[entityId];
          signalRefresh.onSignalsChange({
            ...signalRefresh.sourceSignals,
            products: nextProducts,
            totalCount: Object.keys(nextProducts).length,
          });
        }
      }}
    />
  );
}

/** Merge list summaries with signal-only entities (presence / remote-only). */
export function mergeConflictEntities(
  listed: ConflictEntitySummary[],
  signals: CatalogConflictSignals,
  detailFromSignal: (signal: CatalogConflictSignals["products"][string]) => string | null,
  entityNoun = "product",
): ConflictEntitySummary[] {
  const map = new Map<string, ConflictEntitySummary>();
  for (const entity of listed) {
    map.set(entity.id, resolveConflictEntitySummary({
      id: entity.id,
      entityNoun,
      entity,
    }));
  }
  for (const [id, signal] of Object.entries(signals.products)) {
    if (map.has(id)) continue;
    const detail = detailFromSignal(signal);
    map.set(id, resolveConflictEntitySummary({
      id,
      entityNoun,
      signal: { name: signal.name, handle: signal.handle, sku: signal.sku },
      entity: detail ? { id, name: signal.name ?? "", detail } : null,
    }));
  }
  return [...map.values()];
}

export function useConflictEntityIds(
  signals: CatalogConflictSignals,
  ensureId: string | null,
): string[] {
  return useMemo(() => {
    const ids = Object.keys(signals.products);
    if (ensureId && !ids.includes(ensureId)) return [ensureId, ...ids];
    return ids;
  }, [signals.products, ensureId]);
}

/**
 * Builds a typed workspace component — entity adapters only supply createAdapter,
 * signal filter, list mapping, and signal-refresh mode.
 */
export function createEntityConflictWorkspace<TViewScope, TItem, TApplied = {
  entityIds: string[];
  appliedCount: number;
}>(config: {
  defaultViewScope: TViewScope;
  filterSignals: (signals: CatalogConflictSignals, viewScope: TViewScope) => CatalogConflictSignals;
  createAdapter: (viewScope: TViewScope) => ConflictResolverAdapter;
  toListed: (item: TItem) => ConflictEntitySummary;
  resolveFocusId: (viewScope: TViewScope, focusedId: string | null) => string | null;
  resolveEnsureId: (viewScope: TViewScope) => string | null;
  detailFromSignal: (signal: CatalogConflictSignals["products"][string]) => string | null;
  signalRefreshMode: "catalog-reload" | "prune-applied";
  mapApplied?: (info: { entityIds: string[]; appliedCount: number }) => TApplied;
}) {
  return function EntityConflictWorkspace({
    open,
    onClose,
    signals,
    onSignalsChange,
    items,
    focusedId,
    viewScope = config.defaultViewScope,
    formBlocked = false,
    onToast,
    onApplied,
  }: {
    open: boolean;
    onClose: () => void;
    signals: CatalogConflictSignals;
    onSignalsChange: (signals: CatalogConflictSignals) => void;
    items: TItem[];
    focusedId: string | null;
    viewScope?: TViewScope;
    formBlocked?: boolean;
    onToast: (message: string, tone: ToastTone) => void;
    onApplied?: (info: TApplied) => void;
  }) {
    const scopedSignals = useMemo(
      () => config.filterSignals(signals, viewScope),
      [signals, viewScope],
    );
    const adapter = useMemo(() => config.createAdapter(viewScope), [viewScope]);
    const listed = useMemo(() => items.map(config.toListed), [items]);
    const signalRefresh: SignalRefresh = config.signalRefreshMode === "catalog-reload"
      ? { mode: "catalog-reload", onSignalsChange }
      : { mode: "prune-applied", sourceSignals: signals, onSignalsChange };

    return (
      <ManualConflictWorkspaceShell
        open={open}
        onClose={onClose}
        signals={scopedSignals}
        listed={listed}
        focusedEntityId={config.resolveFocusId(viewScope, focusedId)}
        ensureId={config.resolveEnsureId(viewScope)}
        detailFromSignal={config.detailFromSignal}
        adapter={adapter}
        formBlocked={formBlocked}
        onToast={onToast}
        signalRefresh={signalRefresh}
        onApplied={onApplied
          ? (info) => {
              const mapped = config.mapApplied
                ? config.mapApplied(info)
                : ({ entityIds: info.entityIds, appliedCount: info.appliedCount } as TApplied);
              onApplied(mapped);
            }
          : undefined}
      />
    );
  };
}

export type { ConflictApplyEntry, ConflictApplyOutcome, ConflictPreviewModel };
