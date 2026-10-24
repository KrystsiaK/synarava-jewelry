"use client";

/**
 * ONE conflict-resolution UI for products, collections, and any future entity.
 * Rows grouped by item; each row = Shopify (left) | Synarava (right) clickable cells.
 * Footer selects only; Apply opens the existing preview/confirm before any write.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GitCompareArrows, Languages, LoaderCircle, X } from "lucide-react";

import { AdminButton } from "@/components/admin/shared/admin-button";
import { AdminCheckboxControl } from "@/components/admin/shared/admin-checkbox-field";
import { AnimatedModal } from "@/components/ui/animated-modal";
import type { CatalogConflictDirection, CatalogConflictField } from "@/lib/shopify/catalog-conflict";

export const CONFLICT_DIRECTIONS = {
  SHOPIFY_TO_SYNARAVA: "SHOPIFY_TO_SYNARAVA",
  SYNARAVA_TO_SHOPIFY: "SYNARAVA_TO_SHOPIFY",
} as const satisfies Record<CatalogConflictDirection, CatalogConflictDirection>;

export const CONFLICT_DIRECTION_COPY: Record<
  CatalogConflictDirection,
  { short: string; choose: string; full: string }
> = {
  [CONFLICT_DIRECTIONS.SHOPIFY_TO_SYNARAVA]: {
    short: "Take Shopify",
    choose: "Take Shopify",
    full: "Take Shopify’s value into Synarava",
  },
  [CONFLICT_DIRECTIONS.SYNARAVA_TO_SHOPIFY]: {
    short: "Keep ours",
    choose: "Keep ours",
    full: "Keep our Synarava value and send it to Shopify",
  },
};

export type ConflictEntitySummary = {
  id: string;
  name: string;
  detail?: string | null;
};

export type ConflictRowModel = {
  entityId: string;
  field: CatalogConflictField;
};

export type ConflictPreviewEntry = {
  entityId: string;
  field: CatalogConflictField;
  direction: CatalogConflictDirection;
  willClearNonEmptyValue: boolean;
  impactNote?: string | null;
};

export type ConflictPreviewModel = {
  entries: ConflictPreviewEntry[];
  excluded: Array<{ entityId: string; fieldKey: string; label: string; reason: string }>;
  truncated?: boolean;
};

export type ConflictApplyEntry = {
  entityId: string;
  fieldKey: string;
  direction: CatalogConflictDirection;
  expectedLocalFingerprint: string;
  expectedShopifyFingerprint: string;
};

export type ConflictApplyOutcome = {
  appliedCount: number;
  failedCount: number;
  results: Array<{ entityId: string; ok: boolean; message?: string | null }>;
};

export type ConflictResolverAdapter = {
  entityNoun: string;
  entityNounPlural: string;
  ariaLabel: string;
  /** Load live field conflicts for one entity (filtered by the caller’s view scope). */
  loadEntityFields: (entityId: string) => Promise<{ fields: CatalogConflictField[]; error?: string }>;
  /** Preview only the chosen MANUAL selections — existing server preview, unchanged. */
  previewSelections: (
    selections: Array<{ entityId: string; fieldKey: string; direction: CatalogConflictDirection }>,
  ) => Promise<{ preview: ConflictPreviewModel | null; error?: string }>;
  /** Write only the previewed entries — existing server apply, unchanged. */
  applySelections: (args: {
    acknowledgeClears: boolean;
    entries: ConflictApplyEntry[];
  }) => Promise<{
    outcome: ConflictApplyOutcome | null;
    success?: string;
    error?: string;
    warning?: string;
  }>;
};

function pluralFields(count: number, singular: string, pluralWord: string) {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

function selectionKey(entityId: string, fieldKey: string) {
  return `${entityId}::${fieldKey}`;
}

function isLocaleScope(field: CatalogConflictField): field is CatalogConflictField & {
  scope: Extract<CatalogConflictField["scope"], { kind: "LOCALE" }>;
} {
  return field.scope.kind === "LOCALE";
}

function orderedConflictFields(fields: CatalogConflictField[]) {
  return fields.toSorted((left, right) => {
    const leftShared = !isLocaleScope(left);
    const rightShared = !isLocaleScope(right);
    if (leftShared !== rightShared) return leftShared ? -1 : 1;
    if (isLocaleScope(left) && isLocaleScope(right)) {
      return left.scope.code.localeCompare(right.scope.code) || left.label.localeCompare(right.label);
    }
    return left.label.localeCompare(right.label);
  });
}

function isSelectableField(field: CatalogConflictField): boolean {
  return !field.blockedReason && field.allowedDirections.length > 0;
}

function displaySideValue(field: CatalogConflictField, side: "shopify" | "synarava"): string {
  const raw = side === "shopify" ? field.shopifyValue : field.synaravaValue;
  if (field.origin === "PRESENCE") {
    const missing =
      !raw
      || raw === "—"
      || raw.startsWith("— ");
    if (missing) {
      return side === "shopify" ? "Not in Shopify" : "Not in Synarava";
    }
  }
  return raw || "— empty —";
}

function Notice({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "warning" }) {
  return (
    <p
      role="status"
      className={
        tone === "warning"
          ? "rounded-lg border border-[var(--adm-warning)] p-3 text-sm"
          : "rounded-lg border border-[var(--adm-border)] p-3 text-sm text-[var(--adm-muted)]"
      }
    >
      {children}
    </p>
  );
}

export function ConflictLocaleMark({ field }: { field: CatalogConflictField }) {
  if (!isLocaleScope(field)) {
    return (
      <span className="inline-flex items-center rounded-md border border-[var(--adm-warning)] px-2 py-1 text-[0.68rem] font-semibold motion-safe:transition-colors">
        <GitCompareArrows className="mr-1 size-3" aria-hidden="true" />
        Shared
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded-md border border-[var(--adm-warning)] px-2 py-1 text-[0.68rem] font-semibold motion-safe:transition-colors"
      title={`${field.scope.name} · ${field.scope.nativeName}`}
    >
      <Languages className="mr-1 size-3" aria-hidden="true" />
      {field.scope.code.toUpperCase()} · {field.scope.nativeName}
    </span>
  );
}

export function ConflictValueCell({
  label,
  value,
  selected,
  disabled,
  onSelect,
  chooseLabel,
}: {
  label: string;
  value: string;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  chooseLabel?: string;
}) {
  const content = (
    <>
      <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--adm-muted)]">
        {label}
      </span>
      <span className="mt-2 block whitespace-pre-wrap break-words text-sm text-[var(--adm-ink)]">
        {value}
      </span>
    </>
  );
  if (!onSelect) {
    return (
      <div className="min-w-0 rounded-lg border border-[var(--adm-border)] bg-[var(--adm-bg)] p-3">
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className="min-h-24 min-w-0 rounded-lg border p-3 text-left motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        borderColor: selected ? "var(--adm-warning)" : "var(--adm-border)",
        background: selected
          ? "color-mix(in srgb, var(--adm-warning) 10%, var(--adm-panel))"
          : "var(--adm-bg)",
      }}
    >
      {content}
      <span className="mt-3 block text-xs font-semibold">
        {selected ? "Selected" : (chooseLabel ?? "Choose this value")}
      </span>
    </button>
  );
}

export function ConflictRow({
  field,
  selectedDirection,
  busy,
  onToggle,
}: {
  field: CatalogConflictField;
  selectedDirection: CatalogConflictDirection | undefined;
  busy: boolean;
  onToggle: (direction: CatalogConflictDirection) => void;
}) {
  const selectable = isSelectableField(field);
  const canTakeShopify = selectable && field.allowedDirections.includes(CONFLICT_DIRECTIONS.SHOPIFY_TO_SYNARAVA);
  const canKeepOurs = selectable && field.allowedDirections.includes(CONFLICT_DIRECTIONS.SYNARAVA_TO_SHOPIFY);

  return (
    <section className="rounded-xl border border-[var(--adm-border)] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ConflictLocaleMark field={field} />
        <h3 className="text-sm font-semibold">{field.label}</h3>
        {field.origin === "TRANSLATION" ? (
          <span className="text-xs text-[var(--adm-muted)]">Only this language</span>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {canTakeShopify ? (
          <ConflictValueCell
            label="Shopify"
            value={displaySideValue(field, "shopify")}
            selected={selectedDirection === CONFLICT_DIRECTIONS.SHOPIFY_TO_SYNARAVA}
            disabled={busy}
            chooseLabel={CONFLICT_DIRECTION_COPY.SHOPIFY_TO_SYNARAVA.choose}
            onSelect={() => onToggle(CONFLICT_DIRECTIONS.SHOPIFY_TO_SYNARAVA)}
          />
        ) : (
          <ConflictValueCell label="Shopify" value={displaySideValue(field, "shopify")} />
        )}
        {canKeepOurs ? (
          <ConflictValueCell
            label="Synarava (ours)"
            value={displaySideValue(field, "synarava")}
            selected={selectedDirection === CONFLICT_DIRECTIONS.SYNARAVA_TO_SHOPIFY}
            disabled={busy}
            chooseLabel={CONFLICT_DIRECTION_COPY.SYNARAVA_TO_SHOPIFY.choose}
            onSelect={() => onToggle(CONFLICT_DIRECTIONS.SYNARAVA_TO_SHOPIFY)}
          />
        ) : (
          <ConflictValueCell label="Synarava (ours)" value={displaySideValue(field, "synarava")} />
        )}
      </div>
      {field.blockedReason ? (
        <p className="mt-3 rounded-lg bg-[color-mix(in_srgb,var(--adm-conflict)_12%,transparent)] p-3 text-xs text-[var(--adm-muted)]">
          Cannot choose here: {field.blockedReason}
        </p>
      ) : null}
    </section>
  );
}

function ConflictPreviewModal({
  preview,
  entitiesById,
  applying,
  resultMessage,
  onClose,
  onConfirm,
}: {
  preview: ConflictPreviewModel;
  entitiesById: Map<string, ConflictEntitySummary>;
  applying: boolean;
  resultMessage: string | null;
  onClose: () => void;
  onConfirm: (acknowledgeClears: boolean) => void;
}) {
  const [acknowledgeClears, setAcknowledgeClears] = useState(false);
  const hasClears = preview.entries.some((entry) => entry.willClearNonEmptyValue);
  const hasPresenceDelete = preview.entries.some((entry) =>
    entry.field.origin === "PRESENCE"
    && entry.field.presenceDifference?.kind === "SYNARAVA_ONLY"
    && entry.direction === CONFLICT_DIRECTIONS.SHOPIFY_TO_SYNARAVA,
  );
  const clearAckLabel = hasPresenceDelete
    ? "I understand Take Shopify removes these items from Synarava (linked products stay)."
    : "I understand some chosen values are empty and will clear what is stored on the other side.";

  return (
    <AnimatedModal
      open
      onClose={applying ? () => undefined : onClose}
      ariaLabel="Confirm changes before writing"
      portalClassName="admin-modal-root"
      zIndexClassName="z-[400]"
      backdropZIndexClassName="z-[390]"
      className="adm-panel pointer-events-auto grid max-h-[min(90vh,64rem)] w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0"
    >
      <header className="flex items-start justify-between gap-3 border-b border-[var(--adm-border)] p-5">
        <div>
          <p className="adm-section-tag">[ PREVIEW — REQUIRED ]</p>
          <h2 className="adm-title-sm mt-2">
            Confirm {pluralFields(preview.entries.length, "change", "changes")}
          </h2>
          <p className="mt-1 text-xs text-[var(--adm-muted)]">
            Review every change. Values are checked again immediately before each write.
          </p>
        </div>
        <AdminButton
          variant="ghost"
          className="grid size-11 place-items-center p-0"
          onClick={onClose}
          disabled={applying}
          aria-label="Close preview"
        >
          <X className="size-4" aria-hidden="true" />
        </AdminButton>
      </header>
      <div className="min-h-0 space-y-4 overflow-y-auto p-5">
        {preview.entries.map((entry) => (
          <section
            key={`${entry.entityId}:${entry.field.fieldKey}`}
            className="rounded-xl border border-[var(--adm-border)] p-4"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <ConflictLocaleMark field={entry.field} />
              <h3 className="text-sm font-semibold">
                {entitiesById.get(entry.entityId)?.name ?? entry.entityId} · {entry.field.label}
              </h3>
              <span className="text-xs font-semibold text-[var(--adm-muted)]">
                {CONFLICT_DIRECTION_COPY[entry.direction].full}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ConflictValueCell label="Shopify" value={displaySideValue(entry.field, "shopify")} />
              <ConflictValueCell label="Synarava (ours)" value={displaySideValue(entry.field, "synarava")} />
            </div>
            {entry.willClearNonEmptyValue ? (
              <p className="mt-3 text-xs font-semibold text-[var(--adm-warning)]">
                This clears a value that is not empty today.
              </p>
            ) : null}
            {entry.impactNote ? (
              <p className="mt-3 text-xs font-semibold text-[var(--adm-warning)]" role="status">
                {entry.impactNote}
              </p>
            ) : null}
          </section>
        ))}
        {preview.excluded.length > 0 ? (
          <section className="rounded-xl border border-[var(--adm-warning)] p-4">
            <h3 className="text-sm font-semibold">Not included</h3>
            <ul className="mt-2 space-y-2 text-xs text-[var(--adm-muted)]">
              {preview.excluded.map((item) => (
                <li key={`${item.entityId}:${item.fieldKey}`}>
                  {entitiesById.get(item.entityId)?.name ?? item.entityId} · {item.label}:{" "}
                  {item.reason}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {preview.truncated ? (
          <Notice tone="warning">
            This batch hit a safety limit. Confirm these changes, then run again for the rest.
          </Notice>
        ) : null}
        {resultMessage ? <Notice tone="warning">{resultMessage}</Notice> : null}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--adm-border)] bg-[var(--adm-panel)] p-4">
        <div>
          {hasClears ? (
            <AdminCheckboxControl
              className="max-w-xl text-xs"
              checked={acknowledgeClears}
              onChange={(event) => setAcknowledgeClears(event.target.checked)}
              label={clearAckLabel}
              labelClassName="text-xs leading-5"
            />
          ) : (
            <span className="text-xs text-[var(--adm-muted)]">
              Nothing changes until you confirm.
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <AdminButton variant="secondary" onClick={onClose} disabled={applying}>
            Cancel
          </AdminButton>
          <AdminButton
            variant="primary"
            onClick={() => onConfirm(acknowledgeClears)}
            disabled={
              applying
              || preview.entries.length === 0
              || (hasClears && !acknowledgeClears)
            }
          >
            {applying ? "Applying…" : "Confirm changes"}
          </AdminButton>
        </div>
      </footer>
    </AnimatedModal>
  );
}

function ConflictBusyOverlay({
  label,
  mode,
}: {
  label: string;
  mode: "toast" | "blocking";
}) {
  if (mode === "toast") {
    return (
      <div
        className="pointer-events-none fixed inset-x-0 bottom-6 z-[450] grid place-items-center"
        role="status"
        aria-live="polite"
      >
        <span className="inline-flex items-center gap-2 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-panel)] px-4 py-3 text-sm font-semibold shadow-xl">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          {label}
        </span>
      </div>
    );
  }
  return (
    <div
      className="fixed inset-0 z-[500] grid place-items-center bg-[color-mix(in_srgb,var(--adm-bg)_55%,transparent)]"
      role="alertdialog"
      aria-modal="true"
      aria-live="polite"
      aria-label={label}
    >
      <span className="inline-flex items-center gap-2 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-panel)] px-4 py-3 text-sm font-semibold shadow-xl">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        {label}
      </span>
    </div>
  );
}

const MAX_LOAD_ENTITIES = 50;

export function ConflictResolver({
  open,
  onClose,
  adapter,
  entityIds,
  entities,
  focusedEntityId,
  formBlocked = false,
  onToast,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  adapter: ConflictResolverAdapter;
  /** Entity ids with conflicts in the current view (order preserved for focus). */
  entityIds: string[];
  entities: ConflictEntitySummary[];
  focusedEntityId: string | null;
  formBlocked?: boolean;
  onToast: (message: string, tone: "success" | "error" | "info") => void;
  onApplied?: (info: { entityIds: string[]; appliedCount: number }) => void;
}) {
  const [rowsByEntity, setRowsByEntity] = useState<Record<string, CatalogConflictField[]>>({});
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [selections, setSelections] = useState<Record<string, CatalogConflictDirection>>({});
  const [preview, setPreview] = useState<ConflictPreviewModel | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const focusedRef = useRef<HTMLElement>(null);
  const entitiesById = useMemo(
    () => new Map(entities.map((entity) => [entity.id, entity])),
    [entities],
  );

  const loadIds = useMemo(() => {
    const ordered = [...entityIds];
    if (focusedEntityId) {
      ordered.sort((a, b) => {
        if (a === focusedEntityId) return -1;
        if (b === focusedEntityId) return 1;
        return 0;
      });
    }
    return ordered.slice(0, MAX_LOAD_ENTITIES);
  }, [entityIds, focusedEntityId]);

  const allRows = useMemo(() => {
    const rows: ConflictRowModel[] = [];
    for (const entityId of loadIds) {
      const fields = orderedConflictFields(rowsByEntity[entityId] ?? []);
      for (const field of fields) rows.push({ entityId, field });
    }
    return rows;
  }, [loadIds, rowsByEntity]);

  const selectableRows = useMemo(
    () => allRows.filter((row) => isSelectableField(row.field)),
    [allRows],
  );
  const selectedCount = Object.keys(selections).length;
  const busy = applying || loading || previewLoading;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSelections({});
    setPreview(null);
    setResultMessage(null);
    setLoading(true);
    void Promise.all(
      loadIds.map(async (entityId) => {
        const result = await adapter.loadEntityFields(entityId);
        return { entityId, result };
      }),
    )
      .then((results) => {
        if (cancelled) return;
        const next: Record<string, CatalogConflictField[]> = {};
        for (const { entityId, result } of results) {
          if (result.error) onToast(result.error, "error");
          next[entityId] = result.fields;
        }
        setRowsByEntity(next);
      })
      .catch((error) => {
        if (!cancelled) {
          onToast(error instanceof Error ? error.message : "Could not load conflicts.", "error");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Load once per open + entity set; adapter identity is stable from parent wrappers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loadIds.join("|")]);

  useEffect(() => {
    if (!open || !focusedEntityId) return;
    const frame = requestAnimationFrame(() => focusedRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [focusedEntityId, open, loading]);

  function guardFormBlocked() {
    if (!formBlocked) return false;
    onToast("Save your product changes before resolving conflicts.", "info");
    return true;
  }

  function toggleSelection(entityId: string, field: CatalogConflictField, direction: CatalogConflictDirection) {
    if (busy || !isSelectableField(field) || !field.allowedDirections.includes(direction)) return;
    const key = selectionKey(entityId, field.fieldKey);
    setSelections((current) => {
      if (current[key] === direction) {
        const { [key]: _removed, ...rest } = current;
        return rest;
      }
      return { ...current, [key]: direction };
    });
  }

  function selectAll(direction: CatalogConflictDirection) {
    if (busy) return;
    setSelections((current) => {
      const next = { ...current };
      for (const row of selectableRows) {
        if (!row.field.allowedDirections.includes(direction)) continue;
        next[selectionKey(row.entityId, row.field.fieldKey)] = direction;
      }
      return next;
    });
  }

  function closeAll() {
    if (applying) return;
    setPreview(null);
    setSelections({});
    setResultMessage(null);
    onClose();
  }

  function runApplyPreview() {
    if (busy || selectedCount === 0 || guardFormBlocked()) return;
    const manual = Object.entries(selections).map(([key, direction]) => {
      const sep = key.indexOf("::");
      return {
        entityId: key.slice(0, sep),
        fieldKey: key.slice(sep + 2),
        direction,
      };
    });
    setResultMessage(null);
    setPreviewLoading(true);
    void adapter.previewSelections(manual)
      .then((result) => {
        if (result.error) {
          onToast(result.error, "error");
          return;
        }
        if (result.preview) setPreview(result.preview);
      })
      .finally(() => setPreviewLoading(false));
  }

  function confirm(acknowledgeClears: boolean) {
    if (!preview || applying || guardFormBlocked()) return;
    const submitted = preview;
    setResultMessage(null);
    setApplying(true);
    void (async () => {
      try {
        const result = await adapter.applySelections({
          acknowledgeClears,
          entries: submitted.entries.map((entry) => ({
            entityId: entry.entityId,
            fieldKey: entry.field.fieldKey,
            direction: entry.direction,
            expectedLocalFingerprint: entry.field.localFingerprint,
            expectedShopifyFingerprint: entry.field.shopifyFingerprint,
          })),
        });
        if (!result.outcome) {
          const message = result.error ?? "Could not apply the changes.";
          setResultMessage(message);
          onToast(message, "error");
          return;
        }
        const failureDetail = result.outcome.results
          .filter((item) => !item.ok)
          .map((item) => item.message)
          .filter(Boolean)
          .slice(0, 2)
          .join(" · ");
        if (result.error) {
          const message = failureDetail ? `${result.error} ${failureDetail}` : result.error;
          setResultMessage(message);
          onToast(message, result.outcome.appliedCount > 0 ? "info" : "error");
        } else if (result.success) {
          setResultMessage(result.success);
          onToast(result.success, result.outcome.failedCount ? "info" : "success");
        }
        if (result.warning) onToast(result.warning, "info");
        setSelections({});
        setApplying(false);
        if (result.outcome.appliedCount > 0) {
          const ids = [...new Set(result.outcome.results.filter((item) => item.ok).map((item) => item.entityId))];
          onApplied?.({ entityIds: ids, appliedCount: result.outcome.appliedCount });
          onClose();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not apply the changes.";
        setResultMessage(message);
        onToast(message, "error");
      } finally {
        setApplying(false);
      }
    })();
  }

  if (!open) return null;

  const grouped = loadIds.map((entityId) => ({
    entityId,
    entity: entitiesById.get(entityId),
    fields: orderedConflictFields(rowsByEntity[entityId] ?? []),
  }));
  const truncatedLoad = entityIds.length > MAX_LOAD_ENTITIES;

  return (
    <>
      <AnimatedModal
        open={open && !preview}
        onClose={busy ? () => undefined : closeAll}
        ariaLabel={adapter.ariaLabel}
        portalClassName="admin-modal-root"
        zIndexClassName="z-[200]"
        backdropZIndexClassName="z-[190]"
        className="adm-panel pointer-events-auto grid max-h-[min(88vh,60rem)] w-full max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0"
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--adm-border)] p-5">
          <div>
            <p className="adm-section-tag">[ CONFLICTS ]</p>
            <h2 className="adm-title-sm mt-2">
              {pluralFields(entityIds.length, adapter.entityNoun, adapter.entityNounPlural)} need a decision
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-[var(--adm-muted)]">
              Click Shopify (left) or Synarava (right) to choose a side for that conflict. Click again to clear.
              Unchosen conflicts stay as conflicts. Nothing is written until you Apply and confirm the preview.
            </p>
          </div>
          <AdminButton
            variant="ghost"
            className="grid size-11 place-items-center p-0"
            onClick={closeAll}
            disabled={busy}
            aria-label="Close conflicts"
          >
            <X className="size-4" aria-hidden="true" />
          </AdminButton>
        </header>
        <div className="min-h-0 space-y-6 overflow-y-auto p-5">
          {loading && allRows.length === 0 ? (
            <p className="inline-flex items-center gap-2 text-sm text-[var(--adm-muted)]" role="status">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Loading live comparison…
            </p>
          ) : null}
          {!loading && entityIds.length === 0 ? (
            <p className="adm-copy py-8 text-center">
              Nothing differs right now. Run a check to refresh Shopify’s copy.
            </p>
          ) : null}
          {truncatedLoad ? (
            <Notice tone="warning">
              Showing the first {MAX_LOAD_ENTITIES} of {entityIds.length} items. Resolve these, then open again for the rest.
            </Notice>
          ) : null}
          {grouped.map(({ entityId, entity, fields }) => (
            <article
              key={entityId}
              ref={entityId === focusedEntityId ? focusedRef : undefined}
              tabIndex={entityId === focusedEntityId ? -1 : undefined}
              className="space-y-3 focus-visible:outline-2 focus-visible:outline-[var(--adm-warning)]"
            >
              <div className="border-b border-[var(--adm-border)] pb-2">
                <h3 className="truncate text-sm font-semibold">
                  {entity?.name ?? entityId}
                </h3>
                {entity?.detail ? (
                  <p className="mt-1 text-xs text-[var(--adm-muted)]">{entity.detail}</p>
                ) : null}
              </div>
              {fields.length === 0 && !loading ? (
                <Notice>Nothing differs for this item in the current view.</Notice>
              ) : null}
              {fields.map((field) => (
                <ConflictRow
                  key={`${entityId}:${field.fieldKey}`}
                  field={field}
                  selectedDirection={selections[selectionKey(entityId, field.fieldKey)]}
                  busy={busy}
                  onToggle={(direction) => toggleSelection(entityId, field, direction)}
                />
              ))}
            </article>
          ))}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--adm-border)] bg-[var(--adm-panel)] p-4">
          <AdminButton variant="ghost" onClick={closeAll} disabled={busy}>
            Close
          </AdminButton>
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton
              variant="secondary"
              disabled={busy || selectableRows.length === 0}
              onClick={() => selectAll(CONFLICT_DIRECTIONS.SHOPIFY_TO_SYNARAVA)}
            >
              Take Shopify for all
            </AdminButton>
            <AdminButton
              variant="secondary"
              disabled={busy || selectableRows.length === 0}
              onClick={() => selectAll(CONFLICT_DIRECTIONS.SYNARAVA_TO_SHOPIFY)}
            >
              Keep ours for all
            </AdminButton>
            <span className="text-xs text-[var(--adm-muted)]" aria-live="polite">
              {selectedCount} selected
            </span>
            <AdminButton
              variant="primary"
              disabled={busy || selectedCount === 0}
              onClick={runApplyPreview}
            >
              Apply ({selectedCount})
            </AdminButton>
          </div>
        </footer>
      </AnimatedModal>
      {preview ? (
        <ConflictPreviewModal
          preview={preview}
          entitiesById={entitiesById}
          applying={applying}
          resultMessage={resultMessage}
          onClose={() => { if (!applying) { setPreview(null); setResultMessage(null); } }}
          onConfirm={confirm}
        />
      ) : null}
      {previewLoading ? <ConflictBusyOverlay mode="toast" label="Building preview…" /> : null}
      {applying ? <ConflictBusyOverlay mode="blocking" label="Working with Shopify…" /> : null}
    </>
  );
}
