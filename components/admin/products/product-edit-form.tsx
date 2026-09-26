"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { refreshPreservingScroll } from "@/lib/admin/preserve-scroll";

import {
  deleteProductAction,
  getSavedProductPayload,
  saveProductAction,
  type ProductActionState,
} from "@/app/admin/actions/products";
import {
  checkProductConflictsAction,
  inspectProductSyncAction,
  pullSingleProductFromShopifyAction,
  pushSingleProductToShopifyAction,
} from "@/app/admin/actions/sync";
import { runCommerceStoreConsoleFlow } from "@/components/admin/products/commerce-store-console-flow";
import { AdminConfirmModal } from "@/components/admin/shared/admin-confirm-modal";
import { AdminFormAlert, useAdminFormValidation } from "@/components/admin/shared/admin-form-validation";
import type { AdminIssueSummary } from "@/components/admin/shared/admin-issue-types";
import { AdminLocaleTabs, useAdminActiveLocale, type AdminLocaleStatus, type AdminLocaleTab } from "@/components/admin/shared/admin-locale-workspace";
import { scrollAdminFieldIntoView } from "@/components/admin/shared/scroll-admin-field";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { AdminPanel } from "@/components/synarava-cms";
import { ProductDetailFields, ProductFormFields } from "@/components/admin/products/product-form-fields";
import { ProductMetafieldsPanel } from "@/components/admin/products/product-metafields-panel";
import { extractSelectedShopifyCategoryAttributes } from "@/lib/shopify/category-attribute-values";
import { inventoryShippingFactsFromProduct } from "@/components/admin/products/product-inventory-fields";
import { CatalogConflictWorkspace, type CatalogConflictViewScope } from "@/components/admin/products/catalog-conflict-workspace";
import {
  conflictLocalesFromCommerce,
  conflictSectionsFromDifferences,
  productEditorSectionForCommerceDiff,
} from "@/components/admin/products/commerce-conflict-section";
import { ProductLocaleConflictControl } from "@/components/admin/products/product-locale-conflict-control";
import { ProductMediaManager } from "@/components/admin/products/product-media-manager";
import { ProductEditorTabs, type ProductEditorSection } from "@/components/admin/products/product-editor-tabs";
import {
  dirtyKeyForEdit,
  isSharedSection,
  localeHasDirty,
  localeWorkspaceTone,
  sectionDirtyKey,
  snapshotFormData,
  SOURCE_LOCALE,
  type DirtyScopeKey,
} from "@/components/admin/products/product-editor-scope";
import { ShopifyProductMirror } from "@/components/admin/products/shopify-product-mirror";
import { ProductSyncDetailModal, ProgressBar, ProductSyncStrip, SaveButtons } from "@/components/admin/products/product-sync-strip";
import { useUnsavedLeaveGuard } from "@/components/admin/products/use-unsaved-leave-guard";
import {
  getProductEditorDetails,
  filterIssuesByTaxonomySatisfaction,
  issuesForSection,
  localesWithOpenIssues,
  productEditorLocaleForField,
  productEditorSectionForField,
  productToDraft,
  PRODUCT_SAVE_FAILURE_MESSAGE,
  sectionsWithOpenIssues,
  taxonomySatisfactionFromDraft,
  type TaxonomySatisfaction,
} from "@/components/admin/products/product-helpers";
import type { CollectionOption, ProductRecord } from "@/components/admin/products/product-types";
import type { ProductFieldName } from "@/lib/products/product-form-validation";
import type { ProductSyncInspection } from "@/lib/shopify/product-sync";
import type { AdminTranslationLocale } from "@/lib/i18n/admin-translation-locales";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";
import { Tooltip } from "@/components/ui/tooltip";

const EMPTY_SIGNALS: CatalogConflictSignals = {
  state: "ready",
  totalCount: 0,
  checkedAt: null,
  products: {},
  recentlyUpdatedProducts: {},
};

const ALL_SECTIONS: ProductEditorSection[] = [
  "essentials", "price", "inventory", "metafields", "media", "passport", "details", "shopify",
];

function productLocaleTabs(translationLocales: AdminTranslationLocale[]): AdminLocaleTab[] {
  return [{ code: SOURCE_LOCALE, label: "English" }, ...translationLocales];
}

export function EditProductForm({
  product,
  collections,
  issues = [],
  onUpdated,
  onDeleted,
  highlighted = false,
  translationLocales = [{ code: "pt", label: "Português" }],
  initialConflictSignals = EMPTY_SIGNALS,
}: {
  product: ProductRecord;
  collections: CollectionOption[];
  issues?: AdminIssueSummary[];
  onUpdated?: (product: ProductRecord) => void;
  onDeleted?: (productId: string) => void;
  highlighted?: boolean;
  /** Every non-English locale to render a tab for. Defaults to Portuguese only, matching every editor's behavior before the registry drove this. */
  translationLocales?: AdminTranslationLocale[];
  initialConflictSignals?: CatalogConflictSignals;
}) {
  const [state, setState] = useState<ProductActionState>({});
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dirtyScopes, setDirtyScopes] = useState<Set<DirtyScopeKey>>(() => new Set());
  const [inspection, setInspection] = useState<ProductSyncInspection | null>(null);
  const [conflictResolution, setConflictResolution] = useState<"shopify" | "synarava" | null>(null);
  const [syncDetailOpen, setSyncDetailOpen] = useState(false);
  const [conflictSignals, setConflictSignals] = useState(initialConflictSignals);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictViewScope, setConflictViewScope] = useState<CatalogConflictViewScope>({ kind: "product", productId: product.id });
  const [conflictChecking, setConflictChecking] = useState(false);
  const [activeSection, setActiveSection] = useState<ProductEditorSection>("essentials");
  const [fieldsRevision, setFieldsRevision] = useState(0);
  const localeTabs = productLocaleTabs(translationLocales);
  const [activeLocale, selectLocale] = useAdminActiveLocale(`product:${product.id}`, localeTabs);
  const rowRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const workspaceHeaderRef = useRef<HTMLDivElement>(null);
  const baselineRef = useRef<FormData | null>(null);
  const validation = useAdminFormValidation<ProductFieldName>({ formRef });
  const currentProduct = state.product ?? product;
  const draft = productToDraft(currentProduct, translationLocales);
  const details = getProductEditorDetails(currentProduct.details, currentProduct.characteristics);
  const taxonomySyncKey = `${currentProduct.id}:${fieldsRevision}:${draft.shopifyCategoryId}:${draft.collectionSlug}:${draft.tags}`;
  const [taxonomySatisfaction, setTaxonomySatisfaction] = useState<TaxonomySatisfaction>(() =>
    taxonomySatisfactionFromDraft(draft),
  );
  const [taxonomySyncedKey, setTaxonomySyncedKey] = useState(taxonomySyncKey);
  // Adjust during render when the server draft remounts / fieldsRevision bumps
  // (React “adjusting state when a prop changes” — no setState-in-effect).
  if (taxonomySyncKey !== taxonomySyncedKey) {
    setTaxonomySyncedKey(taxonomySyncKey);
    setTaxonomySatisfaction(taxonomySatisfactionFromDraft(draft));
  }
  const visibleIssues = filterIssuesByTaxonomySatisfaction(issues, taxonomySatisfaction);
  const activeLocaleLabel = localeTabs.find((tab) => tab.code === activeLocale)?.label ?? activeLocale;
  const activeTranslation = activeLocale === SOURCE_LOCALE ? null : draft.translations[activeLocale];
  const isDirty = dirtyScopes.size > 0;
  const { pushToast } = useAdminToast();
  const router = useRouter();
  const { leaveModal } = useUnsavedLeaveGuard(isDirty);

  const dirtyLocales = new Set(
    localeTabs
      .map((tab) => tab.code)
      .filter((code) => localeHasDirty(dirtyScopes, code, ALL_SECTIONS)),
  );
  const dirtySections = new Set(
    ALL_SECTIONS.filter((section) => {
      if (isSharedSection(section)) return dirtyScopes.has(sectionDirtyKey("*", section));
      return dirtyScopes.has(sectionDirtyKey(activeLocale, section));
    }),
  );
  const issueSections = sectionsWithOpenIssues(visibleIssues);
  const issueLocales = localesWithOpenIssues(visibleIssues);
  const activeSectionIssues = issuesForSection(visibleIssues, activeSection);
  const productConflict = conflictSignals.products[currentProduct.id];
  // Section tabs: only the owning sibling (Price for price, …) — per propagation graph.
  const conflictSections = conflictSectionsFromDifferences(inspection?.differences ?? []);
  if (productConflict?.presence) conflictSections.add("shopify");
  // Language shells: shared commerce → EN+PT+RU; locale-only → that locale.
  const conflictLocales = conflictLocalesFromCommerce({
    localeCodes: localeTabs.map((tab) => tab.code),
    conflictSections,
    sharedSignal: productConflict?.shared,
    presenceSignal: Boolean(productConflict?.presence),
    localeSignals: productConflict?.locales,
  });
  const activeSectionHasConflict = conflictSections.has(activeSection);
  const sectionConflictSignals = activeSectionHasConflict
    ? conflictSignals
    : { ...conflictSignals, products: {}, totalCount: 0 };
  const commerceFieldCount = inspection?.differences.length ?? 0;
  const sectionCommerceFieldCount = activeSectionHasConflict
    ? (inspection?.differences ?? []).filter(
      (difference) => productEditorSectionForCommerceDiff(difference) === activeSection,
    ).length
    : 0;
  const localeTone = localeWorkspaceTone(activeLocale);
  const syncLocale = isSharedSection(activeSection) ? SOURCE_LOCALE : activeLocale;

  function activateIssue(issue: AdminIssueSummary) {
    const section = productEditorSectionForField(issue.fieldPath);
    const locale = productEditorLocaleForField(issue.fieldPath);
    flushSync(() => {
      if (locale) selectLocale(locale);
      if (section) setActiveSection(section);
    });
    const nextHash = `#${issue.fieldPath}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
    window.requestAnimationFrame(() => scrollAdminFieldIntoView(issue.fieldPath));
  }

  useEffect(() => {
    if (!highlighted || !rowRef.current) return;
    rowRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [highlighted]);

  useEffect(() => {
    const header = workspaceHeaderRef.current;
    const form = formRef.current;
    if (!header || !form || typeof ResizeObserver === "undefined") return;

    function syncStickyOffset() {
      const node = workspaceHeaderRef.current;
      const root = formRef.current;
      if (!node || !root) return;
      root.style.setProperty(
        "--adm-product-workspace-sticky-height",
        `${Math.ceil(node.getBoundingClientRect().height)}px`,
      );
      const localeHeader =
        root.querySelector<HTMLElement>('[data-sticky-band="locale"]')
        ?? root.querySelector<HTMLElement>(".adm-locale-workspace-header--stacked");
      if (localeHeader) {
        root.style.setProperty(
          "--adm-locale-workspace-sticky-height",
          `${Math.ceil(localeHeader.getBoundingClientRect().height)}px`,
        );
      }
      const sectionTabs = root.querySelector<HTMLElement>(".adm-product-section-tabs");
      if (sectionTabs) {
        root.style.setProperty(
          "--adm-product-section-tabs-sticky-height",
          `${Math.ceil(sectionTabs.getBoundingClientRect().height)}px`,
        );
      }
    }

    syncStickyOffset();
    const observer = new ResizeObserver(syncStickyOffset);
    observer.observe(header);
    const localeHeader =
      form.querySelector('[data-sticky-band="locale"]')
      ?? form.querySelector(".adm-locale-workspace-header--stacked");
    if (localeHeader) observer.observe(localeHeader);
    const sectionTabs = form.querySelector(".adm-product-section-tabs");
    if (sectionTabs) observer.observe(sectionTabs);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!product.shopifyProductId) return;
    let cancelled = false;
    void inspectProductSyncAction(product.id).then(async (result) => {
      if (cancelled || !result.inspection) return;
      setInspection(result.inspection);
      // Inspect refreshes shopifySnapshot in DB — reload so Cost/compare-at match Shopify.
      try {
        const saved = await getSavedProductPayload(product.id);
        if (cancelled) return;
        setState((prev) => ({ ...prev, product: saved }));
        setFieldsRevision((value) => value + 1);
      } catch {
        // Keep inspection even if reload fails.
      }
    });
    return () => { cancelled = true; };
  }, [product.id, product.shopifyProductId]);

  // Full dual-store console walkthrough once per editor open (deduped globally).
  useEffect(() => {
    void runCommerceStoreConsoleFlow(`product-editor:${product.id}`).catch((error) => {
      console.error("[commerce-store] FLOW EXCEPTION", error);
    });
  }, [product.id]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    // Capture the last-saved field snapshot after paint so scoped branch saves
    // can leave other dirty tabs untouched in the DOM while writing only one branch.
    const timer = window.setTimeout(() => {
      baselineRef.current = snapshotFormData(form);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentProduct.id, fieldsRevision]);

  useEffect(() => {
    function openSectionForHash() {
      const fieldId = window.location.hash.slice(1);
      if (!fieldId) return;
      const section = productEditorSectionForField(fieldId);
      const locale = productEditorLocaleForField(fieldId);
      if (locale) selectLocale(locale);
      if (section) setActiveSection(section);
      else return;

      window.requestAnimationFrame(() => scrollAdminFieldIntoView(fieldId));
    }

    openSectionForHash();
    window.addEventListener("hashchange", openSectionForHash);
    return () => window.removeEventListener("hashchange", openSectionForHash);
    // Mount-only: hash deep-links from /admin/issues and in-page activateIssue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function markDirty() {
    setDirtyScopes((prev) => {
      const next = new Set(prev);
      next.add(dirtyKeyForEdit(activeLocale, activeSection));
      return next;
    });
  }

  function clearDirty(keys?: DirtyScopeKey[]) {
    if (!keys) {
      setDirtyScopes(new Set());
      return;
    }
    setDirtyScopes((prev) => {
      const next = new Set(prev);
      for (const key of keys) next.delete(key);
      return next;
    });
  }

  async function refreshConflicts(locale?: string, options?: { quiet?: boolean }) {
    setConflictChecking(true);
    try {
      const result = await checkProductConflictsAction({ productId: currentProduct.id, locale });
      if ("error" in result && result.error && !("signals" in result && result.signals)) {
        pushToast({ message: result.error, tone: "error" });
        return;
      }
      if ("warning" in result && result.warning) pushToast({ message: result.warning, tone: "info" });
      if ("signals" in result && result.signals) setConflictSignals(result.signals);
      if (!options?.quiet && "success" in result && result.success) {
        pushToast({ message: result.success, tone: "success" });
      } else if (options?.quiet && "signals" in result && result.signals?.products[currentProduct.id]) {
        // Product-scoped quiet check still returns catalog-wide totals — don't toast "57 products".
        pushToast({ message: "This product differs from Shopify after save.", tone: "info" });
      }
    } finally {
      setConflictChecking(false);
    }
  }

  /** After conflict apply: close already done by workspace; reload values + markers. */
  async function handleConflictsApplied(info: { productIds: string[] }) {
    if (!info.productIds.includes(currentProduct.id)) return;
    try {
      const [saved, inspectResult] = await Promise.all([
        getSavedProductPayload(currentProduct.id),
        inspectProductSyncAction(currentProduct.id),
      ]);
      setState((prev) => ({ ...prev, product: saved }));
      onUpdated?.(saved);
      setFieldsRevision((value) => value + 1);
      window.setTimeout(() => {
        if (formRef.current) baselineRef.current = snapshotFormData(formRef.current);
      }, 0);
      if (inspectResult.inspection) setInspection(inspectResult.inspection);
      else setInspection({ state: "UNLINKED", remoteUpdatedAt: null, publications: [], differences: [] });
      await refreshConflicts(undefined, { quiet: true });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : "Applied, but the editor could not reload.",
        tone: "error",
      });
    }
  }

  function openConflicts(scope: CatalogConflictViewScope) {
    setConflictViewScope(scope);
    setConflictOpen(true);
  }

  function persistFormData(formData: FormData, options?: { clearKeys?: DirtyScopeKey[]; remountFields?: boolean }) {
    startTransition(async () => {
      try {
        const result = await saveProductAction(formData);
        setState(result);
        setConfirmOpen(false);
        validation.showFieldErrors(result.fieldErrors ?? {});
        if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
          setActiveSection(result.fieldErrors.price ? "price" : "essentials");
          selectLocale(SOURCE_LOCALE);
        }
        if (result.success) pushToast({ message: result.success, tone: "success" });
        if (result.warning) pushToast({ message: result.warning, tone: "info" });
        if (result.product) {
          if (options?.clearKeys) clearDirty(options.clearKeys);
          else clearDirty();
          if (options?.remountFields) setFieldsRevision((value) => value + 1);
          // Refresh baseline after paint so the next branch save still protects other dirty tabs.
          window.setTimeout(() => {
            if (formRef.current) baselineRef.current = snapshotFormData(formRef.current);
          }, 0);
          onUpdated?.(result.product);
          if (result.product.shopifyProductId) {
            // Re-inspect so Price/etc. tab markers use fresh working vs shopify diffs —
            // never keep the pre-save differences list.
            const inspectResult = await inspectProductSyncAction(result.product.id);
            if (inspectResult.inspection) {
              setInspection(inspectResult.inspection);
            } else if (inspectResult.error) {
              setInspection({
                state: "CONFLICT",
                remoteUpdatedAt: result.product.shopifyUpdatedAt?.toISOString() ?? null,
                publications: inspection?.publications ?? [],
                differences: [],
              });
            }
            try {
              const saved = await getSavedProductPayload(result.product.id);
              setState((prev) => ({ ...prev, product: saved }));
              if (options?.remountFields) setFieldsRevision((value) => value + 1);
            } catch {
              // Keep save result payload if reload fails.
            }
            await refreshConflicts(undefined, { quiet: true });
          } else {
            setInspection({ state: "UNLINKED", remoteUpdatedAt: null, publications: [], differences: [] });
          }
        }
      } catch {
        setState({ error: PRODUCT_SAVE_FAILURE_MESSAGE });
        setConfirmOpen(false);
        validation.showFieldErrors({});
        pushToast({ message: PRODUCT_SAVE_FAILURE_MESSAGE, tone: "error" });
      }
    });
  }

  async function formAction(formData: FormData) {
    persistFormData(formData, { remountFields: true });
  }

  function requestSave() {
    setState({});
    const previousSection = activeSection;
    const previousLocale = activeLocale;
    if (previousLocale !== SOURCE_LOCALE) {
      flushSync(() => selectLocale(SOURCE_LOCALE));
    }

    // Required fields span Essentials (name/slug/sku) and Price — reveal each for willValidate.
    flushSync(() => setActiveSection("essentials"));
    if (!validation.validate()) return;

    flushSync(() => setActiveSection("price"));
    if (!validation.validate()) return;

    flushSync(() => setActiveSection(previousSection));
    if (previousLocale !== SOURCE_LOCALE) {
      flushSync(() => selectLocale(previousLocale));
    }
    setConfirmOpen(true);
  }

  function handleCheckShopify() {
    startTransition(async () => {
      const result = await inspectProductSyncAction(currentProduct.id);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.inspection) {
        setInspection(result.inspection);
        pushToast({
          message: result.inspection.state === "SYNCED"
            ? "Shopify is up to date."
            : result.inspection.state === "LOCAL_CHANGES"
              ? "Local commerce is ahead of Shopify — Push when ready."
              : result.inspection.state === "REMOTE_CHANGES"
                ? "Shopify has commerce updates — Pull to apply them."
                : result.inspection.state === "CONFLICT"
                  ? "Commerce conflict — choose Shopify or Synarava for the differing fields."
                  : "Shopify comparison refreshed.",
          tone: result.inspection.state === "CONFLICT" ? "error" : "success",
        });
      }
    });
  }

  function applySyncedProduct(next: ProductRecord, success?: string) {
    setState({ success, product: next });
    if (isDirty) {
      pushToast({
        message: "Shopify sync applied to saved data. Unsaved tab edits stayed in the form — review them before Save.",
        tone: "info",
      });
    } else {
      clearDirty();
      setFieldsRevision((value) => value + 1);
    }
    onUpdated?.(next);
  }

  function handlePushToShopify(force = false) {
    setConflictResolution(null);
    startTransition(async () => {
      const result = await pushSingleProductToShopifyAction(currentProduct.id, force);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (result.translationWarning) pushToast({ message: result.translationWarning, tone: "info" });
      if (result.inspection) setInspection(result.inspection);
      if (result.product) {
        applySyncedProduct(result.product, result.success);
        setSyncDetailOpen(false);
        refreshPreservingScroll(router);
      }
    });
  }

  function handlePullFromShopify(force = false) {
    setConflictResolution(null);
    startTransition(async () => {
      const result = await pullSingleProductFromShopifyAction(currentProduct.id, force);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (result.inspection) setInspection(result.inspection);
      if (result.product) {
        applySyncedProduct(result.product, result.success);
        setSyncDetailOpen(false);
        refreshPreservingScroll(router);
      }
    });
  }

  async function handleDelete(formData: FormData) {
    startTransition(async () => {
      const result = await deleteProductAction(formData);
      setState(result);
      setDeleteOpen(false);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (result.deletedProductId) {
        onDeleted?.(result.deletedProductId);
      }
    });
  }

  return (
    <>
      <div
        ref={rowRef}
        className="adm-panel grid gap-4 p-5 transition-colors"
        style={{
          ...(highlighted
            ? { background: "var(--adm-accent-soft)", outline: "1px solid var(--adm-border-strong)" }
            : {}),
        }}
      >
        <form
          ref={formRef}
          action={formAction}
          noValidate
          className="grid gap-4"
          onChange={markDirty}
          onInput={markDirty}
        >
          <input type="hidden" name="productId" value={currentProduct.id} />

          <div
            ref={workspaceHeaderRef}
            className="adm-product-workspace-header adm-band adm-band--lg justify-between gap-4"
          >
            <div>
              <p className="adm-section-tag">Product workspace</p>
              <h2 className="adm-title-sm mt-2">Choose an area to edit</h2>
              <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>
                /{currentProduct.slug}
              </p>
              {highlighted ? (
                <p
                  className="mt-1 text-xs font-bold uppercase tracking-[0.08em]"
                  style={{ color: "var(--adm-accent)" }}
                >
                  Just created
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {currentProduct.shopifyProductId ? (
                <ProductLocaleConflictControl
                  scope="product"
                  checkIconOnly
                  productId={currentProduct.id}
                  locale={SOURCE_LOCALE}
                  localeLabel="this product"
                  signals={conflictSignals}
                  commerceFieldCount={commerceFieldCount}
                  checking={conflictChecking}
                  onOpen={() => openConflicts({ kind: "product", productId: currentProduct.id })}
                  onCheck={() => void refreshConflicts()}
                />
              ) : null}
              <Tooltip content="Delete this product permanently. Storefront pages for it will stop working.">
                <button
                  type="button"
                  onClick={() => setDeleteOpen(true)}
                  disabled={isPending}
                  className="adm-btn-danger grid size-12 place-items-center p-0"
                  aria-label="Delete product"
                >
                  <Trash2 className="size-7" strokeWidth={2.75} aria-hidden="true" />
                </button>
              </Tooltip>
              <SaveButtons iconOnly onOpenConfirm={requestSave} pending={isPending} />
            </div>
          </div>

          <ProgressBar pending={isPending} />
          <AdminFormAlert message={state.fieldErrors ? undefined : state.error} />

          <AdminPanel.Root
            data-component="ProductLocaleWorkspace"
            data-locale={activeLocale}
            stickyAbove="var(--adm-product-workspace-sticky-height, 5.5rem)"
            className="border"
            style={{
              background: localeTone.background,
              borderColor: localeTone.border,
              ["--locale-tone-border" as string]: localeTone.border,
              ["--locale-tone-accent" as string]: localeTone.accent,
              ["--locale-tone-bg" as string]: localeTone.background,
            }}
          >
            <AdminPanel.Header
              sticky
              stickyBand="locale"
              className="adm-panel__header--ruled"
              style={{
                background: localeTone.background,
              }}
            >
              <AdminLocaleTabs
                embedded
                active={activeLocale}
                onSelect={selectLocale}
                locales={localeTabs}
                dirtyLocales={dirtyLocales}
                issueLocales={issueLocales}
                conflictLocales={conflictLocales}
                ptStatus={activeTranslation?.syncStatus as AdminLocaleStatus | undefined}
                trailing={
                  currentProduct.shopifyProductId ? (
                    <ProductLocaleConflictControl
                      checkIconOnly
                      productId={currentProduct.id}
                      locale={activeLocale}
                      localeLabel={`${activeLocaleLabel} (all sections)`}
                      signals={conflictSignals}
                      commerceFieldCount={commerceFieldCount}
                      checking={conflictChecking}
                      onOpen={() => openConflicts({
                        kind: "productLocale",
                        productId: currentProduct.id,
                        locale: activeLocale,
                      })}
                      onCheck={() => void refreshConflicts(activeLocale)}
                    />
                  ) : null
                }
              />
            </AdminPanel.Header>

            <AdminPanel.Body>
              <ProductEditorTabs
                embedded
                active={activeSection}
                onChange={setActiveSection}
                dirtySections={dirtySections}
                issueSections={issueSections}
                conflictSections={conflictSections}
                sectionIssues={activeSectionIssues}
                onIssueActivate={activateIssue}
                aside={
                  currentProduct.shopifyProductId && activeSection !== "shopify" ? (
                    <ProductLocaleConflictControl
                      checkIconOnly
                      productId={currentProduct.id}
                      locale={syncLocale}
                      localeLabel={
                        isSharedSection(activeSection)
                          ? `shared · ${activeSection}`
                          : `${activeLocaleLabel} · ${activeSection}`
                      }
                      signals={sectionConflictSignals}
                      commerceFieldCount={sectionCommerceFieldCount}
                      checking={conflictChecking}
                      onOpen={() => openConflicts({
                        kind: "productSection",
                        productId: currentProduct.id,
                        locale: syncLocale,
                        section: activeSection,
                      })}
                      onCheck={() => void refreshConflicts(
                        isSharedSection(activeSection) ? undefined : activeLocale,
                      )}
                    />
                  ) : null
                }
              >
                <div className="adm-inset-x grid gap-4 py-4">
                  <div
                    id={`product-editor-panel-${activeSection}`}
                    role="tabpanel"
                    aria-labelledby={`product-editor-tab-${activeSection}`}
                    className="grid gap-4"
                  >
                    <div hidden={activeSection !== "shopify"}>
                      <ProductSyncStrip
                        product={currentProduct}
                        dirty={isDirty}
                        inspection={inspection}
                        pending={isPending}
                        onCheck={handleCheckShopify}
                        onOpenDetail={() => setSyncDetailOpen(true)}
                      />
                    </div>

                    <div hidden={activeSection === "media" || activeSection === "metafields"}>
                      <div hidden={activeSection === "passport"}>
                        <ProductFormFields
                          key={`${currentProduct.id}-${fieldsRevision}`}
                          draft={draft}
                          collections={collections}
                          variantExists={currentProduct.variants.length > 0}
                          inventoryFacts={inventoryShippingFactsFromProduct({
                            primaryVariant: currentProduct.variants[0] ?? null,
                            shopifySnapshot: currentProduct.shopifySnapshot,
                          })}
                          issues={visibleIssues}
                          validation={validation}
                          translationLocales={translationLocales}
                          activeSection={activeSection}
                          activeLocale={activeLocale}
                          onLocaleChange={selectLocale}
                          onTaxonomySatisfactionChange={setTaxonomySatisfaction}
                          selectedShopifyCategoryAttributes={extractSelectedShopifyCategoryAttributes(currentProduct.shopifySnapshot)}
                          mode="edit"
                        />
                      </div>
                      <ProductDetailFields
                        key={`details-${currentProduct.id}-${fieldsRevision}`}
                        details={details}
                        translationsDetails={Object.fromEntries(translationLocales.map(({ code }) => [code, draft.translations[code]?.details]))}
                        mode="edit"
                        issues={issues}
                        collections={collections}
                        translationLocales={translationLocales}
                        activeSection={activeSection}
                        activeLocale={activeLocale}
                        shopifyLinked={Boolean(currentProduct.shopifyProductId)}
                        shopifySnapshot={currentProduct.shopifySnapshot}
                        shopifyCategoryName={currentProduct.shopifyCategoryName ?? draft.shopifyCategoryName}
                        vendor={currentProduct.vendor ?? draft.vendor}
                        productType={currentProduct.productType ?? draft.productType}
                        characteristicValues={currentProduct.characteristics}
                      />
                    </div>

                    <div hidden={activeSection !== "metafields"}>
                      <ProductMetafieldsPanel
                        key={`metafields-${currentProduct.id}-${fieldsRevision}`}
                        productId={currentProduct.id}
                        shopifyProductId={currentProduct.shopifyProductId}
                        shopifySnapshot={currentProduct.shopifySnapshot}
                        workingSnapshot={currentProduct.workingSnapshot}
                      />
                    </div>

                    <div hidden={activeSection !== "media"}>
                      <ProductMediaManager
                        product={currentProduct}
                        issues={issues}
                        onChange={(next) => {
                          setState({ success: "Gallery updated locally.", product: next });
                          clearDirty([sectionDirtyKey("*", "media")]);
                          onUpdated?.(next);
                        }}
                      />
                    </div>

                    <div hidden={activeSection !== "shopify"}>
                      <ShopifyProductMirror product={currentProduct} />
                    </div>
                  </div>
                </div>
              </ProductEditorTabs>
            </AdminPanel.Body>
          </AdminPanel.Root>
        </form>
      </div>

      {leaveModal}

      <ProductSyncDetailModal
        open={syncDetailOpen}
        onClose={() => setSyncDetailOpen(false)}
        product={currentProduct}
        dirty={isDirty}
        inspection={inspection}
        pending={isPending}
        onPull={() => handlePullFromShopify(false)}
        onPush={() => handlePushToShopify(false)}
        onResolve={setConflictResolution}
      />

      <AdminConfirmModal
        open={confirmOpen}
        title={`Save ${currentProduct.name}`}
        description="This saves the whole product locally. Shopify will not change until you push or resolve conflicts."
        confirmLabel="Yes, save changes"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          formRef.current?.requestSubmit();
        }}
        pending={isPending}
      />

      <AdminConfirmModal
        open={conflictResolution === "shopify"}
        title="Use Shopify commerce version"
        description="Shopify-backed fields saved in Synarava will be replaced by the current Shopify version. Synarava-only content and editorial media will be preserved. Unsaved tab edits stay in the form until you save or discard them."
        confirmLabel="Use Shopify version"
        onCancel={() => setConflictResolution(null)}
        onConfirm={() => handlePullFromShopify(true)}
        pending={isPending}
      />

      <AdminConfirmModal
        open={conflictResolution === "synarava"}
        title="Keep Synarava commerce version"
        description="The saved Synarava commerce values will overwrite the corresponding Shopify fields. Synarava-only content will remain unchanged."
        confirmLabel="Keep Synarava and push"
        onCancel={() => setConflictResolution(null)}
        onConfirm={() => handlePushToShopify(true)}
        pending={isPending}
      />

      <AdminConfirmModal
        open={deleteOpen}
        title={`Delete ${currentProduct.name}`}
        description="This action removes the product record permanently. Public site pages for this item will stop working after deletion."
        confirmLabel="Yes, delete permanently"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          const formData = new FormData();
          formData.set("productId", currentProduct.id);
          formData.set("productSlug", currentProduct.slug);
          void handleDelete(formData);
        }}
        pending={isPending}
        tone="danger"
      />

      <CatalogConflictWorkspace
        open={conflictOpen}
        onClose={() => setConflictOpen(false)}
        signals={conflictSignals}
        onSignalsChange={setConflictSignals}
        products={[{ id: currentProduct.id, name: currentProduct.name, sku: currentProduct.sku }]}
        focusedProductId={currentProduct.id}
        viewScope={conflictViewScope}
        onToast={(message, tone) => pushToast({ message, tone })}
        onApplied={(info) => { void handleConflictsApplied(info); }}
      />
    </>
  );
}
