"use client";

import { useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";

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
import { AdminLocaleTabs, useAdminActiveLocale, type AdminLocaleTab } from "@/components/admin/shared/admin-locale-workspace";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { buildDraftFormData, useDraftAutosave } from "@/components/admin/shared/use-draft-autosave";
import { ProductDetailFields, ProductFormFields } from "@/components/admin/products/product-form-fields";
import { ProductMediaManager } from "@/components/admin/products/product-media-manager";
import { ProductEditorTabs, type ProductEditorSection } from "@/components/admin/products/product-editor-tabs";
import { ProgressBar, SaveButtons } from "@/components/admin/products/product-sync-strip";
import {
  emptyDraft,
  getProductEditorDetails,
  PRODUCT_SAVE_FAILURE_MESSAGE,
} from "@/components/admin/products/product-helpers";
import type { CollectionOption, ProductDraft, ProductRecord } from "@/components/admin/products/product-types";
import type { ProductFieldName } from "@/lib/products/product-form-validation";
import type { AdminTranslationLocale } from "@/lib/i18n/admin-translation-locales";

const SOURCE_LOCALE = "en";

function productLocaleTabs(translationLocales: AdminTranslationLocale[]): AdminLocaleTab[] {
  return [{ code: SOURCE_LOCALE, label: "English" }, ...translationLocales];
}

export function CreateProductForm({
  collections,
  onCreated,
  translationLocales = [{ code: "pt", label: "Português" }],
}: {
  collections: CollectionOption[];
  onCreated?: (product: ProductRecord) => void;
  /** Every non-English locale to render a tab for. Defaults to Portuguese only, matching every editor's behavior before the registry drove this. */
  translationLocales?: AdminTranslationLocale[];
}) {
  const [state, setState] = useState<ProductActionState>({});
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draftId, setDraftId] = useState("");
  const [draftProduct, setDraftProduct] = useState<ProductRecord | null>(null);
  const [activeSection, setActiveSection] = useState<ProductEditorSection>("essentials");
  const [draft] = useState<ProductDraft>(() => emptyDraft(translationLocales));
  const localeTabs = productLocaleTabs(translationLocales);
  const [activeLocale, selectLocale] = useAdminActiveLocale("product:new", localeTabs);
  const formRef = useRef<HTMLFormElement>(null);
  const validation = useAdminFormValidation<ProductFieldName>({ formRef });
  const { pushToast } = useAdminToast();

  useDraftAutosave({
    formRef,
    saveDraft: autosaveProductDraftAction,
    onError: () => pushToast({ message: "Draft could not be saved. Please try again.", tone: "error" }),
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
      try {
        const result = await saveProductAction(formData);
        setState(result);
        setConfirmOpen(false);
        validation.showFieldErrors(result.fieldErrors ?? {});
        if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
          setActiveSection("essentials");
        }
        if (result.success) pushToast({ message: result.success, tone: "success" });
        if (result.warning) pushToast({ message: result.warning, tone: "info" });
        if (result.syncWarning) pushToast({ message: `Saved locally. Sync failed: ${result.syncWarning}`, tone: "error" });

        if (result.product) {
          onCreated?.(result.product);
        }

        if (result.success && result.created) {
          formRef.current?.reset();
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

  return (
    <>
      <form ref={formRef} action={formAction} noValidate className="adm-panel grid gap-4 p-5">
        <input type="hidden" name="productId" value={draftId} />
        <div
          className="flex items-center justify-between gap-4 pb-4"
          style={{ borderBottom: "1px solid var(--adm-border)" }}
        >
          <div>
            <p className="adm-section-tag">Product workspace</p>
            <h2 className="adm-title-sm mt-2">
              Build the product one area at a time
            </h2>
          </div>
          <SaveButtons onOpenConfirm={requestSave} pending={isPending} />
        </div>

        <ProgressBar pending={isPending} />
        <AdminFormAlert message={state.fieldErrors ? undefined : state.error} />
        <div>
          <AdminHelp label="Publishing guidance">
            Saving updates the database. Published products can immediately affect the public site.
          </AdminHelp>
        </div>

        <AdminLocaleTabs
          active={activeLocale}
          onSelect={selectLocale}
          locales={localeTabs}
        />

        <ProductEditorTabs
          active={activeSection}
          onChange={setActiveSection}
          includeShopify={false}
        />

        <div
          id={`product-editor-panel-${activeSection}`}
          role="tabpanel"
          aria-labelledby={`product-editor-tab-${activeSection}`}
          className="grid gap-4"
        >
          <ProductFormFields
            draft={{ ...draft, imageUrl: draftProduct?.imageUrl ?? "" }}
            collections={collections}
            validation={validation}
            translationLocales={translationLocales}
            activeSection={activeSection}
            activeLocale={activeLocale}
            onLocaleChange={selectLocale}
          />
          <div hidden={activeSection !== "media"}>
            <ProductMediaManager
              product={draftProduct}
              ensureProduct={ensureDraftForGallery}
              onChange={(product) => {
                setDraftId(product.id);
                setDraftProduct(product);
              }}
            />
          </div>
          <ProductDetailFields
            details={getProductEditorDetails(null)}
            translationsDetails={Object.fromEntries(translationLocales.map(({ code }) => [code, draft.translations[code]?.details]))}
            mode="create"
            collections={collections}
            translationLocales={translationLocales}
            activeSection={activeSection}
            activeLocale={activeLocale}
          />
        </div>

        <div
          className="flex flex-wrap items-center justify-end gap-3 pt-4"
          style={{ borderTop: "1px solid var(--adm-border)" }}
          hidden={activeSection === "media"}
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
