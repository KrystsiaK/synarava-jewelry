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
  inspectProductSyncAction,
  loadCatalogConflictSignalsAction,
  pushSingleProductToShopifyAction,
} from "@/app/admin/actions/sync";
import { AdminConfirmModal } from "@/components/admin/shared/admin-confirm-modal";
import { useAdminFormValidation } from "@/components/admin/shared/admin-form-validation";
import { AdminLocaleTabs, useAdminActiveLocale, type AdminLocaleStatus, type AdminLocaleTab } from "@/components/admin/shared/admin-locale-workspace";
import { scrollAdminFieldIntoView } from "@/components/admin/shared/scroll-admin-field";
import { submitFormAfterConfirmClose } from "@/components/admin/shared/submit-after-confirm";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { AdminAlert, AdminIconButton, AdminPanel } from "@/components/synarava-cms";
import { ProductDetailFields, ProductFormFields } from "@/components/admin/products/product-form-fields";
import { ProductMetafieldsPanel } from "@/components/admin/products/product-metafields-panel";
import { extractSelectedShopifyCategoryAttributes } from "@/lib/shopify/category-attribute-values";
import { inventoryShippingFactsFromProduct } from "@/components/admin/products/product-inventory-fields";
import { CatalogConflictWorkspace, type CatalogConflictViewScope } from "@/components/admin/products/product-conflict-adapter";
import {
  conflictLocalesFromCommerce,
  conflictSectionsFromDifferences,
  productEditorSectionForCommerceDiff,
} from "@/components/admin/products/commerce-conflict-section";
import { ProductConflictCompareBanner } from "@/components/admin/products/product-conflict-compare-banner";
import { ProductLocaleConflictControl } from "@/components/admin/products/product-locale-conflict-control";
import { ProductMediaManager } from "@/components/admin/products/product-media-manager";
import { ProductEditorTabs, type ProductEditorSection } from "@/components/admin/products/product-editor-tabs";
import {
  requestProductSaveWithValidation,
  revealProductFieldErrors,
} from "@/components/admin/products/product-validation-navigate";
import {
  dirtyKeyForEdit,
  isSharedSection,
  localeHasDirty,
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
  productEditorLocaleForField,
  productEditorSectionForField,
  productToDraft,
  PRODUCT_SAVE_FAILURE_MESSAGE,
} from "@/components/admin/products/product-helpers";
import type { CollectionOption, ProductRecord } from "@/components/admin/products/product-types";
import type { ProductFieldName } from "@/lib/products/product-form-validation";
import type { ProductSyncInspection } from "@/lib/shopify/product-sync";
import type { AdminTranslationLocale } from "@/lib/i18n/admin-translation-locales";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

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
  onUpdated,
  onDeleted,
  highlighted = false,
  translationLocales = [{ code: "pt", label: "Português" }],
  initialConflictSignals = EMPTY_SIGNALS,
}: {
  product: ProductRecord;
  collections: CollectionOption[];
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
  const [syncDetailOpen, setSyncDetailOpen] = useState(false);
  const [conflictSignals, setConflictSignals] = useState(initialConflictSignals);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictViewScope, setConflictViewScope] = useState<CatalogConflictViewScope>({ kind: "product", productId: product.id });
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
  const syncLocale = isSharedSection(activeSection) ? SOURCE_LOCALE : activeLocale;

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
    // Mount-only: hash deep-links to product editor fields.
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

  /** Reload saved conflict signals (display only — no Shopify fetch). */
  async function refreshConflictSignals(options?: { quiet?: boolean }) {
    const result = await loadCatalogConflictSignalsAction();
    if (result.error) {
      if (!options?.quiet) pushToast({ message: result.error, tone: "error" });
      return;
    }
    if (result.signals) {
      setConflictSignals(result.signals);
      if (options?.quiet && result.signals.products[currentProduct.id]) {
        pushToast({ message: "This product differs from Shopify after save.", tone: "info" });
      }
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
      await refreshConflictSignals({ quiet: true });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : "Applied, but the editor could not reload.",
        tone: "error",
      });
    }
  }

  function openConflicts(scope: CatalogConflictViewScope) {
    if (isPending) {
      pushToast({ message: "Wait for Save to finish before resolving conflicts.", tone: "info" });
      return;
    }
    if (isDirty) {
      pushToast({ message: "Save your product changes before Resolve or Push.", tone: "info" });
      return;
    }
    setConflictViewScope(scope);
    setConflictOpen(true);
  }

  function persistFormData(formData: FormData, options?: { clearKeys?: DirtyScopeKey[]; remountFields?: boolean }) {
    startTransition(async () => {
      try {
        const result = await saveProductAction(formData);
        setState(result);
        setConfirmOpen(false);
        if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
          revealProductFieldErrors(
            { validation, setActiveSection, activeLocale, selectLocale },
            result.fieldErrors,
          );
        } else {
          validation.showFieldErrors({});
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
            await refreshConflictSignals({ quiet: true });
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
    requestProductSaveWithValidation(
      {
        form: formRef.current,
        validation,
        setActiveSection,
        activeLocale,
        selectLocale,
      },
      () => setConfirmOpen(true),
    );
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

  /** Non-conflict whole-record create/push only (UNLINKED / LOCAL_CHANGES). Conflict choice uses ConflictResolver. */
  function handlePushToShopify() {
    if (isDirty) {
      pushToast({ message: "Save your product changes before Push.", tone: "info" });
      return;
    }
    startTransition(async () => {
      const result = await pushSingleProductToShopifyAction(currentProduct.id, false);
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

  function openConflictsFromSyncStrip() {
    setSyncDetailOpen(false);
    openConflicts({ kind: "product", productId: currentProduct.id });
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
        className="grid gap-4 transition-colors"
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
                  onOpen={() => openConflicts({ kind: "product", productId: currentProduct.id })}
                />
              ) : null}
              <AdminIconButton
                label="Delete product"
                tooltip="Delete this product permanently. Storefront pages for it will stop working."
                tone="danger"
                disabled={isPending}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-3.5" strokeWidth={2} aria-hidden="true" />
              </AdminIconButton>
              <SaveButtons iconOnly onOpenConfirm={requestSave} pending={isPending} />
            </div>
          </div>

          <ProgressBar pending={isPending} />
          <AdminAlert message={state.fieldErrors ? undefined : state.error} />

          {currentProduct.shopifyProductId ? (
            <ProductConflictCompareBanner
              signal={productConflict}
              commerceFieldCount={commerceFieldCount}
              localeTabs={localeTabs.map((tab) => ({ code: tab.code, label: tab.label }))}
              onOpen={() => openConflicts({ kind: "product", productId: currentProduct.id })}
            />
          ) : null}

          <AdminPanel.Root
            data-component="ProductLocaleWorkspace"
            stickyAbove="var(--adm-product-workspace-sticky-height, 5.5rem)"
          >
            <AdminPanel.Header
              sticky
              stickyBand="locale"
              className="adm-panel__header--ruled"
            >
              <AdminLocaleTabs
                embedded
                active={activeLocale}
                onSelect={selectLocale}
                locales={localeTabs}
                dirtyLocales={dirtyLocales}
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
                      onOpen={() => openConflicts({
                        kind: "productLocale",
                        productId: currentProduct.id,
                        locale: activeLocale,
                      })}
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
                conflictSections={conflictSections}
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
                      onOpen={() => openConflicts({
                        kind: "productSection",
                        productId: currentProduct.id,
                        locale: syncLocale,
                        section: activeSection,
                      })}
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
                          validation={validation}
                          translationLocales={translationLocales}
                          activeSection={activeSection}
                          activeLocale={activeLocale}
                          onLocaleChange={selectLocale}
                          selectedShopifyCategoryAttributes={extractSelectedShopifyCategoryAttributes(currentProduct.shopifySnapshot)}
                          productId={currentProduct.id}
                          onSkuAssigned={() => {
                            void (async () => {
                              try {
                                const saved = await getSavedProductPayload(currentProduct.id);
                                if (!saved) return;
                                setState((prev) => ({ ...prev, product: saved }));
                                onUpdated?.(saved);
                                setFieldsRevision((value) => value + 1);
                                if (!saved.shopifyProductId) return;
                                // Mirror Save: re-inspect windows + reload conflict chips
                                // after SKU write-through (columns alone never flip syncStatus).
                                const inspectResult = await inspectProductSyncAction(saved.id);
                                if (inspectResult.inspection) {
                                  setInspection(inspectResult.inspection);
                                }
                                await refreshConflictSignals({ quiet: true });
                              } catch {
                                // Keep assign success; conflict chrome refreshes from the top-bar check.
                              }
                            })();
                          }}
                        />
                      </div>
                      <ProductDetailFields
                        key={`details-${currentProduct.id}-${fieldsRevision}`}
                        details={details}
                        translationsDetails={Object.fromEntries(translationLocales.map(({ code }) => [code, draft.translations[code]?.details]))}
                        mode="edit"
                        translationLocales={translationLocales}
                        activeSection={activeSection}
                        activeLocale={activeLocale}
                        shopifyLinked={Boolean(currentProduct.shopifyProductId)}
                        shopifySnapshot={currentProduct.shopifySnapshot}
                        workingSnapshot={currentProduct.workingSnapshot}
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
                        activeLocale={activeLocale}
                        translationLocales={translationLocales}
                      />
                    </div>

                    <div hidden={activeSection !== "media"}>
                      <ProductMediaManager
                        product={currentProduct}
                        onAltPersistStart={() => {
                          // Blur fires before the click that may hit a nav link. Clear
                          // Media dirty synchronously so leave-guard does not false-positive
                          // while the independent alt server action is already persisting.
                          flushSync(() => clearDirty([sectionDirtyKey("*", "media")]));
                        }}
                        onChange={(next) => {
                          setState({ success: "Gallery updated locally.", product: next });
                          clearDirty([sectionDirtyKey("*", "media")]);
                          // Do not router.refresh here — it races leave-guard / remounts
                          // the editor while alt inputs are mid-edit. Server revalidatePath
                          // keeps list caches; local product state is already updated.
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
        onPush={handlePushToShopify}
        onOpenConflicts={openConflictsFromSyncStrip}
      />

      <AdminConfirmModal
        open={confirmOpen}
        title={`Save ${currentProduct.name}`}
        description="This saves the whole product locally. Shopify will not change until you push or resolve conflicts."
        confirmLabel="Yes, save changes"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          submitFormAfterConfirmClose(formRef.current, () => setConfirmOpen(false));
        }}
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
        formBlocked={isDirty || isPending}
        onToast={(message, tone) => pushToast({ message, tone })}
        onApplied={(info) => { void handleConflictsApplied(info); }}
      />
    </>
  );
}
