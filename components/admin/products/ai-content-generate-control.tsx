"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";

import { generateProductContentAction } from "@/app/admin/actions/ai-content";
import {
  AI_LOCALES,
  fingerprintAiSourceFields,
  formatFailedApplyMessage,
  type AiFieldSelectionKey,
} from "@/components/admin/products/ai-content-apply";
import { toastMessageForGenerateError } from "@/components/admin/products/ai-content-errors";
import { AiContentPreviewModal } from "@/components/admin/products/ai-content-preview-modal";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import {
  AdminButton,
  AdminCheckboxControl,
  AdminModal,
} from "@/components/synarava-cms";
import type {
  AiField,
  AiLocale,
  ProductContentDraft,
} from "@/lib/ai/product-content/contract";

const LOCALE_LABELS: Record<AiLocale, string> = {
  en: "English",
  pt: "Português",
  ru: "Русский",
};

export type AiApplySelectionsReport = {
  applied: readonly AiFieldSelectionKey[];
  failed: readonly AiFieldSelectionKey[];
};

export type AiContentGenerateControlProps = {
  productId: string;
  /** ISO string of product.updatedAt — stale-guard baseline. */
  productUpdatedAt: string;
  /** Locales available in the editor tabs (always includes en via UI). */
  availableLocales: readonly AiLocale[];
  formRef: React.RefObject<HTMLFormElement | null>;
  getCurrent: (locale: AiLocale, field: AiField) => string;
  onApplySelections: (
    draft: ProductContentDraft,
    selected: ReadonlySet<AiFieldSelectionKey>,
  ) => AiApplySelectionsReport | void;
};

/**
 * Essentials-section control: pick locales → generate → preview → apply to form.
 */
export function AiContentGenerateControl({
  productId,
  productUpdatedAt,
  availableLocales,
  formRef,
  getCurrent,
  onApplySelections,
}: AiContentGenerateControlProps) {
  const { pushToast } = useAdminToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [draft, setDraft] = useState<ProductContentDraft | null>(null);
  const [fingerprintAtGenerate, setFingerprintAtGenerate] = useState("");
  const [fingerprintNow, setFingerprintNow] = useState("");
  const [localesAtGenerate, setLocalesAtGenerate] = useState<AiLocale[]>([]);
  const [pending, startTransition] = useTransition();
  const pickerTitleId = useId();

  const localesForPicker = AI_LOCALES.filter((locale) => availableLocales.includes(locale));
  const [picked, setPicked] = useState<Set<AiLocale>>(
    () => new Set(localesForPicker),
  );

  function openPicker() {
    setPicked(new Set(localesForPicker));
    setPickerOpen(true);
  }

  function toggleLocale(locale: AiLocale, checked: boolean) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (checked) next.add(locale);
      else next.delete(locale);
      return next;
    });
  }

  function runGenerate() {
    const locales = AI_LOCALES.filter((locale) => picked.has(locale));
    if (locales.length === 0) {
      pushToast({ message: "Pick at least one language.", tone: "info" });
      return;
    }
    const fingerprint = fingerprintAiSourceFields(formRef.current, locales);
    setPickerOpen(false);
    startTransition(async () => {
      const result = await generateProductContentAction(productId, locales);
      if (!result.ok) {
        pushToast({ message: toastMessageForGenerateError(result), tone: "error" });
        return;
      }
      setLocalesAtGenerate(locales);
      setFingerprintAtGenerate(fingerprint);
      setFingerprintNow(fingerprint);
      setDraft(result.draft);
      setPreviewOpen(true);
    });
  }

  function handleApply(selected: ReadonlySet<AiFieldSelectionKey>) {
    if (!draft) return;
    const report = onApplySelections(draft, selected);
    const failed = report?.failed ?? [];
    if (failed.length > 0) {
      pushToast({ message: formatFailedApplyMessage(failed), tone: "error" });
    } else {
      pushToast({
        message: "AI fields applied to the form. Review and Save when ready.",
        tone: "success",
      });
    }
    setPreviewOpen(false);
    setDraft(null);
  }

  // Refresh fingerprint from the live form while preview is open (no ref reads during render).
  useEffect(() => {
    if (!previewOpen) return;
    const form = formRef.current;
    if (!form) return;
    const locales = localesAtGenerate;
    function refresh() {
      setFingerprintNow(fingerprintAiSourceFields(form, locales));
    }
    refresh();
    form.addEventListener("input", refresh);
    form.addEventListener("change", refresh);
    return () => {
      form.removeEventListener("input", refresh);
      form.removeEventListener("change", refresh);
    };
  }, [previewOpen, localesAtGenerate, formRef]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2" data-testid="ai-content-generate">
        <p className="text-xs text-[var(--adm-muted)]">
          Draft multilingual copy from product facts. Apply fills the form only — Save is still yours.
        </p>
        <AdminButton
          type="button"
          variant="secondary"
          busy={pending}
          onClick={openPicker}
          leadingIcon={<Sparkles className="size-3.5" aria-hidden="true" />}
          data-testid="ai-content-generate-button"
        >
          {pending ? "Generating…" : "Generate with AI"}
        </AdminButton>
      </div>

      <AdminModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        ariaLabelledBy={pickerTitleId}
        className="grid w-full max-w-md gap-3 p-6"
      >
        <h2 id={pickerTitleId} className="adm-title-sm">
          Languages to generate
        </h2>
        <p className="text-xs text-[var(--adm-muted)]">
          Same languages as the product editor tabs. English title is never overwritten.
        </p>
        <div className="grid gap-2">
          {localesForPicker.map((locale) => (
            <AdminCheckboxControl
              key={locale}
              id={`ai-locale-${locale}`}
              label={LOCALE_LABELS[locale]}
              checked={picked.has(locale)}
              onChange={(event) => toggleLocale(locale, event.target.checked)}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <AdminButton variant="ghost" onClick={() => setPickerOpen(false)}>
            Cancel
          </AdminButton>
          <AdminButton
            variant="primary"
            busy={pending}
            disabled={picked.size === 0}
            onClick={runGenerate}
            data-testid="ai-content-confirm-generate"
          >
            Generate
          </AdminButton>
        </div>
      </AdminModal>

      <AiContentPreviewModal
        open={previewOpen && Boolean(draft)}
        draft={draft}
        productUpdatedAt={productUpdatedAt}
        fingerprintAtGenerate={fingerprintAtGenerate}
        fingerprintNow={fingerprintNow}
        getCurrent={getCurrent}
        onClose={() => {
          setPreviewOpen(false);
          setDraft(null);
        }}
        onApply={handleApply}
      />
    </>
  );
}
