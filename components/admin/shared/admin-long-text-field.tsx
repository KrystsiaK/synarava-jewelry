"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { PencilLine } from "lucide-react";

import { AnimatedModal } from "@/components/ui/animated-modal";

type AdminLongTextFieldProps = {
  name: string;
  label: React.ReactNode;
  dialogLabel?: string;
  defaultValue?: string | null;
  placeholder?: string;
  rows?: number;
};

export function AdminLongTextField({
  name,
  label,
  dialogLabel,
  defaultValue = "",
  placeholder = "No content yet.",
  rows = 12,
}: AdminLongTextFieldProps) {
  const titleId = useId();
  const hiddenFieldRef = useRef<HTMLTextAreaElement>(null);
  const initialValue = defaultValue ?? "";
  const [value, setValue] = useState(initialValue);
  const [draftValue, setDraftValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const plainLabel = dialogLabel ?? (typeof label === "string" ? label : name);

  useEffect(() => {
    const form = hiddenFieldRef.current?.form;
    if (!form) return;

    function handleReset() {
      setValue(initialValue);
      setDraftValue(initialValue);
      setOpen(false);
    }

    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, [initialValue]);

  function openEditor() {
    setDraftValue(value);
    setOpen(true);
  }

  const closeEditor = useCallback(() => {
    setDraftValue(value);
    setOpen(false);
  }, [value]);

  function applyChanges() {
    setValue(draftValue);
    if (hiddenFieldRef.current) {
      hiddenFieldRef.current.value = draftValue;
      hiddenFieldRef.current.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setOpen(false);
  }

  return (
    <div data-component="AdminLongTextField" className="grid min-w-0 gap-2">
      <div>{label}</div>
      <textarea
        ref={hiddenFieldRef}
        name={name}
        value={value}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
      <div className="adm-long-text-preview">
        <p className="adm-long-text-preview__copy" data-empty={value ? undefined : "true"}>
          {value || placeholder}
        </p>
        <button
          type="button"
          className="adm-long-text-preview__action"
          onClick={openEditor}
          aria-label={`Edit ${plainLabel}`}
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
            Edit the complete text here. The product form keeps a compact preview.
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
          className="adm-field adm-long-text-editor"
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
    </div>
  );
}
