"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type RefObject,
} from "react";

import { Tooltip } from "@/components/ui/tooltip";
import { AdminAlert } from "@/components/admin/shared/admin-alert";
import { scrollAdminFieldIntoView } from "@/components/admin/shared/scroll-admin-field";

export type AdminFieldErrors<FieldName extends string = string> = Partial<Record<FieldName, string>>;

export type AdminValidationFieldProps = {
  id: string;
  "aria-invalid": true | undefined;
  "aria-errormessage": string | undefined;
  onInput: () => void;
};

export type ShowFieldErrorsOptions = {
  /** Prefer this visual/tab order when choosing which invalid control to focus. */
  fieldOrder?: readonly string[];
};

export type AdminFormValidation<FieldName extends string> = {
  clearFieldError: (name: FieldName) => void;
  fieldErrorId: (name: FieldName) => string;
  fieldErrors: AdminFieldErrors<FieldName>;
  fieldId: (name: FieldName) => string;
  fieldProps: (name: FieldName) => AdminValidationFieldProps;
  showFieldErrors: (errors: AdminFieldErrors<FieldName>, options?: ShowFieldErrorsOptions) => void;
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

function orderedInvalidFieldNames(
  fieldErrors: AdminFieldErrors,
  fieldOrder?: readonly string[],
): string[] {
  const present = new Set(Object.keys(fieldErrors));
  if (!fieldOrder?.length) return [...present];

  const ordered: string[] = [];
  for (const name of fieldOrder) {
    if (present.has(name)) {
      ordered.push(name);
      present.delete(name);
    }
  }
  for (const name of present) ordered.push(name);
  return ordered;
}

export function focusFirstInvalidField(
  form: HTMLFormElement,
  fieldErrors: AdminFieldErrors,
  fieldOrder?: readonly string[],
) {
  const invalidNames = orderedInvalidFieldNames(fieldErrors, fieldOrder);
  if (invalidNames.length === 0) return;

  // Visible unit wins over a hidden mirror with the same name. Hidden inputs
  // are excluded from constraint validation and scroll to the top of the form.
  for (const name of invalidNames) {
    const anchor = form.querySelector<HTMLElement>(`[data-validation-for="${CSS.escape(name)}"]`);
    if (anchor) {
      scrollAdminFieldIntoView(anchor);
      return;
    }
  }

  const invalidNameSet = new Set(invalidNames);
  // Prefer the first invalid control in visual fieldOrder when provided;
  // otherwise walk the form DOM (legacy behavior / non-product forms).
  if (fieldOrder?.length) {
    for (const name of invalidNames) {
      const field = Array.from(form.elements).find(
        (element): element is ValidatableField =>
          isValidatableField(element)
          && element.name === name
          && element.type !== "hidden",
      );
      if (field) {
        scrollAdminFieldIntoView(field);
        return;
      }
    }
    return;
  }

  const field = Array.from(form.elements).find(
    (element): element is ValidatableField =>
      isValidatableField(element)
      && invalidNameSet.has(element.name)
      && element.type !== "hidden",
  );
  if (!field) return;

  scrollAdminFieldIntoView(field);
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

  const showFieldErrors = useCallback((
    nextErrors: AdminFieldErrors<FieldName>,
    options?: ShowFieldErrorsOptions,
  ) => {
    cancelPendingFocus();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) return;

    // Wait for error markup and any closing confirmation dialog to commit,
    // otherwise the dialog's focus restoration can steal focus back.
    // A second frame lets tab `hidden` toggles (flushSync section changes) paint.
    focusAnimationFrameRef.current = window.requestAnimationFrame(() => {
      focusAnimationFrameRef.current = window.requestAnimationFrame(() => {
        focusAnimationFrameRef.current = null;
        if (formRef.current) {
          focusFirstInvalidField(formRef.current, nextErrors, options?.fieldOrder);
        }
      });
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

export function AdminFieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;

  const node = (
    <p
      data-component="AdminFieldError"
      id={id}
      className="adm-field-error"
      title={message}
    >
      {message}
    </p>
  );

  // Long messages ellipsis in the reserved band; tooltip shows the full copy.
  if (message.length < 48) return node;

  return (
    <Tooltip content={message} side="bottom" delay={220} maxWidth={360}>
      {node}
    </Tooltip>
  );
}

/** Same absolute band as AdminFieldError — orange warning, not blocking. */
export function AdminFieldWarning({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;

  const node = (
    <p
      data-component="AdminFieldWarning"
      id={id}
      className="adm-field-warning"
      title={message}
      role="status"
    >
      {message}
    </p>
  );

  if (message.length < 48) return node;

  return (
    <Tooltip content={message} side="bottom" delay={220} maxWidth={360}>
      {node}
    </Tooltip>
  );
}

/** @deprecated Use `AdminAlert` from `@/components/synarava-cms`. */
export function AdminFormAlert({ message, className }: { message?: string; className?: string }) {
  return <AdminAlert message={message} className={className} />;
}
