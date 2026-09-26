"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, Columns2, Languages, LoaderCircle, Trash2, X } from "lucide-react";

import {
  applyCollectionConflictResolutionAction,
  loadCollectionCatalogConflictAction,
  previewCollectionConflictResolutionAction,
} from "@/app/admin/actions/sync";
import { refreshPreservingScroll } from "@/lib/admin/preserve-scroll";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { Tooltip } from "@/components/ui/tooltip";
import { AdminCheckboxControl } from "@/components/synarava-cms";
import type {
  CatalogConflictDirection,
  CatalogConflictField,
} from "@/lib/shopify/catalog-conflict";
import type { CollectionCatalogConflict } from "@/lib/shopify/collection-conflict";
import type {
  CollectionConflictApplyScope,
  CollectionConflictPreview,
} from "@/lib/shopify/collection-conflict-apply";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

type CollectionSummary = { id: string; name: string; slug?: string | null };
type ToastTone = "success" | "error" | "info";

export type CollectionConflictViewScope =
  | { kind: "catalog" }
  | { kind: "collection"; collectionId: string }
  | { kind: "collectionLocale"; collectionId: string; locale: string };

const directionCopy: Record<CatalogConflictDirection, { short: string; full: string }> = {
  SHOPIFY_TO_SYNARAVA: { short: "Use Shopify", full: "Apply Shopify to Synarava" },
  SYNARAVA_TO_SHOPIFY: { short: "Use Synarava", full: "Apply Synarava to Shopify" },
};

function presenceDirectionLabel(direction: CatalogConflictDirection, presence: "SHOPIFY_ONLY" | "SYNARAVA_ONLY" | "BOTH" | undefined) {
  if (presence === "SHOPIFY_ONLY" && direction === "SHOPIFY_TO_SYNARAVA") {
    return { short: "Pull from Shopify", full: "Create this collection in Synarava from Shopify" };
  }
  if (presence === "SYNARAVA_ONLY" && direction === "SYNARAVA_TO_SHOPIFY") {
    return { short: "Push to Shopify", full: "Create this collection in Shopify from Synarava" };
  }
  if (presence === "SYNARAVA_ONLY" && direction === "SHOPIFY_TO_SYNARAVA") {
    return { short: "Remove from Synarava", full: "Delete this collection from Synarava (Shopify does not have it)" };
  }
  return directionCopy[direction];
}

function plural(count: number, singular: string, pluralWord: string) {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

function normalizeLocaleCode(locale: string) {
  return locale.trim().toLowerCase();
}

export function fieldMatchesCollectionViewLocale(field: CatalogConflictField, locale: string): boolean {
  const code = normalizeLocaleCode(locale);
  if (code === "en") {
    return field.scope.kind === "SHARED"
      || (field.scope.kind === "LOCALE" && normalizeLocaleCode(field.scope.code) === "en");
  }
  return field.scope.kind === "LOCALE" && normalizeLocaleCode(field.scope.code) === code;
}

function filterFieldsForView(fields: CatalogConflictField[], viewScope: CollectionConflictViewScope | undefined) {
  if (!viewScope || viewScope.kind === "catalog" || viewScope.kind === "collection") return fields;
  return fields.filter((field) => fieldMatchesCollectionViewLocale(field, viewScope.locale));
}

function filterSignalsForView(signals: CatalogConflictSignals, viewScope: CollectionConflictViewScope | undefined): CatalogConflictSignals {
  if (!viewScope || viewScope.kind === "catalog") return signals;
  const collectionId = viewScope.collectionId;
  const signal = signals.products[collectionId];
  if (!signal) return { ...signals, products: {}, totalCount: 0 };
  if (viewScope.kind === "collection") {
    return { ...signals, products: { [collectionId]: signal }, totalCount: 1 };
  }
  const locale = normalizeLocaleCode(viewScope.locale);
  const locales = signal.locales.filter((entry) => normalizeLocaleCode(entry.code) === locale);
  return {
    ...signals,
    products: { [collectionId]: { ...signal, shared: false, locales } },
    totalCount: locales.length > 0 || signal.shared || signal.presence ? 1 : 0,
  };
}

function isCollectionScoped(viewScope: CollectionConflictViewScope | undefined): viewScope is
  | { kind: "collection"; collectionId: string }
  | { kind: "collectionLocale"; collectionId: string; locale: string } {
  return viewScope?.kind === "collection" || viewScope?.kind === "collectionLocale";
}

function LocaleMark({ field }: { field: CatalogConflictField }) {
  if (field.scope.kind === "SHARED") {
    return <span className="inline-flex items-center rounded-md border border-[var(--adm-warning)] px-2 py-1 text-[0.68rem] font-semibold">SHARED</span>;
  }
  return (
    <span className="inline-flex items-center rounded-md border border-[var(--adm-warning)] px-2 py-1 text-[0.68rem] font-semibold" title={`${field.scope.name} · ${field.scope.nativeName}`}>
      <Languages className="mr-1 size-3" />{field.scope.code.toUpperCase()} · {field.scope.nativeName}
    </span>
  );
}

function ValueCell({ label, value, selected, disabled, onSelect, chooseLabel }: {
  label: string;
  value: string;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  chooseLabel?: string;
}) {
  const content = (
    <>
      <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--adm-muted)]">{label}</span>
      <span className="mt-2 block whitespace-pre-wrap break-words text-sm text-[var(--adm-ink)]">{value || "— empty —"}</span>
    </>
  );
  if (!onSelect) return <div className="min-w-0 rounded-lg border border-[var(--adm-border)] bg-[var(--adm-bg)] p-3">{content}</div>;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className="min-h-24 min-w-0 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      style={{ borderColor: selected ? "var(--adm-warning)" : "var(--adm-border)", background: selected ? "color-mix(in srgb, var(--adm-warning) 10%, var(--adm-panel))" : "var(--adm-bg)" }}
    >
      {content}
      <span className="mt-3 block text-xs font-semibold">{selected ? "Selected" : (chooseLabel ?? "Choose this value")}</span>
    </button>
  );
}

function orderedConflictFields(fields: CatalogConflictField[]) {
  return fields.toSorted((left, right) => {
    if (left.scope.kind !== right.scope.kind) return left.scope.kind === "SHARED" ? -1 : 1;
    if (left.scope.kind === "LOCALE" && right.scope.kind === "LOCALE") {
      return left.scope.code.localeCompare(right.scope.code) || left.label.localeCompare(right.label);
    }
    return left.label.localeCompare(right.label);
  });
}

/** Same dialog stack as product catalog conflicts, scoped to collections (translation + presence). */
export function CollectionConflictWorkspace({
  open,
  onClose,
  signals,
  onSignalsChange,
  collections,
  focusedCollectionId,
  viewScope = { kind: "catalog" },
  onToast,
}: {
  open: boolean;
  onClose: () => void;
  signals: CatalogConflictSignals;
  onSignalsChange: (signals: CatalogConflictSignals) => void;
  collections: CollectionSummary[];
  focusedCollectionId: string | null;
  viewScope?: CollectionConflictViewScope;
  onToast: (message: string, tone: ToastTone) => void;
}) {
  const [details, setDetails] = useState<CollectionCatalogConflict | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selections, setSelections] = useState<Record<string, CatalogConflictDirection>>({});
  const [preview, setPreview] = useState<CollectionConflictPreview | null>(null);
  const [activeScope, setActiveScope] = useState<CollectionConflictApplyScope | null>(null);
  const [acknowledgeClears, setAcknowledgeClears] = useState(false);
  const [applying, setApplying] = useState(false);
  const router = useRouter();
  const focusedRef = useRef<HTMLElement>(null);
  const scopedSignals = useMemo(() => filterSignalsForView(signals, viewScope), [signals, viewScope]);
  const scopedFocusId = isCollectionScoped(viewScope) ? viewScope.collectionId : focusedCollectionId;
  const hideBulk = isCollectionScoped(viewScope);
  const collectionsById = useMemo(() => {
    const map = new Map(collections.map((collection) => [collection.id, collection]));
    for (const [collectionId, signal] of Object.entries(scopedSignals.products)) {
      if (!map.has(collectionId) && signal.name) map.set(collectionId, { id: collectionId, name: signal.name, slug: signal.handle });
    }
    return map;
  }, [collections, scopedSignals.products]);
  const collectionIds = useMemo(() => Object.keys(scopedSignals.products).sort((a, b) => {
    if (a === scopedFocusId) return -1;
    if (b === scopedFocusId) return 1;
    return (collectionsById.get(a)?.name ?? a).localeCompare(collectionsById.get(b)?.name ?? b);
  }), [collectionsById, scopedFocusId, scopedSignals.products]);
  const busy = applying || detailsLoading || previewLoading;

  useEffect(() => {
    if (!open || !scopedFocusId) return;
    const frame = requestAnimationFrame(() => focusedRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, scopedFocusId]);

  function closeAll() {
    if (applying) return;
    setPreview(null);
    setDetails(null);
    setDetailsLoading(false);
    setPreviewLoading(false);
    setSelections({});
    onClose();
  }

  function openPreview(scope: CollectionConflictApplyScope) {
    if (applying) return;
    setPreviewLoading(true);
    void previewCollectionConflictResolutionAction(scope)
      .then((result) => {
        if (result.error) {
          onToast(result.error, "error");
          return;
        }
        if (result.preview) {
          const nextPreview = viewScope.kind === "collectionLocale"
            ? {
                ...result.preview,
                entries: result.preview.entries.filter((entry) => fieldMatchesCollectionViewLocale(entry.field, viewScope.locale)),
              }
            : result.preview;
          setActiveScope(scope);
          setPreview(nextPreview);
        }
      })
      .finally(() => setPreviewLoading(false));
  }

  function openDetails(collectionId: string) {
    if (applying) return;
    setDetails(null);
    setSelections({});
    setDetailsLoading(true);
    void loadCollectionCatalogConflictAction(collectionId)
      .then((result) => {
        if (result.error) {
          onToast(result.error, "error");
          return;
        }
        if (result.conflict) {
          setDetails({
            ...result.conflict,
            fields: filterFieldsForView(result.conflict.fields, viewScope),
          });
        }
      })
      .finally(() => setDetailsLoading(false));
  }

  function openCollectionDirection(collectionId: string, direction: CatalogConflictDirection) {
    if (viewScope.kind !== "collectionLocale") {
      openPreview({ kind: "COLLECTION", collectionId, direction });
      return;
    }
    setPreviewLoading(true);
    void loadCollectionCatalogConflictAction(collectionId)
      .then((result) => {
        if (result.error) {
          onToast(result.error, "error");
          setPreviewLoading(false);
          return;
        }
        const fields = filterFieldsForView(result.conflict?.fields ?? [], viewScope)
          .filter((field) => !field.blockedReason && field.allowedDirections.includes(direction));
        if (fields.length === 0) {
          onToast("No supported fields for this language in that direction.", "info");
          setPreviewLoading(false);
          return;
        }
        setPreviewLoading(false);
        openPreview({
          kind: "MANUAL",
          selections: fields.map((field) => ({ collectionId, fieldKey: field.fieldKey, direction })),
        });
      })
      .catch(() => setPreviewLoading(false));
  }

  useEffect(() => {
    if (!open || !isCollectionScoped(viewScope)) return;
    const collectionId = viewScope.collectionId;
    const scope = viewScope;
    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (cancelled) return;
        setDetails(null);
        setSelections({});
        setDetailsLoading(true);
        return loadCollectionCatalogConflictAction(collectionId);
      })
      .then((result) => {
        if (cancelled || !result) return;
        if (result.error) {
          onToast(result.error, "error");
          return;
        }
        if (result.conflict) {
          setDetails({
            ...result.conflict,
            fields: filterFieldsForView(result.conflict.fields, scope),
          });
        }
      })
      .finally(() => {
        if (!cancelled) setDetailsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, viewScope.kind, isCollectionScoped(viewScope) ? viewScope.collectionId : null, viewScope.kind === "collectionLocale" ? viewScope.locale : null]);

  function confirm(acknowledgeClears: boolean) {
    if (!preview || applying) return;
    const submittedPreview = preview;
    const submittedScope = activeScope;
    setPreview(null);
    setDetails(null);
    if (submittedScope?.kind === "BULK") onClose();
    setApplying(true);
    void (async () => {
      try {
        const result = await applyCollectionConflictResolutionAction({
          acknowledgeClears,
          entries: submittedPreview.entries.map((entry) => ({
            collectionId: entry.collectionId,
            fieldKey: entry.field.fieldKey,
            direction: entry.direction,
            expectedLocalFingerprint: entry.field.localFingerprint,
            expectedShopifyFingerprint: entry.field.shopifyFingerprint,
          })),
        });
        if (!result.outcome) {
          onToast(result.error ?? "Could not apply the conflict resolution.", "error");
          return;
        }
        if (result.error) onToast(result.error, result.outcome.appliedCount > 0 ? "info" : "error");
        else if (result.success) onToast(result.success, result.outcome.failedCount ? "info" : "success");
        const successful = new Set(result.outcome.results.filter((item) => item.ok).map((item) => item.collectionId));
        const fullyResolved = [...successful].filter((collectionId) =>
          !result.outcome!.results.some((item) => item.collectionId === collectionId && !item.ok)
          && !submittedPreview.excluded.some((item) => item.collectionId === collectionId),
        );
        setApplying(false);
        if (fullyResolved.length > 0) {
          const nextProducts = { ...signals.products };
          fullyResolved.forEach((collectionId) => delete nextProducts[collectionId]);
          onSignalsChange({ ...signals, products: nextProducts, totalCount: Object.keys(nextProducts).length });
        }
        setSelections({});
        refreshPreservingScroll(router);
      } catch (error) {
        onToast(error instanceof Error ? error.message : "Could not apply the conflict resolution.", "error");
      } finally {
        setApplying(false);
      }
    })();
  }

  const detailFields = details ? orderedConflictFields(details.fields) : [];
  const actionable = detailFields.filter((field) => !field.blockedReason && field.allowedDirections.length > 0);
  const hasClears = Boolean(preview?.entries.some((entry) => entry.willClearNonEmptyValue));

  useEffect(() => {
    setAcknowledgeClears(false);
  }, [preview]);

  return (
    <>
      <AnimatedModal open={open} onClose={busy ? () => undefined : closeAll} ariaLabel="Collection conflicts" portalClassName="admin-modal-root" zIndexClassName="z-[200]" backdropZIndexClassName="z-[190]" className="adm-panel pointer-events-auto grid max-h-[min(88vh,58rem)] w-full max-w-4xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--adm-border)] p-5">
          <div>
            <p className="adm-section-tag">[ COLLECTION CONFLICTS ]</p>
            <h2 className="adm-title-sm mt-2">{plural(collectionIds.length, "collection", "collections")} need a decision</h2>
            <p className="mt-1 max-w-2xl text-xs text-[var(--adm-muted)]">
              {hideBulk
                ? "Conflicts for this collection from the last check. Choose a direction, or open fields side by side. Nothing is written until the final confirmation."
                : "This is the list from the last conflict check. Choose a direction, or open one collection field by field. Nothing is written until the final confirmation."}
            </p>
          </div>
          <button type="button" onClick={closeAll} disabled={busy} className="adm-btn-ghost grid size-11 place-items-center p-0" aria-label="Close collection conflicts"><X className="size-4" /></button>
        </header>
        <div className="min-h-0 space-y-3 overflow-y-auto p-5">
          {collectionIds.length === 0 ? <p className="adm-copy py-8 text-center">No saved conflicts. Run a conflict check to confirm the latest Shopify state.</p> : null}
          {collectionIds.map((collectionId) => {
            const collection = collectionsById.get(collectionId);
            const signal = scopedSignals.products[collectionId];
            const name = collection?.name ?? signal?.name ?? `Collection ${collectionId}`;
            const slug = collection?.slug ?? signal?.handle;
            const allowedDirections = signal?.allowedDirections ?? ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"];
            const presenceLabel = signal?.presence === "SHOPIFY_ONLY"
              ? signal.localProductId ? "Not linked to Shopify" : "Only in Shopify"
              : signal?.presence === "SYNARAVA_ONLY"
                ? signal.remoteMissing ? "Missing in Shopify" : "Only in Synarava"
                : null;
            return (
              <article key={collectionId} ref={collectionId === scopedFocusId ? focusedRef : undefined} tabIndex={collectionId === scopedFocusId ? -1 : undefined} className="flex flex-col gap-4 rounded-xl border border-[var(--adm-border)] p-4 focus-visible:outline-2 focus-visible:outline-[var(--adm-warning)] sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">{name}</h3>
                  {slug ? <p className="mt-1 text-xs text-[var(--adm-muted)]">/{slug}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {presenceLabel ? <span className="rounded-md border border-[var(--adm-warning)] px-2 py-1 text-xs">{presenceLabel}</span> : null}
                    {(signal?.locales ?? []).map((locale) => (
                      <span key={locale.code} className="rounded-md border border-[var(--adm-warning)] px-2 py-1 text-xs">
                        <Languages className="mr-1 inline size-3" />{locale.code.toUpperCase()} · {locale.nativeName} · {plural(locale.count, "field", "fields")}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2" aria-label={`Actions for ${name}`}>
                  {allowedDirections.includes("SHOPIFY_TO_SYNARAVA") ? (
                    <Tooltip content={presenceDirectionLabel("SHOPIFY_TO_SYNARAVA", signal?.presence).full}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openCollectionDirection(collectionId, "SHOPIFY_TO_SYNARAVA")}
                        className="adm-btn-secondary grid size-11 place-items-center p-0"
                        aria-label={presenceDirectionLabel("SHOPIFY_TO_SYNARAVA", signal?.presence).short}
                      >
                        {signal?.presence === "SYNARAVA_ONLY"
                          ? <Trash2 className="size-4" />
                          : <ArrowDownToLine className="size-4" />}
                      </button>
                    </Tooltip>
                  ) : null}
                  {allowedDirections.includes("SYNARAVA_TO_SHOPIFY") ? (
                    <Tooltip content={presenceDirectionLabel("SYNARAVA_TO_SHOPIFY", signal?.presence).full}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openCollectionDirection(collectionId, "SYNARAVA_TO_SHOPIFY")}
                        className="adm-btn-secondary grid size-11 place-items-center p-0"
                        aria-label={presenceDirectionLabel("SYNARAVA_TO_SHOPIFY", signal?.presence).short}
                      >
                        <ArrowUpFromLine className="size-4" />
                      </button>
                    </Tooltip>
                  ) : null}
                  {!signal?.presence ? (
                    <Tooltip content="Compare fields and choose Shopify or Synarava separately">
                      <button type="button" disabled={busy} onClick={() => openDetails(collectionId)} className="adm-btn-secondary grid size-11 place-items-center p-0" aria-label="Compare fields side by side"><Columns2 className="size-4" /></button>
                    </Tooltip>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--adm-border)] bg-[var(--adm-panel)] p-4">
          <button type="button" onClick={closeAll} disabled={busy} className="adm-btn-ghost">Close</button>
          {hideBulk ? null : (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy || collectionIds.length === 0} onClick={() => openPreview({ kind: "BULK", direction: "SHOPIFY_TO_SYNARAVA" })} className="adm-btn-secondary inline-flex items-center gap-2" title="Take Shopify for every conflicted field. Synarava-only collections will be deleted."><ArrowDownToLine className="size-4" />Use Shopify for all</button>
              <button type="button" disabled={busy || collectionIds.length === 0} onClick={() => openPreview({ kind: "BULK", direction: "SYNARAVA_TO_SHOPIFY" })} className="adm-btn-primary inline-flex items-center gap-2" title="Take Synarava for every conflicted field. Synarava-only collections will be created in Shopify."><ArrowUpFromLine className="size-4" />Use Synarava for all</button>
            </div>
          )}
        </footer>
      </AnimatedModal>

      {details || detailsLoading ? (
        <AnimatedModal open onClose={busy ? () => undefined : () => { setDetails(null); setDetailsLoading(false); setSelections({}); }} ariaLabel="Choose collection conflict values" portalClassName="admin-modal-root" zIndexClassName="z-[300]" backdropZIndexClassName="z-[290]" className="adm-panel pointer-events-auto grid max-h-[min(88vh,60rem)] w-full max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0">
          <header className="flex items-start justify-between gap-3 border-b border-[var(--adm-border)] p-5">
            <div>
              <p className="adm-section-tag">[ FIELD DECISIONS ]</p>
              <h2 className="adm-title-sm mt-2">{details ? collectionsById.get(details.collectionId)?.name ?? "Collection conflict" : "Collection conflict"}</h2>
              <p className="mt-1 text-xs text-[var(--adm-muted)]">Each language is independent. Pick either side for the fields you want to merge.</p>
            </div>
            <button type="button" onClick={() => { if (!applying) { setDetails(null); setDetailsLoading(false); setSelections({}); } }} disabled={applying} className="adm-btn-ghost grid size-11 place-items-center p-0" aria-label="Close conflict details"><X className="size-4" /></button>
          </header>
          <div className="min-h-0 space-y-4 overflow-y-auto p-5">
            {detailsLoading && !details ? (
              <p className="inline-flex items-center gap-2 text-sm text-[var(--adm-muted)]" role="status">
                <LoaderCircle className="size-4 animate-spin" />Loading field comparison…
              </p>
            ) : null}
            {detailFields.map((field) => {
              const isPresence = field.origin === "PRESENCE";
              const presenceKind = field.presenceDifference?.kind;
              return (
              <section key={field.fieldKey} className="rounded-xl border border-[var(--adm-border)] p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <LocaleMark field={field} />
                  <h3 className="text-sm font-semibold">{field.label}</h3>
                  <span className="text-xs text-[var(--adm-muted)]">
                    {isPresence
                      ? "Choose Shopify to remove it here, or Synarava to create it in Shopify."
                      : "Only this language value is affected"}
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <ValueCell
                    label="Synarava"
                    value={field.synaravaValue}
                    disabled={!field.allowedDirections.includes("SYNARAVA_TO_SHOPIFY")}
                    selected={selections[field.fieldKey] === "SYNARAVA_TO_SHOPIFY"}
                    onSelect={() => setSelections((current) => ({ ...current, [field.fieldKey]: "SYNARAVA_TO_SHOPIFY" }))}
                    chooseLabel={presenceKind === "SYNARAVA_ONLY" ? "Keep & push to Shopify" : undefined}
                  />
                  <ValueCell
                    label="Shopify"
                    value={field.shopifyValue}
                    disabled={!field.allowedDirections.includes("SHOPIFY_TO_SYNARAVA")}
                    selected={selections[field.fieldKey] === "SHOPIFY_TO_SYNARAVA"}
                    onSelect={() => setSelections((current) => ({ ...current, [field.fieldKey]: "SHOPIFY_TO_SYNARAVA" }))}
                    chooseLabel={presenceKind === "SYNARAVA_ONLY" ? "Remove from Synarava" : undefined}
                  />
                </div>
              </section>
              );
            })}
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--adm-border)] bg-[var(--adm-panel)] p-4">
            <button type="button" onClick={() => { if (!applying) { setDetails(null); setDetailsLoading(false); setSelections({}); } }} disabled={applying} className="adm-btn-secondary">Cancel</button>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={applying || detailsLoading || actionable.length === 0} onClick={() => setSelections(Object.fromEntries(actionable.map((field) => [field.fieldKey, "SHOPIFY_TO_SYNARAVA" as const])))} className="adm-btn-ghost">Select Shopify for visible fields</button>
              <button type="button" disabled={applying || detailsLoading || actionable.length === 0} onClick={() => setSelections(Object.fromEntries(actionable.map((field) => [field.fieldKey, "SYNARAVA_TO_SHOPIFY" as const])))} className="adm-btn-ghost">Select Synarava for visible fields</button>
              <span className="text-xs text-[var(--adm-muted)]">{Object.keys(selections).length} of {actionable.length} selected</span>
            </div>
            <button
              type="button"
              onClick={() => details && openPreview({
                kind: "MANUAL",
                selections: Object.entries(selections).map(([fieldKey, direction]) => ({
                  collectionId: details.collectionId,
                  fieldKey,
                  direction,
                })),
              })}
              disabled={applying || detailsLoading || Object.keys(selections).length === 0}
              className="adm-btn-primary"
            >
              Review merge
            </button>
          </footer>
        </AnimatedModal>
      ) : null}

      {preview ? (
        <AnimatedModal open onClose={applying ? () => undefined : () => setPreview(null)} ariaLabel="Confirm collection conflict changes" portalClassName="admin-modal-root" zIndexClassName="z-[400]" backdropZIndexClassName="z-[390]" className="adm-panel pointer-events-auto grid max-h-[min(88vh,58rem)] w-full max-w-4xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0">
          <header className="flex items-start justify-between gap-3 border-b border-[var(--adm-border)] p-5">
            <div>
              <p className="adm-section-tag">[ CONFIRM CHANGES ]</p>
              <h2 className="adm-title-sm mt-2">{plural(preview.entries.length, "change", "changes")} ready to apply</h2>
              <p className="mt-1 text-xs text-[var(--adm-muted)]">Review each field before writing. Cancel returns to the previous step without saving.</p>
            </div>
            <button type="button" onClick={() => { if (!applying) setPreview(null); }} disabled={applying} className="adm-btn-ghost grid size-11 place-items-center p-0" aria-label="Close preview"><X className="size-4" /></button>
          </header>
          <div className="min-h-0 space-y-3 overflow-y-auto p-5">
            {preview.entries.map((entry) => {
              const presenceKind = entry.field.presenceDifference?.kind;
              const actionLabel = presenceKind
                ? presenceDirectionLabel(entry.direction, presenceKind).full
                : directionCopy[entry.direction].full;
              return (
              <article key={`${entry.collectionId}:${entry.field.fieldKey}:${entry.direction}`} className="rounded-xl border border-[var(--adm-border)] p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <LocaleMark field={entry.field} />
                  <h3 className="text-sm font-semibold">{collectionsById.get(entry.collectionId)?.name ?? entry.collectionId} · {entry.field.label}</h3>
                  <span className="text-xs text-[var(--adm-muted)]">{actionLabel}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <ValueCell label="Synarava now" value={entry.field.synaravaValue} />
                  <ValueCell label="Shopify now" value={entry.field.shopifyValue} />
                </div>
                {entry.field.origin === "PRESENCE" && entry.direction === "SHOPIFY_TO_SYNARAVA" && presenceKind === "SYNARAVA_ONLY" ? (
                  <p className="mt-3 text-xs text-[var(--adm-danger)]">This deletes the collection from Synarava. Products stay; only the collection record is removed.</p>
                ) : entry.willClearNonEmptyValue ? (
                  <p className="mt-3 text-xs text-[var(--adm-danger)]">This clears a non-empty value on the destination side.</p>
                ) : null}
              </article>
              );
            })}
            {preview.excluded.map((entry) => (
              <p key={`${entry.collectionId}:${entry.fieldKey}:excluded`} className="rounded-lg border border-[var(--adm-border)] p-3 text-xs text-[var(--adm-muted)]">
                Not included · {collectionsById.get(entry.collectionId)?.name ?? entry.collectionId} · {entry.label}: {entry.reason}
              </p>
            ))}
            {preview.truncated ? <p className="text-xs text-[var(--adm-muted)]">Batch was truncated to keep the request size safe. Resolve remaining collections after this run.</p> : null}
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--adm-border)] bg-[var(--adm-panel)] p-4">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => { if (!applying) setPreview(null); }} disabled={applying} className="adm-btn-secondary">Cancel</button>
              {hasClears ? (
                <AdminCheckboxControl
                  className="max-w-xl text-xs"
                  checked={acknowledgeClears}
                  onChange={(event) => setAcknowledgeClears(event.target.checked)}
                  label={
                    preview.entries.some((entry) =>
                      entry.field.origin === "PRESENCE"
                      && entry.field.presenceDifference?.kind === "SYNARAVA_ONLY"
                      && entry.direction === "SHOPIFY_TO_SYNARAVA",
                    )
                      ? "I understand that choosing Shopify deletes these collections from Synarava (products are kept)."
                      : "I understand that the selected source contains empty values and the destination values shown above will be cleared."
                  }
                  labelClassName="text-xs leading-5"
                />
              ) : null}
            </div>
            <button type="button" onClick={() => confirm(acknowledgeClears)} disabled={applying || preview.entries.length === 0 || (hasClears && !acknowledgeClears)} className="adm-btn-primary">{applying ? "Applying…" : "Confirm changes"}</button>
          </footer>
        </AnimatedModal>
      ) : null}

      {previewLoading ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[450] grid place-items-center" role="status" aria-live="polite">
          <span className="inline-flex items-center gap-2 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-panel)] px-4 py-3 text-sm font-semibold shadow-xl">
            <LoaderCircle className="size-4 animate-spin" />Building preview…
          </span>
        </div>
      ) : null}
      {applying ? (
        <div className="fixed inset-0 z-[500] grid place-items-center bg-[color-mix(in_srgb,var(--adm-bg)_55%,transparent)]" role="alertdialog" aria-modal="true" aria-live="polite" aria-label="Working with Shopify">
          <span className="inline-flex items-center gap-2 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-panel)] px-4 py-3 text-sm font-semibold shadow-xl">
            <LoaderCircle className="size-4 animate-spin" />Working with Shopify…
          </span>
        </div>
      ) : null}
    </>
  );
}
