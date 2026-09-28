"use client";

import { useCallback, type RefObject } from "react";

import { useAdminFormValidation } from "@/components/admin/shared/admin-form-validation";
import {
  validateCollectionForm,
  type CollectionFieldName,
} from "@/lib/admin/collection-form-validation";

export function useCollectionFormValidation(formRef: RefObject<HTMLFormElement | null>) {
  const validation = useAdminFormValidation<CollectionFieldName>({ formRef });
  const { showFieldErrors } = validation;

  const requestConfirm = useCallback((open: () => void) => {
    const form = formRef.current;
    if (!form) return;
    const errors = validateCollectionForm(form);
    showFieldErrors(errors);
    if (Object.keys(errors).length === 0) open();
  }, [formRef, showFieldErrors]);

  return { ...validation, requestConfirm };
}
