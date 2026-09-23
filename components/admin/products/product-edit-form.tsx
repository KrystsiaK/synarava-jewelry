"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";

import {
  deleteProductAction,
  saveProductAction,
  type ProductActionState,
} from "@/app/admin/actions/products";
import {
  checkProductConflictsAction,
  inspectProductSyncAction,
  pullSingleProductFromShopifyAction,
  pushSingleProductToShopifyAction,
} from "@/app/admin/actions/sync";
import { AdminConfirmModal } from "@/components/admin/shared/admin-confirm-modal";
import {
  AdminFormAlert,
  useAdminFormValidation,
} from "@/components/admin/shared/admin-form-validation";
import { AdminIssueInlineWarning } from "@/components/admin/issues/admin-issues-cms";
import type { AdminIssueSummary } from "@/components/admin/shared/admin-issue-types";
import { AdminLocaleTabs, useAdminActiveLocale, type AdminLocaleStatus, type AdminLocaleTab } from "@/components/admin/shared/admin-locale-workspace";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { ProductDetailFields, ProductFormFields } from "@/components/admin/products/product-form-fields";
import { CatalogConflictWorkspace, type CatalogConflictViewScope } from "@/components/admin/products/catalog-conflict-workspace";
import { ProductBranchSyncBar } from "@/components/admin/products/product-branch-sync-bar";
import { ProductMediaManager } from "@/components/admin/products/product-media-manager";
import { ProductEditorTabs, type ProductEditorSection } from "@/components/admin/products/product-editor-tabs";
import {
  buildScopedProductFormData,
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
  "essentials", "catalog", "content", "media", "details", "shopify",
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
  const baselineRef = useRef<FormData | null>(null);
  const validation = useAdminFormValidation<ProductFieldName>({ formRef });
  const currentProduct = state.product ?? product;
  const draft = productToDraft(currentProduct, translationLocales);
  const currentDepartment = currentProduct.collections.find((item) => item.collection.isPrimaryNav)?.collection.slug ?? "";
  const details = getProductEditorDetails(currentProduct.details, currentProduct.characteristics, currentDepartment);
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
  const activeBranchDirty = dirtyScopes.has(dirtyKeyForEdit(activeLocale, activeSection));
  const sectionTitle = ALL_SECTIONS.includes(activeSection)
    ? ({
        essentials: "Essentials",
        catalog: "Catalog",
        content: "Content",
        media: "Media",
        details: "Product page",
        shopify: "Shopify",
      } as const)[activeSection]
    : activeSection;

  useEffect(() => {
    if (!highlighted || !rowRef.current) return;
    rowRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [highlighted]);

  useEffect(() => {
    if (!product.shopifyProductId) return;
    let cancelled = false;
    void inspectProductSyncAction(product.id).then((result) => {
      if (!cancelled && result.inspection) setInspection(result.inspection);
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
      if (fieldId === "field-imageUrl") setActiveSection("media");
      else if (fieldId.startsWith("field-taxonomy-")) setActiveSection("catalog");
      else if (fieldId.startsWith("field-details-")) setActiveSection("details");
      else return;

      window.requestAnimationFrame(() => {
        document.getElementById(fieldId)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }

    openSectionForHash();
    window.addEventListener("hashchange", openSectionForHash);
    return () => window.removeEventListener("hashchange", openSectionForHash);
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
      } else if (options?.quiet && "signals" in result && result.signals && (result.signals.totalCount ?? 0) > 0) {
        pushToast({ message: ("success" in result && result.success) || "Conflicts found after save.", tone: "info" });
      }
    } finally {
      setConflictChecking(false);
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
          setActiveSection("essentials");
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
          setInspection(result.product.shopifyProductId
            ? {
                state: result.product.syncStatus === "CONFLICT" ? "CONFLICT" : result.product.syncStatus === "PENDING" ? "LOCAL_CHANGES" : "SYNCED",
                remoteUpdatedAt: result.product.shopifyUpdatedAt?.toISOString() ?? null,
                publications: inspection?.publications ?? [],
                differences: inspection?.differences ?? [],
              }
            : { state: "UNLINKED", remoteUpdatedAt: null, publications: [], differences: [] });
          onUpdated?.(result.product);
          if (result.product.shopifyProductId) void refreshConflicts(undefined, { quiet: true });
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
    if (previousSection !== "essentials") {
      flushSync(() => setActiveSection("essentials"));
    }
    if (previousLocale !== SOURCE_LOCALE) {
      flushSync(() => selectLocale(SOURCE_LOCALE));
    }
    const valid = validation.validate();
    if (valid) {
      if (previousSection !== "essentials") {
        flushSync(() => setActiveSection(previousSection));
      }
      if (previousLocale !== SOURCE_LOCALE) {
        flushSync(() => selectLocale(previousLocale));
      }
      setConfirmOpen(true);
    }
  }

  function requestBranchSave() {
    const form = formRef.current;
    const baseline = baselineRef.current;
    if (!form || !baseline) {
      pushToast({ message: "Save baseline is not ready yet. Try again in a moment.", tone: "info" });
      return;
    }
    if (activeSection === "media" || activeSection === "shopify") {
      pushToast({ message: "This tab saves through its own gallery/sync actions.", tone: "info" });
      return;
    }

    setState({});
    const previousSection = activeSection;
    const previousLocale = activeLocale;
    if (previousSection !== "essentials") flushSync(() => setActiveSection("essentials"));
    if (previousLocale !== SOURCE_LOCALE) flushSync(() => selectLocale(SOURCE_LOCALE));
    const valid = validation.validate();
    if (previousSection !== "essentials") flushSync(() => setActiveSection(previousSection));
    if (previousLocale !== SOURCE_LOCALE) flushSync(() => selectLocale(previousLocale));
    if (!valid) return;

    const scoped = buildScopedProductFormData({
      baseline,
      current: new FormData(form),
      section: activeSection,
      locale: activeLocale,
    });
    void persistFormData(scoped, {
      clearKeys: [dirtyKeyForEdit(activeLocale, activeSection)],
      remountFields: false,
    });
  }

  function handleCheckShopify() {
    startTransition(async () => {
      const result = await inspectProductSyncAction(currentProduct.id);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.inspection) {
        setInspection(result.inspection);
        pushToast({ message: result.inspection.state === "SYNCED" ? "Shopify is up to date." : "Shopify comparison refreshed.", tone: "success" });
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
        router.refresh();
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
        router.refresh();
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

  const showSectionBranchSave = activeSection !== "media" && activeSection !== "shopify";

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
            className="flex flex-wrap items-start justify-between gap-4 pb-4"
            style={{ borderBottom: "1px solid var(--adm-border)" }}
          >
            <div>
              <p className="adm-section-tag">Product workspace</p>
              <h2 className="adm-title-sm mt-2">Choose an area to edit</h2>
              <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>
                /{currentProduct.slug}
              </p>
              <AdminIssueInlineWarning issues={issues} className="mt-3" />
              {highlighted ? (
                <p
                  className="mt-1 text-xs font-bold uppercase tracking-[0.08em]"
                  style={{ color: "var(--adm-accent)" }}
                >
                  Just created
                </p>
              ) : null}
            </div>
            <SaveButtons onOpenConfirm={requestSave} pending={isPending} />
          </div>

          <ProgressBar pending={isPending} />
          <AdminFormAlert message={state.fieldErrors ? undefined : state.error} />

          {/* Level 1 — whole product */}
          {currentProduct.shopifyProductId ? (
            <div className="grid gap-3">
              <ProductSyncStrip
                product={currentProduct}
                dirty={isDirty}
                inspection={inspection}
                pending={isPending}
                onCheck={handleCheckShopify}
                onOpenDetail={() => setSyncDetailOpen(true)}
              />
              <ProductBranchSyncBar
                level="product"
                productId={currentProduct.id}
                locale={SOURCE_LOCALE}
                localeLabel="English"
                signals={conflictSignals}
                checking={conflictChecking}
                dirty={isDirty}
                onOpen={() => openConflicts({ kind: "product", productId: currentProduct.id })}
                onCheck={() => void refreshConflicts()}
              />
            </div>
          ) : null}

          {/* Level 2 — language */}
          <AdminLocaleTabs
            active={activeLocale}
            onSelect={selectLocale}
            locales={localeTabs}
            dirtyLocales={dirtyLocales}
            ptStatus={activeTranslation?.syncStatus as AdminLocaleStatus | undefined}
          />
          {currentProduct.shopifyProductId ? (
            <ProductBranchSyncBar
              level="locale"
              productId={currentProduct.id}
              locale={activeLocale}
              localeLabel={activeLocaleLabel}
              signals={conflictSignals}
              checking={conflictChecking}
              dirty={localeHasDirty(dirtyScopes, activeLocale, ALL_SECTIONS)}
              onOpen={() => openConflicts({ kind: "productLocale", productId: currentProduct.id, locale: activeLocale })}
              onCheck={() => void refreshConflicts(activeLocale)}
            />
          ) : null}

          {/* Level 3 — section / tab */}
          <ProductEditorTabs
            active={activeSection}
            onChange={setActiveSection}
            dirtySections={dirtySections}
          />
          {currentProduct.shopifyProductId && activeSection !== "shopify" ? (
            <ProductBranchSyncBar
              level="section"
              productId={currentProduct.id}
              locale={activeLocale}
              localeLabel={activeLocaleLabel}
              sectionLabel={sectionTitle}
              signals={conflictSignals}
              checking={conflictChecking}
              dirty={activeBranchDirty}
              showSaveBranch={showSectionBranchSave}
              onSaveBranch={requestBranchSave}
              savePending={isPending}
              onOpen={() => openConflicts({
                kind: "productLocale",
                productId: currentProduct.id,
                locale: isSharedSection(activeSection) ? SOURCE_LOCALE : activeLocale,
              })}
              onCheck={() => void refreshConflicts(isSharedSection(activeSection) ? undefined : activeLocale)}
            />
          ) : null}

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

            <div hidden={activeSection === "media"}>
              <ProductFormFields
                key={`${currentProduct.id}-${fieldsRevision}`}
                draft={draft}
                collections={collections}
                variantExists={currentProduct.variants.length > 0}
                issues={issues}
                validation={validation}
                translationLocales={translationLocales}
                activeSection={activeSection}
                activeLocale={activeLocale}
                onLocaleChange={selectLocale}
              />
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
              />
            </div>

            <div hidden={activeSection !== "media"}>
              <ProductMediaManager
                product={currentProduct}
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

          <div
            className="flex flex-wrap items-center justify-between gap-4 pt-4"
            style={{ borderTop: "1px solid var(--adm-border)" }}
          >
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={isPending}
              className="adm-btn-danger"
            >
              Delete product
            </button>
            <SaveButtons onOpenConfirm={requestSave} pending={isPending} />
          </div>
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
        description="This saves the whole product locally. Shopify will not change. Use Save this branch on a tab to persist only that section/locale while keeping other unsaved tabs in the form."
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
      />
    </>
  );
}
