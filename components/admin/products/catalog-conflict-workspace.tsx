"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  applyCatalogConflictResolutionAction,
  loadCatalogConflictSignalsAction,
  loadProductCatalogConflictAction,
  previewCatalogConflictResolutionAction,
  pullSingleProductFromShopifyAction,
  pushSingleProductToShopifyAction,
} from "@/app/admin/actions/sync";
import { refreshPreservingScroll } from "@/lib/admin/preserve-scroll";
import {
  FieldConflictBusyOverlay,
  FieldConflictDetailsModal,
  FieldConflictListModal,
  FieldConflictPreviewModal,
  type FieldConflictEntitySummary,
  type FieldConflictPreviewModel,
} from "@/components/admin/shared/field-conflict-panel";
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
import type { ProductEditorSection } from "@/components/admin/products/product-editor-tabs";
import { productEditorSectionForConflictField } from "@/components/admin/products/commerce-conflict-section";
import { productConflictBadgeCount } from "@/lib/sync/badge-count";

type ProductSummary = { id: string; name: string; sku: string | null };
type ToastTone = "success" | "error" | "info";

/**
 * Same conflict UI, different tree node:
 * full catalog · one product · one product locale · one editor section.
 */
export type CatalogConflictViewScope =
  | { kind: "catalog" }
  | { kind: "product"; productId: string }
  | { kind: "productLocale"; productId: string; locale: string }
  | { kind: "productSection"; productId: string; locale: string; section: ProductEditorSection };

function normalizeLocaleCode(locale: string) {
  return locale.trim().toLowerCase();
}

/**
 * Language shells include SHARED commerce under every locale (one price → EN/PT/RU)
 * plus that locale's translation rows. See docs/wiki/commerce-sync.md marker tree.
 */
function isSharedScope(field: CatalogConflictField): boolean {
  return String(field.scope.kind).toUpperCase() === "SHARED";
}

export function fieldMatchesViewLocale(field: CatalogConflictField, locale: string): boolean {
  if (isSharedScope(field)) return true;
  return field.scope.kind === "LOCALE"
    && normalizeLocaleCode(field.scope.code) === normalizeLocaleCode(locale);
}

export function fieldMatchesViewSection(
  field: CatalogConflictField,
  section: ProductEditorSection,
  locale: string,
): boolean {
  if (productEditorSectionForConflictField(field) !== section) return false;
  // Shared commerce belongs under every language shell for that section.
  if (isSharedScope(field)) return true;
  return fieldMatchesViewLocale(field, locale);
}

export function filterConflictFieldsForView(
  fields: CatalogConflictField[],
  viewScope: CatalogConflictViewScope | undefined,
): CatalogConflictField[] {
  if (!viewScope || viewScope.kind === "catalog" || viewScope.kind === "product") return fields;
  if (viewScope.kind === "productLocale") {
    return fields.filter((field) => fieldMatchesViewLocale(field, viewScope.locale));
  }
  return fields.filter((field) => fieldMatchesViewSection(field, viewScope.section, viewScope.locale));
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
  // Shared commerce (price, vendor, …) is one payload under every language shell —
  // not EN-only. See docs/wiki/commerce-sync.md.
  const shared = Boolean(signal.shared);
  const hasLocaleConflict = locales.some((entry) => entry.count > 0);
  if (!hasLocaleConflict && !shared && !signal.presence) {
    return { ...signals, products: {}, totalCount: 0 };
  }
  const scoped = {
    ...signal,
    shared,
    locales,
    leafCount: undefined,
  };
  // Recompute leafCount for this locale shell (shared + locale rows) —
  // do not keep the product-wide leafCount.
  return {
    ...signals,
    products: {
      [productId]: {
        ...scoped,
        leafCount: productConflictBadgeCount(scoped),
      },
    },
    totalCount: 1,
  };
}

function isProductScoped(viewScope: CatalogConflictViewScope | undefined): viewScope is
  | { kind: "product"; productId: string }
  | { kind: "productLocale"; productId: string; locale: string }
  | { kind: "productSection"; productId: string; locale: string; section: ProductEditorSection } {
  return viewScope?.kind === "product"
    || viewScope?.kind === "productLocale"
    || viewScope?.kind === "productSection";
}

function isLocaleOrSectionScoped(
  viewScope: CatalogConflictViewScope,
): viewScope is
  | { kind: "productLocale"; productId: string; locale: string }
  | { kind: "productSection"; productId: string; locale: string; section: ProductEditorSection } {
  return viewScope.kind === "productLocale" || viewScope.kind === "productSection";
}

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
  /** Unsaved editor changes or in-flight Save — block Resolve/Push/Pull. */
  formBlocked?: boolean;
  onToast: (message: string, tone: ToastTone) => void;
  /** Fired after a successful apply so the editor can reload product + markers. */
  onApplied?: (info: { productIds: string[]; appliedCount: number }) => void;
}) {
  const [details, setDetails] = useState<ProductCatalogConflict | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selections, setSelections] = useState<Record<string, CatalogConflictDirection>>({});
  const [preview, setPreview] = useState<CatalogConflictPreview | null>(null);
  const [activeScope, setActiveScope] = useState<CatalogConflictApplyScope | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  // Explicit flag — not useTransition. Async server actions can leave
  // transition-pending stuck after the write already finished.
  const [applying, setApplying] = useState(false);
  const router = useRouter();
  const scopedSignals = useMemo(() => filterSignalsForView(signals, viewScope), [signals, viewScope]);
  const scopedFocusId = isProductScoped(viewScope) ? viewScope.productId : focusedProductId;
  const hideBulk = isProductScoped(viewScope);
  const entitiesById = useMemo(() => {
    const map = new Map<string, FieldConflictEntitySummary>();
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
  const busy = applying || detailsLoading || previewLoading;

  function toPanelPreview(model: CatalogConflictPreview): FieldConflictPreviewModel {
    return {
      truncated: model.truncated,
      excluded: model.excluded.map((item) => ({
        entityId: item.productId,
        fieldKey: item.fieldKey,
        label: item.label,
        reason: item.reason,
      })),
      entries: model.entries.map((entry) => {
        const isProductType = entry.field.label === "Product type"
          || entry.field.fieldKey.toLowerCase().includes("product_type")
          || entry.field.fieldKey.toLowerCase().includes("product-type");
        return {
          entityId: entry.productId,
          field: entry.field,
          direction: entry.direction,
          willClearNonEmptyValue: entry.willClearNonEmptyValue,
          impactNote: isProductType
            ? "Product type is a shared label — confirming updates every product that uses this type name."
            : null,
        };
      }),
    };
  }

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

  function guardFormBlocked() {
    if (!formBlocked) return false;
    onToast("Save your product changes before Resolve or Push.", "info");
    return true;
  }

  function openPreview(scope: CatalogConflictApplyScope) {
    if (applying || guardFormBlocked()) return;
    setResultMessage(null);
    setPreviewLoading(true);
    void previewCatalogConflictResolutionAction(scope)
      .then((result) => {
        if (result.error) {
          onToast(result.error, "error");
          return;
        }
        if (result.preview) {
          const nextPreview = isLocaleOrSectionScoped(viewScope)
            ? {
                ...result.preview,
                entries: result.preview.entries.filter((entry) => (
                  filterConflictFieldsForView([entry.field], viewScope).length > 0
                )),
              }
            : result.preview;
          setActiveScope(scope);
          setPreview(nextPreview);
        }
      })
      .finally(() => setPreviewLoading(false));
  }

  function openDetails(productId: string) {
    if (applying || guardFormBlocked()) return;
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

  /** Product-wide direction under a locale/section tab becomes MANUAL over only that scope's fields. */
  function openProductDirection(productId: string, direction: CatalogConflictDirection) {
    if (guardFormBlocked()) return;
    setPreviewLoading(true);
    void loadProductCatalogConflictAction(productId)
      .then((result) => {
        if (result.error) {
          onToast(result.error, "error");
          setPreviewLoading(false);
          return;
        }
        const visibleFields = filterConflictFieldsForView(result.conflict?.fields ?? [], viewScope);
        const needsWholeRecord = visibleFields.some(
          (field) => field.origin === "COMMERCE" && field.blockedReason,
        ) || (
          visibleFields.length > 0
          && visibleFields.every((field) => field.blockedReason || !field.allowedDirections.includes(direction))
        );
        if (needsWholeRecord) {
          // Blocked commerce, one-way presence, or empty direction matrix for this
          // scope — open field details with whole-record Pull/Push instead of a
          // toast that looks like a broken sync.
          setDetails({ productId, fields: visibleFields });
          setSelections({});
          setPreviewLoading(false);
          return;
        }
        if (!isLocaleOrSectionScoped(viewScope)) {
          setPreviewLoading(false);
          openPreview({ kind: "PRODUCT", productId, direction });
          return;
        }
        const fields = visibleFields
          .filter((field) => !field.blockedReason && field.allowedDirections.includes(direction));
        if (fields.length === 0) {
          onToast(
            viewScope.kind === "productSection"
              ? "Nothing left to sync in this section for that direction."
              : "Nothing left to sync for this language in that direction.",
            "info",
          );
          setPreviewLoading(false);
          return;
        }
        setPreviewLoading(false);
        openPreview({
          kind: "MANUAL",
          selections: fields.map((field) => ({ productId, fieldKey: field.fieldKey, direction })),
        });
      })
      .catch((error) => {
        onToast(error instanceof Error ? error.message : "Could not load conflict values.", "error");
        setPreviewLoading(false);
      });
  }

  const scopedProductId = isProductScoped(viewScope) ? viewScope.productId : null;
  const scopedLocale = viewScope.kind === "productLocale" || viewScope.kind === "productSection"
    ? viewScope.locale
    : null;
  const scopedSection = viewScope.kind === "productSection" ? viewScope.section : null;

  useEffect(() => {
    if (!open || !isProductScoped(viewScope) || !scopedProductId) return;
    const scope = viewScope;
    const productId = scopedProductId;
    let cancelled = false;

    // Defer React updates into a microtask so the effect body has no sync setState
    // (react-hooks/set-state-in-effect). Fetch still starts immediately after.
    void Promise.resolve()
      .then(() => {
        if (cancelled) return;
        setDetails(null);
        setSelections({});
        setDetailsLoading(true);
        return loadProductCatalogConflictAction(productId);
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
            fields: filterConflictFieldsForView(result.conflict.fields, scope),
          });
        }
      })
      .finally(() => {
        if (!cancelled) setDetailsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Auto-open details once when entering a product-scoped view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, viewScope.kind, scopedProductId, scopedLocale, scopedSection]);

  function runWholeRecord(productId: string, direction: CatalogConflictDirection) {
    if (applying || guardFormBlocked()) return;
    setApplying(true);
    void (async () => {
      try {
        const result = direction === "SHOPIFY_TO_SYNARAVA"
          ? await pullSingleProductFromShopifyAction(productId, true)
          : await pushSingleProductToShopifyAction(productId, true);
        if (result.error) {
          onToast(result.error, "error");
          return;
        }
        if (result.success) onToast(result.success, "success");
        setDetails(null);
        setDetailsLoading(false);
        setSelections({});
        setApplying(false);
        if (onApplied) onApplied({ productIds: [productId], appliedCount: 1 });
        else refreshPreservingScroll(router);
        onClose();
      } catch (error) {
        onToast(error instanceof Error ? error.message : "Could not sync with Shopify.", "error");
      } finally {
        setApplying(false);
      }
    })();
  }

  function confirm(acknowledgeClears: boolean) {
    if (!preview || applying || guardFormBlocked()) return;
    const submittedPreview = preview;
    const submittedScope = activeScope;
    setDetails(null);
    setResultMessage(null);
    // Close the list for bulk / product-scoped flows; keep the preview open for the lasting result.
    if (submittedScope?.kind === "BULK" || isProductScoped(viewScope)) onClose();
    setApplying(true);
    void (async () => {
      try {
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
        const successfulProducts = new Set(result.outcome.results.filter((item) => item.ok).map((item) => item.productId));
        setSelections({});
        // Drop the blocker before editor reload / conflict re-check — those can take longer than the write.
        setApplying(false);
        if (result.outcome.appliedCount > 0 && onApplied) {
          onApplied({
            productIds: [...successfulProducts],
            appliedCount: result.outcome.appliedCount,
          });
        } else if (result.outcome.appliedCount > 0) {
          // Fresh server conflict state only — never clear badges optimistically.
          const refreshed = await loadCatalogConflictSignalsAction();
          if (refreshed.signals) onSignalsChange(refreshed.signals);
          else if (refreshed.error) onToast(refreshed.error, "info");
        }
        refreshPreservingScroll(router);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not apply the changes.";
        setResultMessage(message);
        onToast(message, "error");
      } finally {
        setApplying(false);
      }
    })();
  }

  const panelPreview = preview ? toPanelPreview(preview) : null;

  return (
    <>
      <FieldConflictListModal
        open={open}
        onClose={closeAll}
        signals={scopedSignals}
        entities={entityList}
        focusedEntityId={scopedFocusId}
        busy={busy}
        hideBulk={hideBulk}
        entityNoun="product"
        entityNounPlural="products"
        ariaLabel="Product differences"
        onAction={(action) => {
          if (action.kind === "details") openDetails(action.entityId);
          else if (action.kind === "entity") openProductDirection(action.entityId, action.direction);
          else openPreview({ kind: "BULK", direction: action.direction });
        }}
      />
      {details || detailsLoading ? (
        <FieldConflictDetailsModal
          open
          title={details ? (entitiesById.get(details.productId)?.name ?? "Product") : "Product"}
          fields={details?.fields ?? []}
          selections={selections}
          loading={detailsLoading}
          applying={applying}
          entityId={details?.productId ?? null}
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
          onContinue={() => details && openPreview({
            kind: "MANUAL",
            selections: Object.entries(selections).map(([fieldKey, direction]) => ({
              productId: details.productId,
              fieldKey,
              direction,
            })),
          })}
          onWholeRecordTakeShopify={(productId) => runWholeRecord(productId, "SHOPIFY_TO_SYNARAVA")}
          onWholeRecordKeepOurs={(productId) => runWholeRecord(productId, "SYNARAVA_TO_SHOPIFY")}
        />
      ) : null}
      {panelPreview ? (
        <FieldConflictPreviewModal
          preview={panelPreview}
          entitiesById={entitiesById}
          applying={applying}
          resultMessage={resultMessage}
          onClose={() => { if (!applying) { setPreview(null); setResultMessage(null); } }}
          onConfirm={confirm}
        />
      ) : null}
      {previewLoading ? <FieldConflictBusyOverlay mode="toast" label="Building preview…" /> : null}
      {applying ? <FieldConflictBusyOverlay mode="blocking" label="Working with Shopify…" /> : null}
    </>
  );
}
