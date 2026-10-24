"use client";

/**
 * One field-conflict UI for products, collections, and catalog lists.
 * Plain language: differs / keep ours / take Shopify. Preview before every write.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Columns2,
  GitCompareArrows,
  Languages,
  LoaderCircle,
  X,
} from "lucide-react";

import { useAdminShopifyCheckRunning } from "@/components/admin/translations/admin-shopify-check-context";
import { AdminButton, AdminCheckboxControl } from "@/components/synarava-cms";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { Tooltip } from "@/components/ui/tooltip";
import type { CatalogConflictDirection, CatalogConflictField } from "@/lib/shopify/catalog-conflict";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

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

export type FieldConflictEntitySummary = {
  id: string;
  name: string;
  /** SKU, slug, or other secondary line. */
  detail?: string | null;
};

export type FieldConflictPreviewEntry = {
  entityId: string;
  field: CatalogConflictField;
  direction: CatalogConflictDirection;
  willClearNonEmptyValue: boolean;
  /** Optional impact copy (e.g. product-type label shared by N products). */
  impactNote?: string | null;
};

export type FieldConflictPreviewModel = {
  entries: FieldConflictPreviewEntry[];
  excluded: Array<{ entityId: string; fieldKey: string; label: string; reason: string }>;
  truncated?: boolean;
};

export type FieldConflictListAction =
  | { kind: "entity"; entityId: string; direction: CatalogConflictDirection }
  | { kind: "bulk"; direction: CatalogConflictDirection }
  | { kind: "details"; entityId: string };

export const FIELD_CONFLICT_DIRECTION_COPY: Record<
  CatalogConflictDirection,
  { short: string; choose: string; full: string }
> = {
  SHOPIFY_TO_SYNARAVA: {
    short: "Take Shopify",
    choose: "Take Shopify",
    full: "Take Shopify’s value into Synarava",
  },
  SYNARAVA_TO_SHOPIFY: {
    short: "Keep ours",
    choose: "Keep ours",
    full: "Keep our Synarava value and send it to Shopify",
  },
};

export function pluralFields(count: number, singular: string, pluralWord: string) {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

function isLocaleScope(field: CatalogConflictField): field is CatalogConflictField & {
  scope: Extract<CatalogConflictField["scope"], { kind: "LOCALE" }>;
} {
  return field.scope.kind === "LOCALE";
}

export function orderedConflictFields(fields: CatalogConflictField[]) {
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

export function FieldConflictLocaleMark({ field }: { field: CatalogConflictField }) {
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

export function FieldConflictValueCell({
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
        {value || "— empty —"}
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

function presenceLabelFor(
  signal: CatalogConflictSignals["products"][string],
  entityNoun: string,
): string | null {
  if (signal.presence === "SHOPIFY_ONLY") {
    return signal.localProductId ? `Not linked to Shopify` : `Only in Shopify`;
  }
  if (signal.presence === "SYNARAVA_ONLY") {
    return signal.remoteMissing ? `Missing in Shopify` : `Only in Synarava`;
  }
  void entityNoun;
  return null;
}

export function FieldConflictListModal({
  open,
  onClose,
  signals,
  entities,
  focusedEntityId,
  busy,
  hideBulk,
  entityNoun,
  entityNounPlural,
  ariaLabel,
  onAction,
}: {
  open: boolean;
  onClose: () => void;
  signals: CatalogConflictSignals;
  entities: FieldConflictEntitySummary[];
  focusedEntityId: string | null;
  busy: boolean;
  hideBulk?: boolean;
  entityNoun: string;
  entityNounPlural: string;
  ariaLabel: string;
  onAction: (action: FieldConflictListAction) => void;
}) {
  const checkRunning = useAdminShopifyCheckRunning();
  const actionsBusy = busy || checkRunning;
  const focusedRef = useRef<HTMLElement>(null);
  const entitiesById = useMemo(
    () => new Map(entities.map((entity) => [entity.id, entity])),
    [entities],
  );
  const entityIds = useMemo(
    () =>
      Object.keys(signals.products).sort((a, b) => {
        if (a === focusedEntityId) return -1;
        if (b === focusedEntityId) return 1;
        return (entitiesById.get(a)?.name ?? a).localeCompare(entitiesById.get(b)?.name ?? b);
      }),
    [entitiesById, focusedEntityId, signals.products],
  );

  useEffect(() => {
    if (!open || !focusedEntityId) return;
    const frame = requestAnimationFrame(() => focusedRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [focusedEntityId, open]);

  return (
    <AnimatedModal
      open={open}
      onClose={busy ? () => undefined : onClose}
      ariaLabel={ariaLabel}
      portalClassName="admin-modal-root"
      zIndexClassName="z-[200]"
      backdropZIndexClassName="z-[190]"
      className="adm-panel pointer-events-auto grid max-h-[min(88vh,58rem)] w-full max-w-4xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--adm-border)] p-5">
        <div>
          <p className="adm-section-tag">[ DIFFERENCES ]</p>
          <h2 className="adm-title-sm mt-2">
            {pluralFields(entityIds.length, entityNoun, entityNounPlural)} need a decision
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-[var(--adm-muted)]">
            {hideBulk
              ? "Values that differ for this item. Choose a side, or open fields one by one. Nothing is written until you confirm the preview."
              : "Values that differ between Synarava and Shopify. Choose a side for everything, or open one item field by field. Nothing is written until you confirm the preview."}
          </p>
        </div>
        <AdminButton
          variant="ghost"
          className="grid size-11 place-items-center p-0"
          onClick={onClose}
          disabled={busy}
          aria-label="Close differences"
        >
          <X className="size-4" aria-hidden="true" />
        </AdminButton>
      </header>
      <div className="min-h-0 space-y-3 overflow-y-auto p-5">
        {entityIds.length === 0 ? (
          <p className="adm-copy py-8 text-center">
            Nothing differs right now. Run a check to refresh Shopify’s copy.
          </p>
        ) : null}
        {entityIds.map((entityId) => {
          const entity = entitiesById.get(entityId);
          const signal = signals.products[entityId];
          const name = entity?.name ?? signal.name ?? entityId;
          const detail = entity?.detail ?? signal.sku ?? signal.handle;
          const allowedDirections = signal.allowedDirections
            ?? ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"];
          const presence = presenceLabelFor(signal, entityNoun);
          return (
            <article
              key={entityId}
              ref={entityId === focusedEntityId ? focusedRef : undefined}
              tabIndex={entityId === focusedEntityId ? -1 : undefined}
              className="flex flex-col gap-4 rounded-xl border border-[var(--adm-border)] p-4 focus-visible:outline-2 focus-visible:outline-[var(--adm-warning)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold">{name}</h3>
                {detail ? <p className="mt-1 text-xs text-[var(--adm-muted)]">{detail}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {presence ? (
                    <span className="rounded-md border border-[var(--adm-warning)] px-2 py-1 text-xs">
                      {presence}
                    </span>
                  ) : signal.shared ? (
                    <span className="rounded-md border border-[var(--adm-warning)] px-2 py-1 text-xs">
                      Shared fields
                    </span>
                  ) : null}
                  {signal.locales.map((locale) => (
                    <span
                      key={locale.code}
                      className="rounded-md border border-[var(--adm-warning)] px-2 py-1 text-xs"
                    >
                      <Languages className="mr-1 inline size-3" aria-hidden="true" />
                      {locale.code.toUpperCase()} · {locale.nativeName} ·{" "}
                      {pluralFields(locale.count, "field", "fields")}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 gap-2" aria-label={`Actions for ${name}`}>
                {allowedDirections.includes("SHOPIFY_TO_SYNARAVA") ? (
                  <Tooltip content={signal.presence ? "Create or link from Shopify" : "Take Shopify for every field that differs"}>
                    <AdminButton
                      variant="secondary"
                      className="grid size-11 place-items-center p-0"
                      disabled={actionsBusy}
                      onClick={() =>
                        onAction({
                          kind: "entity",
                          entityId,
                          direction: "SHOPIFY_TO_SYNARAVA",
                        })
                      }
                      aria-label="Take Shopify"
                    >
                      <ArrowDownToLine className="size-4" aria-hidden="true" />
                    </AdminButton>
                  </Tooltip>
                ) : null}
                {allowedDirections.includes("SYNARAVA_TO_SHOPIFY") ? (
                  <Tooltip content={signal.presence ? "Create in Shopify from Synarava" : "Keep ours for every field that differs"}>
                    <AdminButton
                      variant="secondary"
                      className="grid size-11 place-items-center p-0"
                      disabled={actionsBusy}
                      onClick={() =>
                        onAction({
                          kind: "entity",
                          entityId,
                          direction: "SYNARAVA_TO_SHOPIFY",
                        })
                      }
                      aria-label="Keep ours"
                    >
                      <ArrowUpFromLine className="size-4" aria-hidden="true" />
                    </AdminButton>
                  </Tooltip>
                ) : null}
                {!signal.presence ? (
                  <Tooltip content="Compare fields and choose side by side">
                    <AdminButton
                      variant="secondary"
                      className="grid size-11 place-items-center p-0"
                      disabled={busy}
                      onClick={() => onAction({ kind: "details", entityId })}
                      aria-label="Compare fields side by side"
                    >
                      <Columns2 className="size-4" aria-hidden="true" />
                    </AdminButton>
                  </Tooltip>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--adm-border)] bg-[var(--adm-panel)] p-4">
        <AdminButton variant="ghost" onClick={onClose} disabled={busy}>
          Close
        </AdminButton>
        {hideBulk ? null : (
          <div className="flex flex-wrap gap-2">
            <AdminButton
              variant="secondary"
              className="inline-flex items-center gap-2"
              disabled={actionsBusy || entityIds.length === 0}
              onClick={() => onAction({ kind: "bulk", direction: "SHOPIFY_TO_SYNARAVA" })}
            >
              <ArrowDownToLine className="size-4" aria-hidden="true" />
              Take Shopify for all
            </AdminButton>
            <AdminButton
              variant="primary"
              className="inline-flex items-center gap-2"
              disabled={actionsBusy || entityIds.length === 0}
              onClick={() => onAction({ kind: "bulk", direction: "SYNARAVA_TO_SHOPIFY" })}
            >
              <ArrowUpFromLine className="size-4" aria-hidden="true" />
              Keep ours for all
            </AdminButton>
          </div>
        )}
      </footer>
    </AnimatedModal>
  );
}

export function FieldConflictDetailsModal({
  open,
  title,
  subtitle,
  fields,
  selections,
  loading,
  applying,
  entityId,
  onClose,
  onSelect,
  onSelectAll,
  onContinue,
  onWholeRecordTakeShopify,
  onWholeRecordKeepOurs,
  wholeRecordHint,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  fields: CatalogConflictField[];
  selections: Record<string, CatalogConflictDirection>;
  loading: boolean;
  applying: boolean;
  entityId: string | null;
  onClose: () => void;
  onSelect: (fieldKey: string, direction: CatalogConflictDirection) => void;
  onSelectAll: (direction: CatalogConflictDirection) => void;
  onContinue: () => void;
  onWholeRecordTakeShopify?: (entityId: string) => void;
  onWholeRecordKeepOurs?: (entityId: string) => void;
  wholeRecordHint?: ReactNode;
}) {
  if (!open) return null;
  const ordered = orderedConflictFields(fields);
  const actionable = ordered.filter(
    (field) => !field.blockedReason && field.allowedDirections.length > 0,
  );
  const onlyBlocked = !loading && ordered.length > 0 && actionable.length === 0;
  const emptyScope = !loading && ordered.length === 0;
  const needsWholeRecordSync = onlyBlocked || emptyScope;
  const hasBlockedCommerce = ordered.some(
    (field) => field.origin === "COMMERCE" && field.blockedReason,
  );
  const showWholeRecordActions = Boolean(
    entityId
    && (needsWholeRecordSync || hasBlockedCommerce)
    && (onWholeRecordTakeShopify || onWholeRecordKeepOurs),
  );
  const checkRunning = useAdminShopifyCheckRunning();
  const busy = applying;
  const actionsBusy = busy || checkRunning;

  return (
    <AnimatedModal
      open
      onClose={busy ? () => undefined : onClose}
      ariaLabel="Choose which values to keep"
      portalClassName="admin-modal-root"
      zIndexClassName="z-[300]"
      backdropZIndexClassName="z-[290]"
      className="adm-panel pointer-events-auto grid max-h-[min(88vh,60rem)] w-full max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0"
    >
      <header className="flex items-start justify-between gap-3 border-b border-[var(--adm-border)] p-5">
        <div>
          <p className="adm-section-tag">[ FIELD CHOICES ]</p>
          <h2 className="adm-title-sm mt-2">{title}</h2>
          <p className="mt-1 text-xs text-[var(--adm-muted)]">
            {subtitle
              ?? (needsWholeRecordSync
                ? "These fields need a whole-item update. Take Shopify pulls into Synarava; Keep ours sends Synarava to Shopify."
                : "Pick Keep ours or Take Shopify for each field that differs. You will preview before anything is written.")}
          </p>
        </div>
        <AdminButton
          variant="ghost"
          className="grid size-11 place-items-center p-0"
          onClick={onClose}
          disabled={busy}
          aria-label="Close field choices"
        >
          <X className="size-4" aria-hidden="true" />
        </AdminButton>
      </header>
      <div className="min-h-0 space-y-4 overflow-y-auto p-5">
        {loading && ordered.length === 0 ? (
          <p className="inline-flex items-center gap-2 text-sm text-[var(--adm-muted)]" role="status">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Loading live comparison…
          </p>
        ) : null}
        {emptyScope ? <Notice>Nothing differs in this view.</Notice> : null}
        {onlyBlocked ? (
          <Notice tone="warning">
            These fields cannot be chosen one-by-one yet. Use Take Shopify or Keep ours below for the whole item.
          </Notice>
        ) : null}
        {wholeRecordHint}
        {ordered.map((field) => (
          <section key={field.fieldKey} className="rounded-xl border border-[var(--adm-border)] p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <FieldConflictLocaleMark field={field} />
              <h3 className="text-sm font-semibold">{field.label}</h3>
              {field.origin === "TRANSLATION" ? (
                <span className="text-xs text-[var(--adm-muted)]">Only this language</span>
              ) : null}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {field.blockedReason ? (
                <>
                  <FieldConflictValueCell label="Ours (Synarava)" value={field.synaravaValue} />
                  <FieldConflictValueCell label="Shopify" value={field.shopifyValue} />
                </>
              ) : (
                <>
                  <FieldConflictValueCell
                    label="Ours (Synarava)"
                    value={field.synaravaValue}
                    disabled={!field.allowedDirections.includes("SYNARAVA_TO_SHOPIFY")}
                    selected={selections[field.fieldKey] === "SYNARAVA_TO_SHOPIFY"}
                    chooseLabel={FIELD_CONFLICT_DIRECTION_COPY.SYNARAVA_TO_SHOPIFY.choose}
                    onSelect={() => onSelect(field.fieldKey, "SYNARAVA_TO_SHOPIFY")}
                  />
                  <FieldConflictValueCell
                    label="Shopify"
                    value={field.shopifyValue}
                    disabled={!field.allowedDirections.includes("SHOPIFY_TO_SYNARAVA")}
                    selected={selections[field.fieldKey] === "SHOPIFY_TO_SYNARAVA"}
                    chooseLabel={FIELD_CONFLICT_DIRECTION_COPY.SHOPIFY_TO_SYNARAVA.choose}
                    onSelect={() => onSelect(field.fieldKey, "SHOPIFY_TO_SYNARAVA")}
                  />
                </>
              )}
            </div>
            {field.blockedReason ? (
              <p className="mt-3 rounded-lg bg-[color-mix(in_srgb,var(--adm-conflict)_12%,transparent)] p-3 text-xs text-[var(--adm-muted)]">
                Cannot choose here: {field.blockedReason}
              </p>
            ) : null}
          </section>
        ))}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--adm-border)] bg-[var(--adm-panel)] p-4">
        <AdminButton variant="secondary" onClick={onClose} disabled={busy}>
          {needsWholeRecordSync ? "Back" : "Cancel"}
        </AdminButton>
        {!needsWholeRecordSync ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <AdminButton
                variant="ghost"
                disabled={actionsBusy || loading || actionable.length === 0}
                onClick={() => onSelectAll("SHOPIFY_TO_SYNARAVA")}
              >
                Take Shopify for visible fields
              </AdminButton>
              <AdminButton
                variant="ghost"
                disabled={actionsBusy || loading || actionable.length === 0}
                onClick={() => onSelectAll("SYNARAVA_TO_SHOPIFY")}
              >
                Keep ours for visible fields
              </AdminButton>
              <span className="text-xs text-[var(--adm-muted)]">
                {Object.keys(selections).length} of {actionable.length} selected
              </span>
            </div>
            <AdminButton
              variant="primary"
              onClick={onContinue}
              disabled={busy || loading || Object.keys(selections).length === 0}
            >
              Preview changes
            </AdminButton>
          </>
        ) : null}
        {showWholeRecordActions && entityId ? (
          <div className="flex flex-wrap gap-2">
            {onWholeRecordTakeShopify ? (
              <AdminButton
                variant="secondary"
                className="inline-flex items-center gap-2"
                disabled={actionsBusy}
                onClick={() => onWholeRecordTakeShopify(entityId)}
              >
                <ArrowDownToLine className="size-4" aria-hidden="true" />
                Take Shopify (whole item)
              </AdminButton>
            ) : null}
            {onWholeRecordKeepOurs ? (
              <AdminButton
                variant="primary"
                className="inline-flex items-center gap-2"
                disabled={actionsBusy}
                onClick={() => onWholeRecordKeepOurs(entityId)}
              >
                <ArrowUpFromLine className="size-4" aria-hidden="true" />
                Keep ours (whole item)
              </AdminButton>
            ) : null}
          </div>
        ) : null}
      </footer>
    </AnimatedModal>
  );
}

export function FieldConflictPreviewModal({
  preview,
  entitiesById,
  applying,
  resultMessage,
  onClose,
  onConfirm,
}: {
  preview: FieldConflictPreviewModel;
  entitiesById: Map<string, FieldConflictEntitySummary>;
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
    && entry.direction === "SHOPIFY_TO_SYNARAVA",
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
              <FieldConflictLocaleMark field={entry.field} />
              <h3 className="text-sm font-semibold">
                {entitiesById.get(entry.entityId)?.name ?? entry.entityId} · {entry.field.label}
              </h3>
              <span className="text-xs font-semibold text-[var(--adm-muted)]">
                {FIELD_CONFLICT_DIRECTION_COPY[entry.direction].full}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FieldConflictValueCell label="Ours (Synarava)" value={entry.field.synaravaValue} />
              <FieldConflictValueCell label="Shopify" value={entry.field.shopifyValue} />
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

export function FieldConflictBusyOverlay({
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
