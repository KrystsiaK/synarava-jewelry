"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link2, PencilLine, Unlink } from "lucide-react";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";

import {
  AdminFieldShell,
  useAdminFieldIds,
} from "@/components/admin/shared/admin-field-shell";
import type { AdminFieldOwner } from "@/components/admin/shared/ownership-label";
import { RichText } from "@/components/content/rich-text";
import { AnimatedModal } from "@/components/ui/animated-modal";
import {
  isRichTextEmpty,
  normalizeRichTextForEditor,
  normalizeRichTextForStorage,
  richTextPlainLength,
  sanitizeHref,
} from "@/lib/content/rich-text";
import { cn } from "@/lib/ui";

export type AdminRichTextFieldProps = {
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
  error?: string;
  errorId?: string;
  warning?: string;
  invalid?: boolean;
  issue?: ReactNode;
  disabled?: boolean;
  className?: string;
  unitId?: string;
  id?: string;
};

function RichTextModalEditor({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (html: string) => void;
  label: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        listItem: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          HTMLAttributes: {
            rel: "noopener noreferrer",
            target: "_blank",
          },
        },
      }),
    ],
    content: normalizeRichTextForEditor(value),
    onUpdate: ({ editor: current }) => {
      onChange(current.getHTML());
    },
    editorProps: {
      attributes: {
        class: "adm-rich-text-editor__surface",
        "aria-label": label,
      },
    },
  });

  function applyLink() {
    if (!editor) return;
    const previous = (editor.getAttributes("link").href as string | undefined) ?? "https://";
    const next = window.prompt("Link URL", previous);
    if (next === null) return;
    if (!next.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const href = sanitizeHref(next) ?? next.trim();
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }

  function removeLink() {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
  }

  return (
    <div className="adm-rich-text-editor">
      <div className="adm-rich-text-editor__toolbar" role="toolbar" aria-label="Formatting">
        <button
          type="button"
          className="adm-rich-text-editor__tool"
          onClick={applyLink}
          disabled={!editor}
        >
          <Link2 aria-hidden="true" className="size-3.5" />
          Link
        </button>
        <button
          type="button"
          className="adm-rich-text-editor__tool"
          onClick={removeLink}
          disabled={!editor}
        >
          <Unlink aria-hidden="true" className="size-3.5" />
          Unlink
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

/**
 * Link-capable rich text: same preview + Edit modal chrome as AdminLongTextField.
 * Value is sanitized HTML (paragraphs + links). Plain text still loads and saves.
 */
export function AdminRichTextField({
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
  error,
  errorId,
  warning,
  invalid = false,
  issue,
  disabled = false,
  className,
  unitId,
  id,
}: AdminRichTextFieldProps) {
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
  const empty = isRichTextEmpty(value);

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
    const next = normalizeRichTextForStorage(draftValue);
    if (isControlled) {
      onChange?.(next);
    } else {
      setInternalValue(next);
      if (hiddenFieldRef.current) {
        hiddenFieldRef.current.value = next;
        hiddenFieldRef.current.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    setOpen(false);
  }

  return (
    <AdminFieldShell
      id={unitId}
      component="AdminRichTextField"
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
        data-slot="rich-text-preview"
        className={cn(
          "adm-long-text-preview",
          showError ? "adm-long-text-preview--error" : showWarning ? "adm-long-text-preview--warning" : null,
        )}
        aria-invalid={showError ? true : undefined}
        aria-errormessage={showError ? messageId : undefined}
        aria-describedby={!showError && warning ? warningId : undefined}
      >
        <div
          className={cn("adm-long-text-preview__copy", "adm-rich-text-preview__copy")}
          data-empty={empty ? "true" : undefined}
        >
          <RichText content={value} emptyFallback={placeholder} />
        </div>
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
            Add links so URLs are clickable. The form keeps a compact preview.
          </p>
        </div>
        {open ? (
          <RichTextModalEditor
            key={plainLabel}
            value={value}
            onChange={setDraftValue}
            label={plainLabel}
          />
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--adm-border)] pt-4">
          <span className="text-xs tabular-nums text-[var(--adm-subtle)]">
            {richTextPlainLength(draftValue).toLocaleString()} characters
          </span>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="adm-btn-ghost" onClick={closeEditor}>
              Cancel
            </button>
            <button type="button" className="adm-btn-primary" onClick={applyChanges}>
              Apply changes
            </button>
          </div>
        </div>
      </AnimatedModal>
    </AdminFieldShell>
  );
}
