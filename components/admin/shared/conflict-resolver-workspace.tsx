"use client";

/**
 * Shared ConflictResolver shell — products/collections only supply entity lists,
 * signal filtering, and an adapter (load/preview/apply[/whole-record]).
 */

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { refreshPreservingScroll } from "@/lib/admin/preserve-scroll";
import {
  ConflictResolver,
  type ConflictEntitySummary,
  type ConflictResolverAdapter,
} from "@/components/synarava-cms/conflict-resolver";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

type ToastTone = "success" | "error" | "info";

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
  // Keep signals referenced so callers that only refresh via onApplied stay typed.
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

/** Merge list summaries with signal-only entities (presence / remote-only). */
export function mergeConflictEntities(
  listed: ConflictEntitySummary[],
  signals: CatalogConflictSignals,
  detailFromSignal: (signal: CatalogConflictSignals["products"][string]) => string | null,
): ConflictEntitySummary[] {
  const map = new Map<string, ConflictEntitySummary>();
  for (const entity of listed) map.set(entity.id, entity);
  for (const [id, signal] of Object.entries(signals.products)) {
    if (!map.has(id) && signal.name) {
      map.set(id, { id, name: signal.name, detail: detailFromSignal(signal) });
    }
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
