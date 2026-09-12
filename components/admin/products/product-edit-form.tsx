"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  deleteProductAction,
  saveProductAction,
  type ProductActionState,
} from "@/app/admin/actions/products";
import {
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
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { ProductDetailFields, ProductFormFields } from "@/components/admin/products/product-form-fields";
import { ProductMediaManager } from "@/components/admin/products/product-media-manager";
import { ProgressBar, ProductSyncStrip, SaveButtons } from "@/components/admin/products/product-sync-strip";
import {
  getProductEditorDetails,
  productToDraft,
  PRODUCT_SAVE_FAILURE_MESSAGE,
} from "@/components/admin/products/product-helpers";
import type { CollectionOption, ProductRecord } from "@/components/admin/products/product-types";
import type { ProductFieldName } from "@/lib/products/product-form-validation";
import type { ProductSyncInspection } from "@/lib/shopify/product-sync";

export function EditProductForm({
  product,
  collections,
  issues = [],
  onUpdated,
  onDeleted,
  highlighted = false,
}: {
  product: ProductRecord;
  collections: CollectionOption[];
  issues?: AdminIssueSummary[];
  onUpdated?: (product: ProductRecord) => void;
  onDeleted?: (productId: string) => void;
  highlighted?: boolean;
}) {
  const [state, setState] = useState<ProductActionState>({});
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [inspection, setInspection] = useState<ProductSyncInspection | null>(null);
  const [conflictResolution, setConflictResolution] = useState<"shopify" | "synarava" | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const validation = useAdminFormValidation<ProductFieldName>({ formRef });
  const currentProduct = state.product ?? product;
  const draft = productToDraft(currentProduct);
  const currentDepartment = currentProduct.collections.find((item) => item.collection.isPrimaryNav)?.collection.slug ?? "";
  const details = getProductEditorDetails(currentProduct.details, currentProduct.characteristics, currentDepartment);
  const { pushToast } = useAdminToast();
  const router = useRouter();

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

  async function formAction(formData: FormData) {
    startTransition(async () => {
      try {
        const result = await saveProductAction(formData);
        setState(result);
        setConfirmOpen(false);
        validation.showFieldErrors(result.fieldErrors ?? {});
        if (result.success) pushToast({ message: result.success, tone: "success" });
        if (result.warning) pushToast({ message: result.warning, tone: "info" });
        if (result.product) {
          setIsDirty(false);
          setInspection(result.product.shopifyProductId
            ? {
                state: result.product.syncStatus === "CONFLICT" ? "CONFLICT" : result.product.syncStatus === "PENDING" ? "LOCAL_CHANGES" : "SYNCED",
                remoteUpdatedAt: result.product.shopifyUpdatedAt?.toISOString() ?? null,
                publications: inspection?.publications ?? [],
                differences: inspection?.differences ?? [],
              }
            : { state: "UNLINKED", remoteUpdatedAt: null, publications: [], differences: [] });
          onUpdated?.(result.product);
        }
      } catch {
        setState({ error: PRODUCT_SAVE_FAILURE_MESSAGE });
        setConfirmOpen(false);
        validation.showFieldErrors({});
        pushToast({ message: PRODUCT_SAVE_FAILURE_MESSAGE, tone: "error" });
      }
    });
  }

  function requestSave() {
    setState({});
    if (validation.validate()) setConfirmOpen(true);
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

  function handlePushToShopify(force = false) {
    setConflictResolution(null);
    startTransition(async () => {
      const result = await pushSingleProductToShopifyAction(currentProduct.id, force);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (result.translationWarning) pushToast({ message: result.translationWarning, tone: "info" });
      if (result.inspection) setInspection(result.inspection);
      if (result.product) {
        setState({ success: result.success, product: result.product });
        onUpdated?.(result.product);
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
        setState({ success: result.success, product: result.product });
        setIsDirty(false);
        onUpdated?.(result.product);
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
        <form ref={formRef} action={formAction} noValidate className="grid gap-4" onChange={() => setIsDirty(true)}>
          <input type="hidden" name="productId" value={currentProduct.id} />

          <div
            className="flex flex-wrap items-start justify-between gap-4 pb-4"
            style={{ borderBottom: "1px solid var(--adm-border)" }}
          >
            <div>
              <p className="adm-section-tag">[ EDIT PRODUCT ]</p>
              <h3 className="adm-title-sm mt-2">{currentProduct.name}</h3>
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
          <ProductSyncStrip
            product={currentProduct}
            dirty={isDirty}
            inspection={inspection}
            pending={isPending}
            onCheck={handleCheckShopify}
            onPull={() => handlePullFromShopify(false)}
            onPush={() => handlePushToShopify(false)}
            onResolve={setConflictResolution}
          />

          <ProductFormFields
            key={`${currentProduct.id}-${new Date(currentProduct.updatedAt).getTime()}`}
            draft={draft}
            collections={collections}
            variantExists={currentProduct.variants.length > 0}
            issues={issues}
            validation={validation}
          />
          <ProductDetailFields
            key={`details-${currentProduct.id}-${new Date(currentProduct.updatedAt).getTime()}`}
            details={details}
            mode="edit"
            issues={issues}
            collections={collections}
          />

          <div
            className="flex items-center justify-between gap-4 pt-4"
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
        <ProductMediaManager
          product={currentProduct}
          onChange={(product) => {
            setState({ success: "Gallery updated locally.", product });
            setIsDirty(false);
            onUpdated?.(product);
          }}
        />
      </div>

      <AdminConfirmModal
        open={confirmOpen}
        title={`Save ${currentProduct.name}`}
        description="This saves locally only. Shopify will not change. If Shopify-backed commerce fields changed, Push to Shopify becomes available after saving."
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
        description="Shopify-backed fields saved in Synarava will be replaced by the current Shopify version. Synarava-only content and editorial media will be preserved."
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
        description="This action removes the product record permanently. Public storefront pages for this item will stop working after deletion."
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
    </>
  );
}
