"use client";

/**
 * ONE conflict-resolution UI for products, collections, and any future entity.
 * Rows grouped by item; each row = Shopify (left) | Synarava (right) clickable cells.
 * Footer selects only; Apply opens the existing preview/confirm before any write.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, GitCompareArrows, Languages, LoaderCircle, X } from "lucide-react";

import { AdminButton } from "@/components/admin/shared/admin-button";
import { AdminCheckboxControl } from "@/components/admin/shared/admin-checkbox-field";
import { useAdminShopifyCheckRunning } from "@/components/admin/translations/admin-shopify-check-context";
import {
  describeConflictConfirmChange,
  formatConfirmDirectionSummary,
  resolveConflictEntitySummary,
  summarizeConfirmDirections,
  type ConflictConfirmConsequence,
} from "@/components/synarava-cms/conflict-resolver-confirm";
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
  /** True when confirm will run whole-record pull/push for this entity (blocked commerce). */
  wholeRecord?: boolean;
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
  /**
   * When true, blocked commerce rows are selectable and confirm uses
   * `applyWholeRecord` (product pull/push). Collections omit this.
   */
  supportsWholeRecord?: boolean;
  /** Load live field conflicts for one entity (filtered by the caller’s view scope). */
  loadEntityFields: (entityId: string) => Promise<{ fields: CatalogConflictField[]; error?: string }>;
  /** Preview field-level MANUAL selections — existing server preview, unchanged. */
  previewSelections: (
    selections: Array<{ entityId: string; fieldKey: string; direction: CatalogConflictDirection }>,
  ) => Promise<{ preview: ConflictPreviewModel | null; error?: string }>;
  /** Write field-level previewed entries — existing server apply, unchanged. */
  applySelections: (args: {
    acknowledgeClears: boolean;
    entries: ConflictApplyEntry[];
  }) => Promise<{
    outcome: ConflictApplyOutcome | null;
    success?: string;
    error?: string;
    warning?: string;
  }>;
  /** Whole-record pull (Take Shopify) / push (Keep ours) for blocked commerce. */
  applyWholeRecord?: (
    entityId: string,
    direction: CatalogConflictDirection,
  ) => Promise<{ ok: boolean; success?: string; error?: string }>;
};

/** Commerce fields with no scoped writer — resolved only via whole-record pull/push. */
export function isWholeRecordField(field: CatalogConflictField): boolean {
  return field.origin === "COMMERCE" && Boolean(field.blockedReason);
}

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

function effectiveDirections(
  field: CatalogConflictField,
  supportsWholeRecord: boolean,
): CatalogConflictDirection[] {
  if (supportsWholeRecord && isWholeRecordField(field)) {
    return [CONFLICT_DIRECTIONS.SHOPIFY_TO_SYNARAVA, CONFLICT_DIRECTIONS.SYNARAVA_TO_SHOPIFY];
  }
  if (field.blockedReason) return [];
  return field.allowedDirections;
}

function isSelectableField(field: CatalogConflictField, supportsWholeRecord: boolean): boolean {
  return effectiveDirections(field, supportsWholeRecord).length > 0;
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
  supportsWholeRecord,
  onToggle,
}: {
  field: CatalogConflictField;
  selectedDirection: CatalogConflictDirection | undefined;
  busy: boolean;
  supportsWholeRecord: boolean;
  onToggle: (direction: CatalogConflictDirection) => void;
}) {
  const directions = effectiveDirections(field, supportsWholeRecord);
  const canTakeShopify = directions.includes(CONFLICT_DIRECTIONS.SHOPIFY_TO_SYNARAVA);
  const canKeepOurs = directions.includes(CONFLICT_DIRECTIONS.SYNARAVA_TO_SHOPIFY);
  const wholeRecord = supportsWholeRecord && isWholeRecordField(field);

  return (
    <section className="rounded-xl border border-[var(--adm-border)] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ConflictLocaleMark field={field} />
        <h3 className="text-sm font-semibold">{field.label}</h3>
        {field.origin === "TRANSLATION" ? (
          <span className="text-xs text-[var(--adm-muted)]">Only this language</span>
        ) : null}
        {wholeRecord ? (
          <span className="text-xs text-[var(--adm-muted)]">Whole-item sync</span>
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
      {wholeRecord ? (
        <p className="mt-3 rounded-lg bg-[color-mix(in_srgb,var(--adm-conflict)_12%,transparent)] p-3 text-xs text-[var(--adm-muted)]">
          No field-by-field write for this commerce field. Choosing a side applies a whole-item
          sync for this product (preview lists every commerce field that will change).
        </p>
      ) : field.blockedReason ? (
        <p className="mt-3 rounded-lg bg-[color-mix(in_srgb,var(--adm-conflict)_12%,transparent)] p-3 text-xs text-[var(--adm-muted)]">
          Cannot choose here: {field.blockedReason}
        </p>
      ) : null}
    </section>
  );
}

function confirmConsequenceClass(consequence: ConflictConfirmConsequence): string {
  if (consequence === "create") return "adm-conflict-confirm__row--create";
  if (consequence === "remove") return "adm-conflict-confirm__row--remove";
  return "adm-conflict-confirm__row--update";
}

function ConflictConfirmFlowArrow() {
  return (
    <div className="adm-conflict-flow" aria-hidden="true">
      <span className="adm-conflict-flow__line" />
      <span className="adm-conflict-flow__pulse" />
      <ArrowRight className="adm-conflict-flow__icon size-4" />
    </div>
  );
}

function ConflictConfirmChangeRow({
  entry,
  entity,
  entityNoun,
}: {
  entry: ConflictPreviewEntry;
  entity: ConflictEntitySummary | undefined;
  entityNoun: string;
}) {
  const view = describeConflictConfirmChange(entry, entity, entityNoun);
  return (
    <section
      className={`adm-conflict-confirm__row rounded-xl border p-4 ${confirmConsequenceClass(view.consequence)}`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ConflictLocaleMark field={entry.field} />
        <h3 className="text-sm font-semibold">{view.headline}</h3>
      </div>
      <div className="adm-conflict-confirm__flow">
        <div className="adm-conflict-confirm__cell">
          <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--adm-muted)]">
            {view.sourceLabel}
          </span>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--adm-ink)]">
            {view.sourceValue}
          </p>
        </div>
        <ConflictConfirmFlowArrow />
        <div className={`adm-conflict-confirm__cell adm-conflict-confirm__cell--target-${view.consequence}`}>
          <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--adm-muted)]">
            {view.targetLabel}
          </span>
          <p className="adm-conflict-confirm__before mt-2 whitespace-pre-wrap break-words text-sm">
            {view.beforeValue}
          </p>
          <p className="adm-conflict-confirm__after mt-1 whitespace-pre-wrap break-words text-sm">
            {view.afterValue}
          </p>
        </div>
      </div>
      {entry.willClearNonEmptyValue && view.consequence !== "remove" ? (
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
  );
}

function ConflictPreviewModal({
  preview,
  entitiesById,
  entityNoun,
  applying,
  resultMessage,
  onClose,
  onConfirm,
}: {
  preview: ConflictPreviewModel;
  entitiesById: Map<string, ConflictEntitySummary>;
  entityNoun: string;
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
  const directionSummary = formatConfirmDirectionSummary(
    summarizeConfirmDirections(preview.entries),
  );

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
      <div className="adm-conflict-confirm min-h-0 space-y-4 overflow-y-auto p-5">
        {preview.entries.map((entry) => (
          <ConflictConfirmChangeRow
            key={`${entry.entityId}:${entry.field.fieldKey}`}
            entry={entry}
            entity={entitiesById.get(entry.entityId)}
            entityNoun={entityNoun}
          />
        ))}
        {preview.excluded.length > 0 ? (
          <section className="rounded-xl border border-[var(--adm-warning)] p-4">
            <h3 className="text-sm font-semibold">Not included</h3>
            <ul className="mt-2 space-y-2 text-xs text-[var(--adm-muted)]">
              {preview.excluded.map((item) => {
                const title = resolveConflictEntitySummary({
                  id: item.entityId,
                  entityNoun,
                  entity: entitiesById.get(item.entityId),
                }).name;
                return (
                  <li key={`${item.entityId}:${item.fieldKey}`}>
                    {title} · {item.label}: {item.reason}
                  </li>
                );
              })}
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
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-semibold text-[var(--adm-ink)]" role="status">
            {directionSummary}
          </p>
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

type ConflictResolverProps = {
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
};

/**
 * Outer shell: remount the session when the open entity set changes so
 * selections/preview reset without synchronous setState inside an effect.
 */
export function ConflictResolver(props: ConflictResolverProps) {
  const { open, entityIds, focusedEntityId } = props;
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

  if (!open) return null;

  const sessionKey = loadIds.join("|") || "empty";
  return <ConflictResolverSession key={sessionKey} {...props} loadIds={loadIds} />;
}

function ConflictResolverSession({
  onClose,
  adapter,
  entityIds,
  entities,
  focusedEntityId,
  formBlocked = false,
  onToast,
  onApplied,
  loadIds,
}: ConflictResolverProps & { loadIds: string[] }) {
  // null = still loading; {} = loaded empty. Remount resets this without an effect.
  const [rowsByEntity, setRowsByEntity] = useState<Record<string, CatalogConflictField[]> | null>(
    () => (loadIds.length === 0 ? {} : null),
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [selections, setSelections] = useState<Record<string, CatalogConflictDirection>>({});
  const [preview, setPreview] = useState<ConflictPreviewModel | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const focusedRef = useRef<HTMLElement>(null);
  const checkRunning = useAdminShopifyCheckRunning();
  const supportsWholeRecord = Boolean(adapter.supportsWholeRecord && adapter.applyWholeRecord);
  const entitiesById = useMemo(
    () => new Map(entities.map((entity) => [entity.id, entity])),
    [entities],
  );
  const loading = rowsByEntity === null;
  const loadedRows = useMemo(
    () => rowsByEntity ?? {},
    [rowsByEntity],
  );

  const allRows = useMemo(() => {
    const rows: ConflictRowModel[] = [];
    for (const entityId of loadIds) {
      const fields = orderedConflictFields(loadedRows[entityId] ?? []);
      for (const field of fields) rows.push({ entityId, field });
    }
    return rows;
  }, [loadIds, loadedRows]);

  const selectableRows = useMemo(
    () => allRows.filter((row) => isSelectableField(row.field, supportsWholeRecord)),
    [allRows, supportsWholeRecord],
  );
  const selectedCount = Object.keys(selections).length;
  const busy = applying || loading || previewLoading || checkRunning;

  useEffect(() => {
    if (loadIds.length === 0) return;
    let cancelled = false;
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
          setRowsByEntity({});
        }
      });
    return () => {
      cancelled = true;
    };
    // Session remounts when loadIds change; adapter identity is stable from parent wrappers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadIds.join("|")]);

  useEffect(() => {
    if (!focusedEntityId || loading) return;
    const frame = requestAnimationFrame(() => focusedRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [focusedEntityId, loading]);

  function guardFormBlocked() {
    if (!formBlocked) return false;
    onToast("Save your product changes before resolving conflicts.", "info");
    return true;
  }

  function toggleSelection(entityId: string, field: CatalogConflictField, direction: CatalogConflictDirection) {
    if (busy) return;
    const directions = effectiveDirections(field, supportsWholeRecord);
    if (!directions.includes(direction)) return;
    const wholeRecord = supportsWholeRecord && isWholeRecordField(field);
    setSelections((current) => {
      if (wholeRecord) {
        // One direction for all blocked commerce rows on this item (whole-record intent).
        const blockedKeys = (loadedRows[entityId] ?? [])
          .filter((candidate) => isWholeRecordField(candidate))
          .map((candidate) => selectionKey(entityId, candidate.fieldKey));
        const clearing = blockedKeys.some((key) => current[key] === direction);
        const next = { ...current };
        for (const key of blockedKeys) {
          if (clearing) delete next[key];
          else next[key] = direction;
        }
        return next;
      }
      const key = selectionKey(entityId, field.fieldKey);
      if (current[key] === direction) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      return { ...current, [key]: direction };
    });
  }

  function selectAll(direction: CatalogConflictDirection) {
    if (busy) return;
    setSelections((current) => {
      const next = { ...current };
      for (const row of selectableRows) {
        if (!effectiveDirections(row.field, supportsWholeRecord).includes(direction)) continue;
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
    const picked = Object.entries(selections).map(([key, direction]) => {
      const sep = key.indexOf("::");
      return {
        entityId: key.slice(0, sep),
        fieldKey: key.slice(sep + 2),
        direction,
      };
    });
    const fieldLevel = picked.filter((item) => {
      const field = (loadedRows[item.entityId] ?? []).find((candidate) => candidate.fieldKey === item.fieldKey);
      return field && !isWholeRecordField(field);
    });
    const wholeRecordPicks = picked.filter((item) => {
      const field = (loadedRows[item.entityId] ?? []).find((candidate) => candidate.fieldKey === item.fieldKey);
      return field && isWholeRecordField(field);
    });
    if (wholeRecordPicks.length > 0 && !supportsWholeRecord) {
      onToast(
        "These commerce fields need a whole-item sync path that is not available for this entity type.",
        "error",
      );
      return;
    }
    setResultMessage(null);
    setPreviewLoading(true);
    void (async () => {
      try {
        let fieldPreview: ConflictPreviewModel = { entries: [], excluded: [], truncated: false };
        if (fieldLevel.length > 0) {
          const result = await adapter.previewSelections(fieldLevel);
          if (result.error) {
            onToast(result.error, "error");
            return;
          }
          if (result.preview) fieldPreview = result.preview;
        }
        const wholeRecordEntries: ConflictPreviewEntry[] = [];
        const wholeByEntity = new Map<string, CatalogConflictDirection>();
        for (const pick of wholeRecordPicks) {
          const existing = wholeByEntity.get(pick.entityId);
          if (existing && existing !== pick.direction) {
            onToast(
              "Choose one side for whole-item commerce fields on the same product (Take Shopify or Keep ours, not both).",
              "error",
            );
            return;
          }
          wholeByEntity.set(pick.entityId, pick.direction);
        }
        for (const [entityId, direction] of wholeByEntity) {
          const blockedFields = (loadedRows[entityId] ?? []).filter((field) => isWholeRecordField(field));
          const impactNote = direction === CONFLICT_DIRECTIONS.SHOPIFY_TO_SYNARAVA
            ? "Whole-item sync: Take Shopify pulls the entire commerce record into Synarava (including these fields)."
            : "Whole-item sync: Keep ours pushes the entire Synarava commerce record to Shopify (including these fields).";
          for (const field of blockedFields) {
            wholeRecordEntries.push({
              entityId,
              field,
              direction,
              willClearNonEmptyValue: false,
              impactNote,
              wholeRecord: true,
            });
          }
        }
        setPreview({
          truncated: fieldPreview.truncated,
          excluded: fieldPreview.excluded,
          entries: [...fieldPreview.entries, ...wholeRecordEntries],
        });
      } finally {
        setPreviewLoading(false);
      }
    })();
  }

  function confirm(acknowledgeClears: boolean) {
    if (!preview || applying || guardFormBlocked()) return;
    const submitted = preview;
    setResultMessage(null);
    setApplying(true);
    void (async () => {
      try {
        const fieldEntries = submitted.entries.filter((entry) => !entry.wholeRecord);
        const wholeEntries = submitted.entries.filter((entry) => entry.wholeRecord);
        let appliedCount = 0;
        let failedCount = 0;
        const results: ConflictApplyOutcome["results"] = [];
        const successNotes: string[] = [];

        if (fieldEntries.length > 0) {
          const result = await adapter.applySelections({
            acknowledgeClears,
            entries: fieldEntries.map((entry) => ({
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
          appliedCount += result.outcome.appliedCount;
          failedCount += result.outcome.failedCount;
          results.push(...result.outcome.results);
          if (result.success) successNotes.push(result.success);
          if (result.error) onToast(result.error, result.outcome.appliedCount > 0 ? "info" : "error");
          if (result.warning) onToast(result.warning, "info");
        }

        const wholeByEntity = new Map<string, CatalogConflictDirection>();
        for (const entry of wholeEntries) {
          wholeByEntity.set(entry.entityId, entry.direction);
        }
        for (const [entityId, direction] of wholeByEntity) {
          const whole = await adapter.applyWholeRecord?.(entityId, direction);
          if (!whole?.ok) {
            failedCount += 1;
            const message = whole?.error ?? "Whole-item sync failed.";
            results.push({ entityId, ok: false, message });
            onToast(message, "error");
            continue;
          }
          appliedCount += 1;
          results.push({ entityId, ok: true, message: whole.success });
          if (whole.success) successNotes.push(whole.success);
        }

        const outcome: ConflictApplyOutcome = { appliedCount, failedCount, results };
        if (successNotes.length > 0) {
          const message = successNotes[0]!;
          setResultMessage(message);
          onToast(message, failedCount ? "info" : "success");
        } else if (appliedCount === 0 && failedCount > 0) {
          const message = "Could not apply the changes.";
          setResultMessage(message);
          onToast(message, "error");
        }
        setSelections({});
        setApplying(false);
        if (outcome.appliedCount > 0) {
          const ids = [...new Set(outcome.results.filter((item) => item.ok).map((item) => item.entityId))];
          onApplied?.({ entityIds: ids, appliedCount: outcome.appliedCount });
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

  const grouped = loadIds.map((entityId) => ({
    entityId,
    entity: entitiesById.get(entityId),
    fields: orderedConflictFields(loadedRows[entityId] ?? []),
  }));
  const truncatedLoad = entityIds.length > MAX_LOAD_ENTITIES;

  return (
    <>
      <AnimatedModal
        open={!preview}
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
              Nothing differs right now. Use the Shopify button in the top bar to refresh.
            </p>
          ) : null}
          {truncatedLoad ? (
            <Notice tone="warning">
              Showing the first {MAX_LOAD_ENTITIES} of {entityIds.length} items. Resolve these, then open again for the rest.
            </Notice>
          ) : null}
          {grouped.map(({ entityId, entity, fields }) => {
            const summary = resolveConflictEntitySummary({
              id: entityId,
              entityNoun: adapter.entityNoun,
              entity,
              fields,
            });
            return (
            <article
              key={entityId}
              ref={entityId === focusedEntityId ? focusedRef : undefined}
              tabIndex={entityId === focusedEntityId ? -1 : undefined}
              className="space-y-3 focus-visible:outline-2 focus-visible:outline-[var(--adm-warning)]"
            >
              <div className="border-b border-[var(--adm-border)] pb-2">
                <h3 className="truncate text-sm font-semibold">
                  {summary.name}
                </h3>
                {summary.detail ? (
                  <p className="mt-1 text-xs text-[var(--adm-muted)]">{summary.detail}</p>
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
                  supportsWholeRecord={supportsWholeRecord}
                  onToggle={(direction) => toggleSelection(entityId, field, direction)}
                />
              ))}
            </article>
            );
          })}
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
          entityNoun={adapter.entityNoun}
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
