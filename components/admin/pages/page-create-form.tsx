"use client";

import { useRef, useState, useTransition } from "react";

import {
  autosavePageDraftAction,
  savePageAction,
  type PageActionState,
  type SavedPagePayload,
} from "@/app/admin/actions/pages";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { useDraftAutosave } from "@/components/admin/shared/use-draft-autosave";
import { AuthMessage } from "@/components/auth/auth-form-primitives";

export function CreatePageForm({ onCreated }: { onCreated: (page: SavedPagePayload) => void }) {
  const [state, setState] = useState<PageActionState>({});
  const [isPending, startTransition] = useTransition();
  const [draftId, setDraftId] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const { pushToast } = useAdminToast();

  useDraftAutosave({
    formRef,
    saveDraft: autosavePageDraftAction,
    recordIdField: "pageId",
    onSaved: (result) => {
      if (result.recordId) setDraftId(result.recordId);
    },
  });

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await savePageAction(formData);
      setState(result);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (result.page) {
        onCreated(result.page);
        formRef.current?.reset();
      }
    });
  }

  return (
    <form data-component="CreatePageForm" ref={formRef} action={formAction} className="adm-panel grid gap-5 p-5 md:p-6">
      <input type="hidden" name="pageId" value={draftId} />
      <div
        className="flex flex-wrap items-start justify-between gap-4 pb-5"
        style={{ borderBottom: "1px solid var(--adm-border)" }}
      >
        <div>
          <p className="adm-section-tag">[ PAGE // NEW ]</p>
          <h2 className="adm-title-sm mt-2">Untitled page</h2>
          <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--adm-muted)" }}>
            New custom pages are published at <code>/{`slug`}</code>. Built-in routes stay
            protected from deletion.
          </p>
        </div>
        <button type="submit" disabled={isPending} className="adm-btn-primary">
          {isPending ? "Creating..." : "Create page"}
        </button>
      </div>

      <p className="adm-section-tag border-b border-[var(--adm-border)] pb-4">LOCALE / EN + PT</p>
      <AuthMessage error={state.error} />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="adm-label">Title</span>
          <input name="title" placeholder="Journal" className="adm-field" />
        </label>
        <label className="grid gap-2">
          <span className="adm-label">Slug</span>
          <input name="slug" placeholder="journal" className="adm-field" />
        </label>
        <label className="grid gap-2">
          <span className="adm-label">Eyebrow</span>
          <input name="eyebrow" placeholder="Editorial note" className="adm-field" />
        </label>
        <label className="grid gap-2">
          <span className="adm-label">Publishing state</span>
          <select name="workflowState" defaultValue="PUBLISHED" className="adm-field">
            <option value="DRAFT">Draft - hidden</option>
            <option value="PUBLISHED">Published - visible</option>
          </select>
        </label>
      </div>

      <section className="grid gap-4 border-t border-[var(--adm-border)] pt-5" aria-labelledby="new-pt-copy-heading">
        <div>
          <p id="new-pt-copy-heading" className="adm-section-tag">LOCALE / PT — PORTUGUÊS</p>
          <p className="mt-2 text-xs" style={{ color: "var(--adm-muted)" }}>Optional. Empty fields use the English source.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2"><span className="adm-label">Title (PT)</span><input name="ptTitle" className="adm-field" /></label>
          <label className="grid gap-2"><span className="adm-label">Eyebrow (PT)</span><input name="ptEyebrow" className="adm-field" /></label>
        </div>
        <label className="grid gap-2"><span className="adm-label">Excerpt (PT)</span><textarea name="ptExcerpt" rows={3} className="adm-field" /></label>
        <label className="grid gap-2"><span className="adm-label">Body (PT)</span><textarea name="ptBody" rows={5} className="adm-field" /></label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2"><span className="adm-label">CTA label (PT)</span><input name="ptCtaLabel" className="adm-field" /></label>
          <label className="grid gap-2"><span className="adm-label">Quote (PT)</span><textarea name="ptQuote" rows={3} className="adm-field" /></label>
          <label className="grid gap-2"><span className="adm-label">Secondary title (PT)</span><input name="ptSecondaryTitle" className="adm-field" /></label>
          <label className="grid gap-2"><span className="adm-label">Secondary body (PT)</span><textarea name="ptSecondaryBody" rows={3} className="adm-field" /></label>
        </div>
      </section>

      <label className="grid gap-2">
        <span className="adm-label">Excerpt</span>
        <textarea
          name="excerpt"
          rows={3}
          className="adm-field"
          placeholder="Short summary for the page intro and metadata."
        />
      </label>

      <label className="grid gap-2">
        <span className="adm-label">Body</span>
        <textarea name="body" rows={5} className="adm-field" placeholder="Main editorial body copy." />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="adm-label">CTA label</span>
          <input name="ctaLabel" placeholder="Shop all products" className="adm-field" />
        </label>
        <label className="grid gap-2">
          <span className="adm-label">CTA href</span>
          <input name="ctaHref" placeholder="/shop" className="adm-field" />
        </label>
      </div>

      <label className="grid gap-2">
        <span className="adm-label">Quote</span>
        <textarea
          name="quote"
          rows={4}
          className="adm-field"
          placeholder="Optional quote or highlighted statement."
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="adm-label">Secondary title</span>
          <input name="secondaryTitle" placeholder="Further reading" className="adm-field" />
        </label>
        <label className="grid gap-2">
          <span className="adm-label">Secondary body</span>
          <textarea
            name="secondaryBody"
            rows={3}
            className="adm-field"
            placeholder="Optional follow-up copy block."
          />
        </label>
      </div>
    </form>
  );
}
