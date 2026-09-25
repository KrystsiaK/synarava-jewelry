"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Bold, Italic, Link2, List, ListOrdered, PencilLine, Unlink } from "lucide-react";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";

import {
  AdminFieldShell,
  useAdminFieldIds,
} from "@/components/admin/shared/admin-field-shell";
import type { AdminFieldOwner } from "@/components/admin/shared/ownership-label";
import { AdminHrefControl } from "@/components/admin/shared/admin-href-field";
import { RichText } from "@/components/content/rich-text";
import { AnimatedModal } from "@/components/ui/animated-modal";
import {
  isAllowedRichTextHref,
  isExternalHttpHref,
  isInternalHref,
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

function linkKindHint(href: string): string {
  const trimmed = href.trim();
  if (!trimmed) {
    return "Pick a storefront path or paste an https:// URL.";
  }
  if (isInternalHref(trimmed)) {
    return "Internal link — opens in the same tab.";
  }
  if (isExternalHttpHref(trimmed) || /^www\./i.test(trimmed)) {
    return "External link — opens in a new tab.";
  }
  if (/^mailto:/i.test(trimmed)) {
    return "Email link (mailto).";
  }
  return "Use /path for pages or https:// for remote sites.";
}

function RichTextLinkPanel({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const previous = (editor.getAttributes("link").href as string | undefined) ?? "";
  const [href, setHref] = useState(previous);
  const [error, setError] = useState("");
  const inputId = useId();

  function apply() {
    const next = href.trim();
    if (!next) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      onClose();
      return;
    }
    const sanitized = sanitizeHref(next);
    if (!sanitized) {
      setError("Use an in-app path (/shop), https:// URL, mailto:, or #anchor.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: sanitized }).run();
    onClose();
  }

  function remove() {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    onClose();
  }

  return (
    <div className="adm-rich-text-link-panel" role="dialog" aria-label="Insert link">
      <p className="adm-rich-text-link-panel__hint">{linkKindHint(href)}</p>
      <label className="adm-label" htmlFor={inputId}>
        Link target
      </label>
      <AdminHrefControl
        name="__rich_text_link_href"
        controlId={inputId}
        value={href}
        onValueChange={(next) => {
          setHref(next);
          setError("");
        }}
        placeholder="/shop or https://…"
        aria-label="Link target"
        invalid={Boolean(error)}
        aria-invalid={error ? true : undefined}
      />
      {error ? (
        <p className="adm-rich-text-link-panel__error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="adm-rich-text-link-panel__actions">
        <button type="button" className="adm-btn-ghost" onClick={onClose}>
          Cancel
        </button>
        {previous ? (
          <button type="button" className="adm-btn-ghost" onClick={remove}>
            Remove link
          </button>
        ) : null}
        <button type="button" className="adm-btn-primary" onClick={apply}>
          Apply link
        </button>
      </div>
    </div>
  );
}

function RichTextModalEditor({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (html: string) => void;
  label: string;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        // Lists stay on — legal bodies need bullets/numbers.
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          // Do not force target=_blank here — sanitizer decides per href
          // (internal same-tab, external new-tab). See sanitizeRichTextHtml.
          // @see https://tiptap.dev/docs/editor/extensions/marks/link
          HTMLAttributes: {},
          isAllowedUri: (url, ctx) => isAllowedRichTextHref(url, ctx.defaultValidate),
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

  function openLinkPanel() {
    if (!editor) return;
    setLinkOpen(true);
  }

  function removeLink() {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  }

  return (
    <div className="adm-rich-text-editor">
      <div className="adm-rich-text-editor__toolbar" role="toolbar" aria-label="Formatting">
        <button
          type="button"
          className="adm-rich-text-editor__tool"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          disabled={!editor}
          aria-pressed={editor?.isActive("bold") ?? false}
        >
          <Bold aria-hidden="true" className="size-3.5" />
          Bold
        </button>
        <button
          type="button"
          className="adm-rich-text-editor__tool"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          disabled={!editor}
          aria-pressed={editor?.isActive("italic") ?? false}
        >
          <Italic aria-hidden="true" className="size-3.5" />
          Italic
        </button>
        <button
          type="button"
          className="adm-rich-text-editor__tool"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          disabled={!editor}
          aria-pressed={editor?.isActive("bulletList") ?? false}
        >
          <List aria-hidden="true" className="size-3.5" />
          List
        </button>
        <button
          type="button"
          className="adm-rich-text-editor__tool"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          disabled={!editor}
          aria-pressed={editor?.isActive("orderedList") ?? false}
        >
          <ListOrdered aria-hidden="true" className="size-3.5" />
          Numbered
        </button>
        <button
          type="button"
          className="adm-rich-text-editor__tool"
          onClick={openLinkPanel}
          disabled={!editor}
          aria-pressed={linkOpen}
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
      {linkOpen && editor ? (
        <RichTextLinkPanel editor={editor} onClose={() => setLinkOpen(false)} />
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}

/**
 * Link-capable rich text: same preview + Edit modal chrome as AdminLongTextField.
 * Value is sanitized HTML (paragraphs + links). Plain text still loads and saves.
 * Links: in-app paths and hash anchors stay same-tab; http(s) open in a new tab.
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
            Format copy and add links to storefront paths or remote URLs. The form keeps a compact preview.
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
