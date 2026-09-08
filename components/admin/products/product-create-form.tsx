"use client";

import { useRef, useState, useTransition } from "react";

import {
  autosaveProductDraftAction,
  saveProductAction,
  type ProductActionState,
} from "@/app/admin/actions/products";
import { AdminConfirmModal } from "@/components/admin/shared/admin-confirm-modal";
import {
  AdminFormAlert,
  useAdminFormValidation,
} from "@/components/admin/shared/admin-form-validation";
import { AdminHelp } from "@/components/admin/shared/admin-help";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { buildDraftFormData, useDraftAutosave } from "@/components/admin/shared/use-draft-autosave";
import { ProductDetailFields, ProductFormFields } from "@/components/admin/products/product-form-fields";
import { ProductMediaManager } from "@/components/admin/products/product-media-manager";
import { ProgressBar, SaveButtons } from "@/components/admin/products/product-sync-strip";
import { emptyDraft, getProductEditorDetails } from "@/components/admin/products/product-helpers";
import type { CollectionOption, ProductDraft, ProductRecord } from "@/components/admin/products/product-types";
import type { ProductFieldName } from "@/lib/products/product-form-validation";

export function CreateProductForm({
  collections,
  onCreated,
}: {
  collections: CollectionOption[];
  onCreated?: (product: ProductRecord) => void;
}) {
  const [state, setState] = useState<ProductActionState>({});
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draftId, setDraftId] = useState("");
  const [draftProduct, setDraftProduct] = useState<ProductRecord | null>(null);
  const [draft] = useState<ProductDraft>(emptyDraft);
  const formRef = useRef<HTMLFormElement>(null);
  const validation = useAdminFormValidation<ProductFieldName>({ formRef });
  const { pushToast } = useAdminToast();

  useDraftAutosave({
    formRef,
    saveDraft: autosaveProductDraftAction,
    recordIdField: "productId",
    onSaved: (result) => {
      if (result.recordId) setDraftId(result.recordId);
      if (result.product) setDraftProduct(result.product);
      if (result.error) pushToast({ message: result.error, tone: "error" });
    },
  });

  async function ensureDraftForGallery() {
    if (draftProduct) return draftProduct;
    const form = formRef.current;
    if (!form) return null;
    const formData = buildDraftFormData(form);
    formData.set("forceDraft", "1");
    const result = await autosaveProductDraftAction(formData);
    if (result.error) {
      pushToast({ message: result.error, tone: "error" });
      return null;
    }
    if (result.recordId) {
      setDraftId(result.recordId);
      const field = form.elements.namedItem("productId");
      if (field instanceof HTMLInputElement) field.value = result.recordId;
    }
    if (result.product) setDraftProduct(result.product);
    return result.product ?? null;
  }

  async function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await saveProductAction(formData);
      setState(result);
      setConfirmOpen(false);
      validation.showFieldErrors(result.fieldErrors ?? {});
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (result.syncWarning) pushToast({ message: `Saved locally. Sync failed: ${result.syncWarning}`, tone: "error" });

      if (result.product) {
        onCreated?.(result.product);
      }

      if (result.success && result.created) {
        formRef.current?.reset();
      }
    });
  }

  function requestSave() {
    setState({});
    if (validation.validate()) setConfirmOpen(true);
  }

  return (
    <>
      <form ref={formRef} action={formAction} noValidate className="adm-panel grid gap-4 p-5">
        <input type="hidden" name="productId" value={draftId} />
        <div
          className="flex items-center justify-between gap-4 pb-4"
          style={{ borderBottom: "1px solid var(--adm-border)" }}
        >
          <div>
            <p className="adm-section-tag">[ NEW UNIT ]</p>
            <h2 className="adm-title-sm mt-2">
              Create product
            </h2>
          </div>
          <SaveButtons onOpenConfirm={requestSave} pending={isPending} />
        </div>

        <ProgressBar pending={isPending} />
        <AdminFormAlert message={state.fieldErrors ? undefined : state.error} />
        <div>
          <AdminHelp label="Publishing guidance">
            Saving updates the database. Published products can immediately affect the public storefront.
          </AdminHelp>
        </div>

        <ProductFormFields
          draft={{ ...draft, imageUrl: draftProduct?.imageUrl ?? "" }}
          collections={collections}
          validation={validation}
        />
        <ProductMediaManager
          product={draftProduct}
          ensureProduct={ensureDraftForGallery}
          onChange={(product) => {
            setDraftId(product.id);
            setDraftProduct(product);
          }}
        />
        <ProductDetailFields details={getProductEditorDetails(null)} mode="create" collections={collections} />

        <div
          className="flex items-center justify-end pt-4"
          style={{ borderTop: "1px solid var(--adm-border)" }}
        >
          <SaveButtons onOpenConfirm={requestSave} pending={isPending} />
        </div>
      </form>

      <AdminConfirmModal
        open={confirmOpen}
        title="Create product"
        description="This saves the product locally only. Shopify will not change. After save, review the commerce state and use Create in Shopify when ready."
        confirmLabel="Continue and save"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => formRef.current?.requestSubmit()}
        pending={isPending}
      />
    </>
  );
}
