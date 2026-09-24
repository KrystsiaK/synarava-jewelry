"use client";

import {
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { X } from "lucide-react";

import {
  AdminFieldShell,
  useAdminFieldIds,
} from "@/components/admin/shared/admin-field-shell";
import type { AdminFieldOwner } from "@/components/admin/shared/ownership-label";
import { cn } from "@/lib/ui";

type InputProps = Omit<ComponentProps<"input">, "className" | "children">;

export type AdminTextControlProps = InputProps & {
  controlId?: string;
  error?: string;
  /** Soft orange chrome (ignored when error/invalid is set). */
  warning?: string;
  /** Force error chrome without error copy (e.g. issue-linked fields). */
  invalid?: boolean;
  disabled?: boolean;
  inputClassName?: string;
  groupClassName?: string;
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
  /** Clear icon inside the field; visible on focus when the value is non-empty. */
  clearable?: boolean;
  onClear?: () => void;
  "aria-invalid"?: true | undefined;
  "aria-errormessage"?: string | undefined;
  "aria-describedby"?: string | undefined;
};

function readHasValue(value: InputProps["value"] | InputProps["defaultValue"]) {
  if (value == null) return false;
  return String(value).length > 0;
}

/**
 * Input + optional affixes / clear, without label shell.
 * Use inside AdminTextField or embed in composite controls (category search, etc.).
 */
export function AdminTextControl({
  controlId,
  error,
  warning,
  invalid = false,
  disabled,
  inputClassName,
  groupClassName,
  startAdornment,
  endAdornment,
  clearable = false,
  onClear,
  "aria-invalid": ariaInvalid,
  "aria-errormessage": ariaErrorMessage,
  "aria-describedby": ariaDescribedBy,
  onInput,
  onChange,
  value,
  defaultValue,
  ...inputProps
}: AdminTextControlProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isControlled = value !== undefined;
  const [uncontrolledHasValue, setUncontrolledHasValue] = useState(() =>
    readHasValue(defaultValue),
  );
  // Controlled value: derive during render. Uncontrolled: track via input events.
  const hasValue = isControlled ? readHasValue(value) : uncontrolledHasValue;
  const showError = Boolean(error) || invalid || ariaInvalid === true;
  const showWarning = !showError && Boolean(warning);

  function clearField() {
    const el = inputRef.current;
    if (!el || disabled) return;

    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    descriptor?.set?.call(el, "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    if (!isControlled) setUncontrolledHasValue(false);
    onClear?.();
    el.focus();
  }

  // Always use adm-field-group so every text control shares one chrome.
  // Clear / adornments are optional slots inside that same border.
  return (
    <div
      data-slot="control-group"
      data-clearable={clearable ? "true" : "false"}
      className={cn(
        "adm-field-group",
        showError ? "adm-field-group--error" : showWarning ? "adm-field-group--warning" : null,
        groupClassName,
      )}
    >
      {startAdornment != null ? (
        <span data-slot="start-adornment" className="adm-field-group__affix adm-field-group__affix--start">
          {startAdornment}
        </span>
      ) : null}
      <input
        {...inputProps}
        ref={inputRef}
        id={controlId}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        aria-invalid={showError ? true : undefined}
        aria-errormessage={showError ? ariaErrorMessage : undefined}
        aria-describedby={ariaDescribedBy}
        onChange={(event) => {
          if (!isControlled) setUncontrolledHasValue(readHasValue(event.target.value));
          onChange?.(event);
        }}
        onInput={(event) => {
          if (!isControlled) setUncontrolledHasValue(readHasValue(event.currentTarget.value));
          onInput?.(event);
        }}
        className={cn("adm-field adm-field--in-group", inputClassName)}
      />
      {clearable ? (
        <button
          type="button"
          data-slot="clear"
          data-visible={hasValue ? "true" : "false"}
          className="adm-field-group__clear"
          aria-label="Clear field"
          tabIndex={-1}
          disabled={disabled || !hasValue}
          onMouseDown={(event) => event.preventDefault()}
          onClick={clearField}
        >
          <X aria-hidden="true" size={14} strokeWidth={1.8} />
        </button>
      ) : null}
      {endAdornment != null ? (
        <span data-slot="end-adornment" className="adm-field-group__affix adm-field-group__affix--end">
          {endAdornment}
        </span>
      ) : null}
    </div>
  );
}

export type AdminTextFieldProps = InputProps & {
  label?: ReactNode;
  owner?: AdminFieldOwner;
  help?: ReactNode;
  required?: boolean;
  error?: string;
  errorId?: string;
  warning?: string;
  invalid?: boolean;
  className?: string;
  unitId?: string;
  issue?: ReactNode;
  inputClassName?: string;
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
  clearable?: boolean;
  onClear?: () => void;
};

/**
 * Single-line admin text control with label shell.
 * Optional clear icon appears inside the field on focus when it has a value.
 */
export function AdminTextField({
  id,
  label,
  owner,
  help,
  required = false,
  error,
  errorId,
  warning,
  invalid,
  disabled,
  className,
  unitId,
  issue,
  inputClassName,
  startAdornment,
  endAdornment,
  clearable,
  onClear,
  "aria-invalid": ariaInvalid,
  "aria-errormessage": ariaErrorMessage,
  ...inputProps
}: AdminTextFieldProps) {
  const { controlId, messageId, warningId } = useAdminFieldIds(id, errorId);

  return (
    <AdminFieldShell
      id={unitId}
      component="AdminTextField"
      label={label}
      owner={owner}
      help={help}
      required={required}
      error={error}
      errorId={messageId}
      warning={warning}
      warningId={warningId}
      issue={issue}
      disabled={disabled}
      className={className}
      controlId={controlId}
    >
      <AdminTextControl
        {...inputProps}
        controlId={controlId}
        error={error}
        warning={warning}
        invalid={invalid}
        disabled={disabled}
        inputClassName={inputClassName}
        startAdornment={startAdornment}
        endAdornment={endAdornment}
        clearable={clearable}
        onClear={onClear}
        required={required}
        aria-invalid={ariaInvalid === true ? true : undefined}
        aria-errormessage={ariaErrorMessage ?? messageId}
        aria-describedby={!error && warning ? warningId : undefined}
      />
    </AdminFieldShell>
  );
}

export { fieldClass } from "@/components/admin/shared/admin-field-shell";
