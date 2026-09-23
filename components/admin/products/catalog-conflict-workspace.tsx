"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, Columns2, GitCompareArrows, Languages, LoaderCircle, X } from "lucide-react";

import {
  applyCatalogConflictResolutionAction,
  loadProductCatalogConflictAction,
  previewCatalogConflictResolutionAction,
} from "@/app/admin/actions/sync";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { Tooltip } from "@/components/ui/tooltip";
import { AdminCheckboxControl } from "@/components/admin/shared/admin-checkbox-field";
import type {
  CatalogConflictApplyScope,
  CatalogConflictPreview,
} from "@/lib/shopify/catalog-conflict-apply";
import type {
  CatalogConflictDirection,
  CatalogConflictField,
  ProductCatalogConflict,
} from "@/lib/shopify/catalog-conflict";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

type ProductSummary = { id: string; name: string; sku: string | null };
type ToastTone = "success" | "error" | "info";

/** Same conflict UI, different tree node: full catalog, one product, or one product locale. */
export type CatalogConflictViewScope =
  | { kind: "catalog" }
  | { kind: "product"; productId: string }
  | { kind: "productLocale"; productId: string; locale: string };

const directionCopy: Record<CatalogConflictDirection, { short: string; full: string }> = {
  SHOPIFY_TO_SYNARAVA: { short: "Use Shopify", full: "Apply Shopify values to Synarava" },
  SYNARAVA_TO_SHOPIFY: { short: "Use Synarava", full: "Apply Synarava values to Shopify" },
};

function plural(count: number, singular: string, pluralWord: string) {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

function normalizeLocaleCode(locale: string) {
  return locale.trim().toLowerCase();
}

/** EN/source includes SHARED commerce + EN translation rows; other tabs are locale-only. */
export function fieldMatchesViewLocale(field: CatalogConflictField, locale: string): boolean {
  const code = normalizeLocaleCode(locale);
  if (code === "en") {
    return field.scope.kind === "SHARED"
      || (field.scope.kind === "LOCALE" && normalizeLocaleCode(field.scope.code) === "en");
  }
  return field.scope.kind === "LOCALE" && normalizeLocaleCode(field.scope.code) === code;
}

export function filterConflictFieldsForView(
  fields: CatalogConflictField[],
  viewScope: CatalogConflictViewScope | undefined,
): CatalogConflictField[] {
  if (!viewScope || viewScope.kind === "catalog" || viewScope.kind === "product") return fields;
  return fields.filter((field) => fieldMatchesViewLocale(field, viewScope.locale));
}

export function filterSignalsForView(
  signals: CatalogConflictSignals,
  viewScope: CatalogConflictViewScope | undefined,
): CatalogConflictSignals {
  if (!viewScope || viewScope.kind === "catalog") return signals;
  const productId = viewScope.productId;
  const signal = signals.products[productId];
  if (!signal) {
    return { ...signals, products: {}, totalCount: 0 };
  }
  if (viewScope.kind === "product") {
    return { ...signals, products: { [productId]: signal }, totalCount: 1 };
  }
  const locale = normalizeLocaleCode(viewScope.locale);
  const locales = signal.locales.filter((entry) => normalizeLocaleCode(entry.code) === locale);
  const shared = locale === "en" ? signal.shared : false;
  const hasLocaleConflict = locales.some((entry) => entry.count > 0);
  if (!hasLocaleConflict && !shared && !signal.presence) {
    return { ...signals, products: {}, totalCount: 0 };
  }
  return {
    ...signals,
    products: {
      [productId]: {
        ...signal,
        shared,
        locales,
      },
    },
    totalCount: 1,
  };
}

function isProductScoped(viewScope: CatalogConflictViewScope | undefined): viewScope is
  | { kind: "product"; productId: string }
  | { kind: "productLocale"; productId: string; locale: string } {
  return viewScope?.kind === "product" || viewScope?.kind === "productLocale";
}

function LocaleMark({ field }: { field: CatalogConflictField }) {
  if (field.scope.kind === "SHARED") {
    return <span className="inline-flex items-center rounded-md border border-[var(--adm-warning)] px-2 py-1 text-[0.68rem] font-semibold"><GitCompareArrows className="mr-1 size-3" />SHARED</span>;
  }
  return (
    <span className="inline-flex items-center rounded-md border border-[var(--adm-warning)] px-2 py-1 text-[0.68rem] font-semibold" title={`${field.scope.name} · ${field.scope.nativeName}`}>
      <Languages className="mr-1 size-3" />{field.scope.code.toUpperCase()} · {field.scope.nativeName}
    </span>
  );
}

function ValueCell({ label, value, selected, disabled, onSelect }: {
  label: string;
  value: string;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
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
      <span className="mt-3 block text-xs font-semibold">{selected ? "Selected" : "Choose this value"}</span>
    </button>
  );
}

function ConflictListModal({ open, onClose, signals, products, focusedProductId, busy, hideBulk, onPreview, onDetails }: {
  open: boolean;
  onClose: () => void;
  signals: CatalogConflictSignals;
  products: ProductSummary[];
  focusedProductId: string | null;
  busy: boolean;
  hideBulk?: boolean;
  onPreview: (scope: CatalogConflictApplyScope) => void;
  onDetails: (productId: string) => void;
}) {
  const focusedRef = useRef<HTMLElement>(null);
  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const productIds = useMemo(() => Object.keys(signals.products).sort((a, b) => {
    if (a === focusedProductId) return -1;
    if (b === focusedProductId) return 1;
    return (productsById.get(a)?.name ?? a).localeCompare(productsById.get(b)?.name ?? b);
  }), [focusedProductId, productsById, signals.products]);

  useEffect(() => {
    if (!open || !focusedProductId) return;
    const frame = requestAnimationFrame(() => focusedRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [focusedProductId, open]);

  return (
    <AnimatedModal open={open} onClose={busy ? () => undefined : onClose} ariaLabel="Catalog conflicts" portalClassName="admin-modal-root" zIndexClassName="z-[200]" backdropZIndexClassName="z-[190]" className="adm-panel pointer-events-auto grid max-h-[min(88vh,58rem)] w-full max-w-4xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--adm-border)] p-5">
        <div>
          <p className="adm-section-tag">[ CATALOG CONFLICTS ]</p>
          <h2 className="adm-title-sm mt-2">{plural(productIds.length, "product", "products")} need a decision</h2>
          <p className="mt-1 max-w-2xl text-xs text-[var(--adm-muted)]">
            {hideBulk
              ? "Conflicts for this product from the last check. Choose a direction, or open fields side by side. Nothing is written until the final confirmation."
              : "This is the list from the last conflict check. Choose a direction, or open one product field by field. Nothing is written until the final confirmation."}
          </p>
        </div>
        <button type="button" onClick={onClose} disabled={busy} className="adm-btn-ghost grid size-11 place-items-center p-0" aria-label="Close catalog conflicts"><X className="size-4" /></button>
      </header>
      <div className="min-h-0 space-y-3 overflow-y-auto p-5">
        {productIds.length === 0 ? <p className="adm-copy py-8 text-center">No saved conflicts. Run a conflict check to confirm the latest Shopify state.</p> : null}
        {productIds.map((productId) => {
          const product = productsById.get(productId);
          const signal = signals.products[productId];
          const productName = product?.name ?? signal.name ?? `Product ${productId}`;
          const productSku = product?.sku ?? signal.sku;
          const allowedDirections = signal.allowedDirections ?? ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"];
          const presenceLabel = signal.presence === "SHOPIFY_ONLY"
            ? signal.localProductId ? "Not linked to Shopify" : "Only in Shopify"
            : signal.presence === "SYNARAVA_ONLY"
              ? signal.remoteMissing ? "Missing in Shopify" : "Only in Synarava"
              : null;
          return (
            <article key={productId} ref={productId === focusedProductId ? focusedRef : undefined} tabIndex={productId === focusedProductId ? -1 : undefined} className="flex flex-col gap-4 rounded-xl border border-[var(--adm-border)] p-4 focus-visible:outline-2 focus-visible:outline-[var(--adm-warning)] sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold">{productName}</h3>
                {productSku ? <p className="mt-1 text-xs text-[var(--adm-muted)]">SKU {productSku}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {presenceLabel ? <span className="rounded-md border border-[var(--adm-warning)] px-2 py-1 text-xs">{presenceLabel}</span> : signal.shared ? <span className="rounded-md border border-[var(--adm-warning)] px-2 py-1 text-xs">Shared commerce fields</span> : null}
                  {signal.locales.map((locale) => <span key={locale.code} className="rounded-md border border-[var(--adm-warning)] px-2 py-1 text-xs"><Languages className="mr-1 inline size-3" />{locale.code.toUpperCase()} · {locale.nativeName} · {plural(locale.count, "field", "fields")}</span>)}
                </div>
              </div>
              <div className="flex shrink-0 gap-2" aria-label={`Actions for ${productName}`}>
                {allowedDirections.includes("SHOPIFY_TO_SYNARAVA") ? <Tooltip content={signal.presence ? "Create or link this product in Synarava from Shopify" : "Use Shopify for every supported conflicting field in this product"}><button type="button" disabled={busy} onClick={() => onPreview({ kind: "PRODUCT", productId, direction: "SHOPIFY_TO_SYNARAVA" })} className="adm-btn-secondary grid size-11 place-items-center p-0" aria-label={signal.presence ? "Pull product from Shopify" : "Apply Shopify values"}><ArrowDownToLine className="size-4" /></button></Tooltip> : null}
                {allowedDirections.includes("SYNARAVA_TO_SHOPIFY") ? <Tooltip content={signal.presence ? "Create this product in Shopify from Synarava" : "Use Synarava for every supported conflicting field in this product"}><button type="button" disabled={busy} onClick={() => onPreview({ kind: "PRODUCT", productId, direction: "SYNARAVA_TO_SHOPIFY" })} className="adm-btn-secondary grid size-11 place-items-center p-0" aria-label={signal.presence ? "Push product to Shopify" : "Apply Synarava values"}><ArrowUpFromLine className="size-4" /></button></Tooltip> : null}
                {!signal.presence ? <Tooltip content="Compare fields and choose Shopify or Synarava separately"><button type="button" disabled={busy} onClick={() => onDetails(productId)} className="adm-btn-secondary grid size-11 place-items-center p-0" aria-label="Compare fields side by side"><Columns2 className="size-4" /></button></Tooltip> : null}
              </div>
            </article>
          );
        })}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--adm-border)] bg-[var(--adm-panel)] p-4">
        <button type="button" onClick={onClose} disabled={busy} className="adm-btn-ghost">Close</button>
        {hideBulk ? null : (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || productIds.length === 0} onClick={() => onPreview({ kind: "BULK", direction: "SHOPIFY_TO_SYNARAVA" })} className="adm-btn-secondary inline-flex items-center gap-2"><ArrowDownToLine className="size-4" />Use Shopify for all</button>
            <button type="button" disabled={busy || productIds.length === 0} onClick={() => onPreview({ kind: "BULK", direction: "SYNARAVA_TO_SHOPIFY" })} className="adm-btn-primary inline-flex items-center gap-2"><ArrowUpFromLine className="size-4" />Use Synarava for all</button>
          </div>
        )}
      </footer>
    </AnimatedModal>
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

function DetailsModal({ conflict, product, selections, loading, applying, onClose, onSelect, onSelectAll, onContinue, onOpenEditor }: {
  conflict: ProductCatalogConflict | null;
  product?: ProductSummary;
  selections: Record<string, CatalogConflictDirection>;
  loading: boolean;
  applying: boolean;
  onClose: () => void;
  onSelect: (fieldKey: string, direction: CatalogConflictDirection) => void;
  onSelectAll: (direction: CatalogConflictDirection) => void;
  onContinue: () => void;
  onOpenEditor: (productId: string) => void;
}) {
  if (!conflict && !loading) return null;
  const fields = conflict ? orderedConflictFields(conflict.fields) : [];
  const actionable = fields.filter((field) => !field.blockedReason && field.allowedDirections.length > 0);
  const onlyBlocked = conflict !== null && fields.length > 0 && actionable.length === 0;
  const busy = applying;
  return (
    <AnimatedModal open onClose={busy ? () => undefined : onClose} ariaLabel="Choose conflict values" portalClassName="admin-modal-root" zIndexClassName="z-[300]" backdropZIndexClassName="z-[290]" className="adm-panel pointer-events-auto grid max-h-[min(88vh,60rem)] w-full max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0">
      <header className="flex items-start justify-between gap-3 border-b border-[var(--adm-border)] p-5">
        <div>
          <p className="adm-section-tag">[ FIELD DECISIONS ]</p>
          <h2 className="adm-title-sm mt-2">{product?.name ?? "Product conflict"}</h2>
          <p className="mt-1 text-xs text-[var(--adm-muted)]">
            {onlyBlocked
              ? "These commerce fields are visible for comparison, but this dialog cannot write them yet. Close here and use Push/Pull on the product."
              : "Each language is independent. Pick either side for the fields you want to merge."}
          </p>
        </div>
        <button type="button" onClick={onClose} disabled={busy} className="adm-btn-ghost grid size-11 place-items-center p-0" aria-label="Close conflict details"><X className="size-4" /></button>
      </header>
      <div className="min-h-0 space-y-4 overflow-y-auto p-5">
        {loading && !conflict ? (
          <p className="inline-flex items-center gap-2 text-sm text-[var(--adm-muted)]" role="status">
            <LoaderCircle className="size-4 animate-spin" />Loading live field comparison…
          </p>
        ) : null}
        {onlyBlocked ? (
          <p className="rounded-lg border border-[var(--adm-conflict)] p-3 text-sm">
            Status / storefront visibility and similar commerce fields stay read-only here on purpose — there is no safe per-field write yet.
            {conflict ? <> Use the footer action to open the product editor and resolve with Push/Pull.</> : null}
          </p>
        ) : null}
        {fields.map((field) => (
          <section key={field.fieldKey} className="rounded-xl border border-[var(--adm-border)] p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2"><LocaleMark field={field} /><h3 className="text-sm font-semibold">{field.label}</h3>{field.origin === "TRANSLATION" ? <span className="text-xs text-[var(--adm-muted)]">Only this language value is affected</span> : null}</div>
            <div className="grid gap-3 md:grid-cols-2">
              {field.blockedReason ? (
                <>
                  <ValueCell label="Synarava" value={field.synaravaValue} />
                  <ValueCell label="Shopify" value={field.shopifyValue} />
                </>
              ) : (
                <>
                  <ValueCell label="Synarava" value={field.synaravaValue} disabled={!field.allowedDirections.includes("SYNARAVA_TO_SHOPIFY")} selected={selections[field.fieldKey] === "SYNARAVA_TO_SHOPIFY"} onSelect={() => onSelect(field.fieldKey, "SYNARAVA_TO_SHOPIFY")} />
                  <ValueCell label="Shopify" value={field.shopifyValue} disabled={!field.allowedDirections.includes("SHOPIFY_TO_SYNARAVA")} selected={selections[field.fieldKey] === "SHOPIFY_TO_SYNARAVA"} onSelect={() => onSelect(field.fieldKey, "SHOPIFY_TO_SYNARAVA")} />
                </>
              )}
            </div>
            {field.blockedReason ? <p className="mt-3 rounded-lg bg-[color-mix(in_srgb,var(--adm-conflict)_12%,transparent)] p-3 text-xs text-[var(--adm-muted)]">Cannot choose here: {field.blockedReason}</p> : null}
          </section>
        ))}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--adm-border)] bg-[var(--adm-panel)] p-4">
        <button type="button" onClick={onClose} disabled={busy} className="adm-btn-secondary">{onlyBlocked ? "Back to list" : "Cancel"}</button>
        {!onlyBlocked ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={busy || loading || actionable.length === 0} onClick={() => onSelectAll("SHOPIFY_TO_SYNARAVA")} className="adm-btn-ghost">Select Shopify for visible fields</button>
              <button type="button" disabled={busy || loading || actionable.length === 0} onClick={() => onSelectAll("SYNARAVA_TO_SHOPIFY")} className="adm-btn-ghost">Select Synarava for visible fields</button>
              <span className="text-xs text-[var(--adm-muted)]">{Object.keys(selections).length} of {actionable.length} selected</span>
            </div>
            <button type="button" onClick={onContinue} disabled={busy || loading || Object.keys(selections).length === 0} className="adm-btn-primary">Review merge</button>
          </>
        ) : conflict ? (
          <button type="button" disabled={busy} onClick={() => onOpenEditor(conflict.productId)} className="adm-btn-primary">Open product editor</button>
        ) : null}
      </footer>
    </AnimatedModal>
  );
}

function PreviewModal({ preview, productsById, applying, resultMessage, onClose, onConfirm }: {
  preview: CatalogConflictPreview;
  productsById: Map<string, ProductSummary>;
  applying: boolean;
  resultMessage: string | null;
  onClose: () => void;
  onConfirm: (acknowledgeClears: boolean) => void;
}) {
  const [acknowledgeClears, setAcknowledgeClears] = useState(false);
  const hasClears = preview.entries.some((entry) => entry.willClearNonEmptyValue);
  return (
    <AnimatedModal open onClose={applying ? () => undefined : onClose} ariaLabel="Confirm conflict resolution" portalClassName="admin-modal-root" zIndexClassName="z-[400]" backdropZIndexClassName="z-[390]" className="adm-panel pointer-events-auto grid max-h-[min(90vh,64rem)] w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0">
      <header className="flex items-start justify-between gap-3 border-b border-[var(--adm-border)] p-5"><div><p className="adm-section-tag">[ FINAL PREVIEW ]</p><h2 className="adm-title-sm mt-2">Confirm {plural(preview.entries.length, "field change", "field changes")}</h2><p className="mt-1 text-xs text-[var(--adm-muted)]">This is the exact reviewed set. Current values are checked again immediately before every write.</p></div><button type="button" onClick={onClose} disabled={applying} className="adm-btn-ghost grid size-11 place-items-center p-0" aria-label="Close confirmation"><X className="size-4" /></button></header>
      <div className="min-h-0 space-y-4 overflow-y-auto p-5">
        {preview.entries.map((entry) => (
          <section key={`${entry.productId}:${entry.field.fieldKey}`} className="rounded-xl border border-[var(--adm-border)] p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2"><LocaleMark field={entry.field} /><h3 className="text-sm font-semibold">{productsById.get(entry.productId)?.name ?? entry.productId} · {entry.field.label}</h3><span className="text-xs font-semibold text-[var(--adm-muted)]">{directionCopy[entry.direction].full}</span></div>
            <div className="grid gap-3 md:grid-cols-2"><ValueCell label="Synarava" value={entry.field.synaravaValue} /><ValueCell label="Shopify" value={entry.field.shopifyValue} /></div>
            {entry.willClearNonEmptyValue ? <p className="mt-3 text-xs font-semibold text-[var(--adm-warning)]">This change clears a non-empty destination value.</p> : null}
          </section>
        ))}
        {preview.excluded.length > 0 ? <section className="rounded-xl border border-[var(--adm-warning)] p-4"><h3 className="text-sm font-semibold">Not included</h3><ul className="mt-2 space-y-2 text-xs text-[var(--adm-muted)]">{preview.excluded.map((item) => <li key={`${item.productId}:${item.fieldKey}`}>{productsById.get(item.productId)?.name ?? item.productId} · {item.label}: {item.reason}</li>)}</ul></section> : null}
        {preview.truncated ? <p className="rounded-lg border border-[var(--adm-warning)] p-3 text-xs">This operation reached its safety limit. Resolve this batch, then run it again for the remaining conflicts.</p> : null}
        {resultMessage ? <p role="alert" className="rounded-lg border border-[var(--adm-warning)] p-3 text-sm">{resultMessage}</p> : null}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--adm-border)] bg-[var(--adm-panel)] p-4">
        <div>
          {hasClears ? (
            <AdminCheckboxControl
              className="max-w-xl text-xs"
              checked={acknowledgeClears}
              onChange={(event) => setAcknowledgeClears(event.target.checked)}
              label="I understand that the selected source contains empty values and the destination values shown above will be cleared."
              labelClassName="text-xs leading-5"
            />
          ) : (
            <span className="text-xs text-[var(--adm-muted)]">Nothing changes until you confirm.</span>
          )}
        </div>
        <div className="flex gap-2"><button type="button" onClick={onClose} disabled={applying} className="adm-btn-secondary">Cancel</button><button type="button" onClick={() => onConfirm(acknowledgeClears)} disabled={applying || preview.entries.length === 0 || (hasClears && !acknowledgeClears)} className="adm-btn-primary">{applying ? "Applying…" : "Confirm changes"}</button></div>
      </footer>
    </AnimatedModal>
  );
}

export function CatalogConflictWorkspace({
  open,
  onClose,
  signals,
  onSignalsChange,
  products,
  focusedProductId,
  viewScope = { kind: "catalog" },
  onToast,
}: {
  open: boolean;
  onClose: () => void;
  signals: CatalogConflictSignals;
  onSignalsChange: (signals: CatalogConflictSignals) => void;
  products: ProductSummary[];
  focusedProductId: string | null;
  viewScope?: CatalogConflictViewScope;
  onToast: (message: string, tone: ToastTone) => void;
}) {
  const [details, setDetails] = useState<ProductCatalogConflict | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selections, setSelections] = useState<Record<string, CatalogConflictDirection>>({});
  const [preview, setPreview] = useState<CatalogConflictPreview | null>(null);
  const [activeScope, setActiveScope] = useState<CatalogConflictApplyScope | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [applying, startApplyTransition] = useTransition();
  const router = useRouter();
  const scopedSignals = useMemo(() => filterSignalsForView(signals, viewScope), [signals, viewScope]);
  const scopedFocusId = isProductScoped(viewScope) ? viewScope.productId : focusedProductId;
  const hideBulk = isProductScoped(viewScope);
  const productsById = useMemo(() => {
    const map = new Map(products.map((product) => [product.id, product]));
    for (const [productId, signal] of Object.entries(scopedSignals.products)) {
      if (!map.has(productId) && signal.name) map.set(productId, { id: productId, name: signal.name, sku: signal.sku ?? null });
    }
    return map;
  }, [products, scopedSignals.products]);
  const busy = applying || detailsLoading || previewLoading;

  function closeAll() {
    if (applying) return;
    setPreview(null);
    setDetails(null);
    setDetailsLoading(false);
    setPreviewLoading(false);
    setSelections({});
    setResultMessage(null);
    onClose();
  }

  function openPreview(scope: CatalogConflictApplyScope) {
    if (applying) return;
    setResultMessage(null);
    setPreviewLoading(true);
    void previewCatalogConflictResolutionAction(scope)
      .then((result) => {
        if (result.error) {
          onToast(result.error, "error");
          return;
        }
        if (result.preview) {
          const nextPreview = viewScope.kind === "productLocale"
            ? {
                ...result.preview,
                entries: result.preview.entries.filter((entry) => fieldMatchesViewLocale(entry.field, viewScope.locale)),
              }
            : result.preview;
          setActiveScope(scope);
          setPreview(nextPreview);
        }
      })
      .finally(() => setPreviewLoading(false));
  }

  function openDetails(productId: string) {
    if (applying) return;
    setDetails(null);
    setSelections({});
    setDetailsLoading(true);
    void loadProductCatalogConflictAction(productId)
      .then((result) => {
        if (result.error) {
          onToast(result.error, "error");
          return;
        }
        if (result.conflict) {
          setDetails({
            ...result.conflict,
            fields: filterConflictFieldsForView(result.conflict.fields, viewScope),
          });
        }
      })
      .finally(() => setDetailsLoading(false));
  }

  /** Product-wide direction under a locale tab becomes MANUAL over only that locale's fields. */
  function openProductDirection(productId: string, direction: CatalogConflictDirection) {
    if (viewScope.kind !== "productLocale") {
      openPreview({ kind: "PRODUCT", productId, direction });
      return;
    }
    setPreviewLoading(true);
    void loadProductCatalogConflictAction(productId)
      .then((result) => {
        if (result.error) {
          onToast(result.error, "error");
          setPreviewLoading(false);
          return;
        }
        const fields = filterConflictFieldsForView(result.conflict?.fields ?? [], viewScope)
          .filter((field) => !field.blockedReason && field.allowedDirections.includes(direction));
        if (fields.length === 0) {
          onToast("No supported fields for this language in that direction.", "info");
          setPreviewLoading(false);
          return;
        }
        setPreviewLoading(false);
        openPreview({
          kind: "MANUAL",
          selections: fields.map((field) => ({ productId, fieldKey: field.fieldKey, direction })),
        });
      })
      .catch(() => setPreviewLoading(false));
  }

  useEffect(() => {
    if (!open || !isProductScoped(viewScope)) return;
    openDetails(viewScope.productId);
    // Auto-open details once when entering a product-scoped view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, viewScope.kind, isProductScoped(viewScope) ? viewScope.productId : null, viewScope.kind === "productLocale" ? viewScope.locale : null]);

  function confirm(acknowledgeClears: boolean) {
    if (!preview || applying) return;
    const submittedPreview = preview;
    const submittedScope = activeScope;
    setPreview(null);
    setDetails(null);
    setResultMessage(null);
    if (submittedScope?.kind === "BULK") onClose();
    startApplyTransition(async () => {
      const result = await applyCatalogConflictResolutionAction({
        acknowledgeClears,
        entries: submittedPreview.entries.map((entry) => ({
          productId: entry.productId,
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
      if (result.warning) onToast(result.warning, "info");
      const successfulProducts = new Set(result.outcome.results.filter((item) => item.ok).map((item) => item.productId));
      const incomingProducts = new Set(
        result.outcome.results
          .filter((item) => item.ok && submittedPreview.entries.some((entry) =>
            entry.productId === item.productId
            && entry.field.fieldKey === item.fieldKey
            && entry.direction === "SHOPIFY_TO_SYNARAVA",
          ))
          .map((item) => item.localProductId ?? item.productId),
      );
      const fullyResolved = [...successfulProducts].filter((productId) =>
        !result.outcome!.results.some((item) => item.productId === productId && !item.ok)
        && !submittedPreview.excluded.some((item) => item.productId === productId),
      );
      if (fullyResolved.length > 0) {
        const nextProducts = { ...signals.products };
        fullyResolved.forEach((productId) => delete nextProducts[productId]);
        const recentlyUpdatedProducts = { ...signals.recentlyUpdatedProducts };
        incomingProducts.forEach((productId) => { recentlyUpdatedProducts[productId] = { updatedAt: new Date().toISOString() }; });
        onSignalsChange({ ...signals, products: nextProducts, recentlyUpdatedProducts, totalCount: Object.keys(nextProducts).length });
      } else if (incomingProducts.size > 0) {
        const recentlyUpdatedProducts = { ...signals.recentlyUpdatedProducts };
        incomingProducts.forEach((productId) => { recentlyUpdatedProducts[productId] = { updatedAt: new Date().toISOString() }; });
        onSignalsChange({ ...signals, recentlyUpdatedProducts });
      }
      setSelections({});
      router.refresh();
    });
  }

  return (
    <>
      <ConflictListModal
        open={open}
        onClose={closeAll}
        signals={scopedSignals}
        products={products}
        focusedProductId={scopedFocusId}
        busy={busy}
        hideBulk={hideBulk}
        onPreview={(scope) => {
          if (scope.kind === "PRODUCT") openProductDirection(scope.productId, scope.direction);
          else openPreview(scope);
        }}
        onDetails={openDetails}
      />
      {details || detailsLoading ? (
        <DetailsModal
          conflict={details}
          product={details ? productsById.get(details.productId) : undefined}
          selections={selections}
          loading={detailsLoading}
          applying={applying}
          onClose={() => { if (!applying) { setDetails(null); setDetailsLoading(false); setSelections({}); } }}
          onSelect={(fieldKey, direction) => setSelections((current) => ({ ...current, [fieldKey]: direction }))}
          onSelectAll={(direction) => setSelections((current) => {
            if (!details) return current;
            const next = { ...current };
            for (const field of details.fields) {
              if (!field.blockedReason && field.allowedDirections.includes(direction)) next[field.fieldKey] = direction;
            }
            return next;
          })}
          onContinue={() => details && openPreview({ kind: "MANUAL", selections: Object.entries(selections).map(([fieldKey, direction]) => ({ productId: details.productId, fieldKey, direction })) })}
          onOpenEditor={(productId) => {
            closeAll();
            router.push(`/admin/products/${productId}`);
          }}
        />
      ) : null}
      {preview ? <PreviewModal preview={preview} productsById={productsById} applying={applying} resultMessage={resultMessage} onClose={() => { if (!applying) { setPreview(null); setResultMessage(null); } }} onConfirm={confirm} /> : null}
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
