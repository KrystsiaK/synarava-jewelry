"use client";

import { flushSync } from "react-dom";

import type { AdminFormValidation } from "@/components/admin/shared/admin-form-validation";
import type { ProductEditorSection } from "@/components/admin/products/product-editor-tabs";
import {
  firstProductFieldError,
  PRODUCT_FIELD_SECTION,
  PRODUCT_FIELD_VISUAL_ORDER,
  readProductFormValidationInput,
  validateProductInput,
  type ProductFieldErrors,
  type ProductFieldName,
} from "@/lib/products/product-form-validation";

const SOURCE_LOCALE = "en";

export type ProductValidationNavigateArgs = {
  form: HTMLFormElement | null;
  validation: AdminFormValidation<ProductFieldName>;
  setActiveSection: (section: ProductEditorSection) => void;
  /** Current locale code; when not EN, forced to EN so Title/Slug errors are visible. */
  activeLocale: string;
  selectLocale: (locale: string) => void;
};

/**
 * Open the tab (and EN locale) for the first error in visual field order,
 * then paint field errors and scroll/focus that control.
 */
export function revealProductFieldErrors(
  {
    validation,
    setActiveSection,
    activeLocale,
    selectLocale,
  }: Omit<ProductValidationNavigateArgs, "form">,
  fieldErrors: ProductFieldErrors,
): void {
  const first = firstProductFieldError(fieldErrors);
  if (!first) {
    validation.showFieldErrors({});
    return;
  }

  const section = PRODUCT_FIELD_SECTION[first] as ProductEditorSection;
  flushSync(() => {
    if (activeLocale !== SOURCE_LOCALE) selectLocale(SOURCE_LOCALE);
    setActiveSection(section);
  });
  validation.showFieldErrors(fieldErrors, { fieldOrder: PRODUCT_FIELD_VISUAL_ORDER });
}

/**
 * Client-side Save gate: validate all required commerce fields regardless of
 * which tab is open. On failure, jump to the first error; on success, call onValid.
 */
export function requestProductSaveWithValidation(
  args: ProductValidationNavigateArgs,
  onValid: () => void,
): boolean {
  const form = args.form;
  if (!form) return false;

  const fieldErrors = validateProductInput(readProductFormValidationInput(form));
  if (Object.keys(fieldErrors).length > 0) {
    revealProductFieldErrors(args, fieldErrors);
    return false;
  }

  args.validation.showFieldErrors({});
  onValid();
  return true;
}
