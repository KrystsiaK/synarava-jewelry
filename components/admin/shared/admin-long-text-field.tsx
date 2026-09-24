"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { PencilLine } from "lucide-react";

import {
  AdminFieldShell,
  useAdminFieldIds,
} from "@/components/admin/shared/admin-field-shell";
import type { AdminFieldOwner } from "@/components/admin/shared/ownership-label";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { cn } from "@/lib/ui";

export type AdminLongTextFieldProps = {
  // Omit `name` when the caller submits via hidden mirrors and drives `value`/`onChange`.
  name?: string;
  label?: ReactNode;
  owner?: AdminFieldOwner;
  help?: ReactNode;
  required?: boolean;
  dialogLabel?: string;
  defaultValue?: string | null;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
  error?: string;
  errorId?: string;
  warning?: string;
  invalid?: boolean;
  issue?: ReactNode;
  disabled?: boolean;
  className?: string;
  unitId?: string;
  id?: string;
  /** Extra classes for the modal editor (e.g. font-mono for Markdown). */
  editorClassName?: string;
};

/**
 * Long copy: full-width text preview + Edit opens a modal.
 * Preview is plain text (not an input) — modal editor may later become WYSIWYG.
 * Shares AdminFieldShell error/owner/help chrome with text/select.
 */
export function AdminLongTextField({
  name,
  label,
  owner,
  help,
  required = false,
  dialogLabel,
  defaultValue = "",
  value: controlledValue,
  onChange,
  placeholder = "No content yet.",
  rows = 12,
  error,
  errorId,
  warning,
  invalid = false,
  issue,
  disabled = false,
  className,
  unitId,
  id,
  editorClassName,
}: AdminLongTextFieldProps) {
  const isControlled = controlledValue !== undefined;
  const titleId = useId();
  const { controlId, messageId, warningId } = useAdminFieldIds(id, errorId);
  const hiddenFieldRef = useRef<HTMLTextAreaElement>(null);
  const initialValue = defaultValue ?? "";
  const [internalValue, setInternalValue] = useState(initialValue);
  const value = isControlled ? controlledValue : internalValue;
  const [draftValue, setDraftValue] = useState(value);
  const [open, setOpen] = useState(false);
  const plainLabel = dialogLabel ?? (typeof label === "string" ? label : name ?? "field");
  const showError = Boolean(error) || invalid;
  const showWarning = !showError && Boolean(warning);

  useEffect(() => {
    if (isControlled) return;
    const form = hiddenFieldRef.current?.form;
    if (!form) return;

    function handleReset() {
      setInternalValue(initialValue);
      setDraftValue(initialValue);
      setOpen(false);
    }

    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, [initialValue, isControlled]);

  function openEditor() {
    if (disabled) return;
    setDraftValue(value);
    setOpen(true);
  }

  const closeEditor = useCallback(() => {
    setDraftValue(value);
    setOpen(false);
  }, [value]);

  function applyChanges() {
    if (isControlled) {
      onChange?.(draftValue);
    } else {
      setInternalValue(draftValue);
      if (hiddenFieldRef.current) {
        hiddenFieldRef.current.value = draftValue;
        hiddenFieldRef.current.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    setOpen(false);
  }

  return (
    <AdminFieldShell
      id={unitId}
      component="AdminLongTextField"
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
      className={cn("w-full min-w-0", className)}
      controlId={controlId}
    >
      {name ? (
        <textarea
          ref={hiddenFieldRef}
          name={name}
          value={value}
          readOnly
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
        />
      ) : null}

      <div
        data-slot="long-text-preview"
        className={cn(
          "adm-long-text-preview",
          showError ? "adm-long-text-preview--error" : showWarning ? "adm-long-text-preview--warning" : null,
        )}
        aria-invalid={showError ? true : undefined}
        aria-errormessage={showError ? messageId : undefined}
        aria-describedby={!showError && warning ? warningId : undefined}
      >
        <p className="adm-long-text-preview__copy" data-empty={value ? undefined : "true"}>
          {value || placeholder}
        </p>
        <button
          type="button"
          id={controlId}
          className="adm-long-text-preview__action"
          onClick={openEditor}
          disabled={disabled}
          aria-label={`Edit ${plainLabel}`}
          aria-invalid={showError ? true : undefined}
        >
          <PencilLine aria-hidden="true" className="size-3.5" />
          Edit
        </button>
      </div>

      <AnimatedModal
        open={open}
        onClose={closeEditor}
        ariaLabelledBy={titleId}
        className="adm-panel pointer-events-auto grid max-h-[min(44rem,calc(100dvh-2rem))] w-full max-w-3xl gap-5 overflow-y-auto p-5 sm:p-6"
        portalClassName="admin-modal-root"
        zIndexClassName="z-[200]"
        backdropZIndexClassName="z-[190]"
      >
        <div>
          <h3 id={titleId} className="adm-title-sm">{plainLabel}</h3>
          <p className="mt-1 text-xs text-[var(--adm-muted)]">
            Edit the complete text here. The form keeps a compact preview.
          </p>
        </div>
        <textarea
          aria-label={plainLabel}
          value={draftValue}
          onChange={(event) => {
            event.stopPropagation();
            setDraftValue(event.target.value);
          }}
          rows={rows}
          className={cn("adm-field adm-long-text-editor", editorClassName)}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--adm-border)] pt-4">
          <span className="text-xs tabular-nums text-[var(--adm-subtle)]">
            {draftValue.length.toLocaleString()} characters
          </span>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="adm-btn-ghost" onClick={closeEditor}>Cancel</button>
            <button type="button" className="adm-btn-primary" onClick={applyChanges}>Apply changes</button>
          </div>
        </div>
      </AnimatedModal>
    </AdminFieldShell>
  );
}
