"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type RefObject,
} from "react";

import { cn } from "@/lib/ui";

export type AdminFieldErrors<FieldName extends string = string> = Partial<Record<FieldName, string>>;

export type AdminValidationFieldProps = {
  id: string;
  "aria-invalid": true | undefined;
  "aria-errormessage": string | undefined;
  onInput: () => void;
};

export type AdminFormValidation<FieldName extends string> = {
  clearFieldError: (name: FieldName) => void;
  fieldErrorId: (name: FieldName) => string;
  fieldErrors: AdminFieldErrors<FieldName>;
  fieldId: (name: FieldName) => string;
  fieldProps: (name: FieldName) => AdminValidationFieldProps;
  showFieldErrors: (errors: AdminFieldErrors<FieldName>) => void;
  validate: () => boolean;
};

type ValidatableField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isValidatableField(element: Element): element is ValidatableField {
  return element instanceof HTMLInputElement
    || element instanceof HTMLSelectElement
    || element instanceof HTMLTextAreaElement;
}

export function collectNativeFieldErrors(form: HTMLFormElement): AdminFieldErrors {
  const errors: AdminFieldErrors = {};

  for (const element of Array.from(form.elements)) {
    if (!isValidatableField(element) || !element.name || !element.willValidate || element.validity.valid) continue;
    errors[element.name] ??= element.dataset.validationMessage || element.validationMessage || "Review this field.";
  }

  return errors;
}

export function focusFirstInvalidField(form: HTMLFormElement, fieldErrors: AdminFieldErrors) {
  const invalidNames = new Set(Object.keys(fieldErrors));
  if (invalidNames.size === 0) return;

  const field = Array.from(form.elements).find(
    (element): element is ValidatableField => isValidatableField(element) && invalidNames.has(element.name),
  );
  if (!field) return;

  field.scrollIntoView({ behavior: "smooth", block: "center" });
  field.focus({ preventScroll: true });
}

export function useAdminFormValidation<FieldName extends string>({
  formRef,
}: {
  formRef: RefObject<HTMLFormElement | null>;
}): AdminFormValidation<FieldName> {
  const validationId = useId();
  const [fieldErrors, setFieldErrors] = useState<AdminFieldErrors<FieldName>>({});
  const focusAnimationFrameRef = useRef<number | null>(null);

  const cancelPendingFocus = useCallback(() => {
    if (focusAnimationFrameRef.current === null) return;
    window.cancelAnimationFrame(focusAnimationFrameRef.current);
    focusAnimationFrameRef.current = null;
  }, []);

  useEffect(() => cancelPendingFocus, [cancelPendingFocus]);

  const fieldId = useCallback((name: FieldName) => `${validationId}-${name}-field`, [validationId]);
  const fieldErrorId = useCallback((name: FieldName) => `${validationId}-${name}-error`, [validationId]);

  const showFieldErrors = useCallback((nextErrors: AdminFieldErrors<FieldName>) => {
    cancelPendingFocus();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) return;

    // Wait for error markup and any closing confirmation dialog to commit,
    // otherwise the dialog's focus restoration can steal focus back.
    focusAnimationFrameRef.current = window.requestAnimationFrame(() => {
      focusAnimationFrameRef.current = null;
      if (formRef.current) focusFirstInvalidField(formRef.current, nextErrors);
    });
  }, [cancelPendingFocus, formRef]);

  const clearFieldError = useCallback((name: FieldName) => {
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }, []);

  const validate = useCallback(() => {
    const form = formRef.current;
    if (!form) return false;
    const errors = collectNativeFieldErrors(form) as AdminFieldErrors<FieldName>;
    showFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formRef, showFieldErrors]);

  const fieldProps = useCallback((name: FieldName): AdminValidationFieldProps => ({
    id: fieldId(name),
    "aria-invalid": fieldErrors[name] ? (true as const) : undefined,
    "aria-errormessage": fieldErrors[name] ? fieldErrorId(name) : undefined,
    onInput: () => clearFieldError(name),
  }), [clearFieldError, fieldErrorId, fieldErrors, fieldId]);

  return { clearFieldError, fieldErrorId, fieldErrors, fieldId, fieldProps, showFieldErrors, validate };
}

export function AdminFieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="adm-field-error">{message}</p>;
}

export function AdminFormAlert({ message, className }: { message?: string; className?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn("border border-[var(--adm-danger)] bg-[var(--adm-danger-soft)] px-4 py-3 text-sm leading-6 text-[var(--adm-danger)]", className)}
    >
      {message}
    </div>
  );
}
