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
import { AdminLocaleTabs, useAdminActiveLocale, type AdminLocaleTab } from "@/components/admin/shared/admin-locale-workspace";
import { adminLocaleFieldName } from "@/lib/i18n/admin-locale-fields";
import type { AdminTranslationLocale } from "@/lib/i18n/admin-translation-locales";
import { AuthMessage } from "@/components/auth/auth-form-primitives";

const SOURCE_LOCALE = "en";
const DEFAULT_TRANSLATION_LOCALES: AdminTranslationLocale[] = [{ code: "pt", label: "Português" }];

export function CreatePageForm({
  onCreated,
  translationLocales = DEFAULT_TRANSLATION_LOCALES,
}: {
  onCreated: (page: SavedPagePayload) => void;
  /** Every non-English locale to render a section for. Defaults to Portuguese only, matching every editor's behavior before the registry drove this. */
  translationLocales?: AdminTranslationLocale[];
}) {
  const [state, setState] = useState<PageActionState>({});
  const [isPending, startTransition] = useTransition();
  const [draftId, setDraftId] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const { pushToast } = useAdminToast();
  const tabs: AdminLocaleTab[] = [{ code: SOURCE_LOCALE, label: "English" }, ...translationLocales];
  const [activeLocale, selectLocale] = useAdminActiveLocale("page:new", tabs);

  useDraftAutosave({
    formRef,
    saveDraft: autosavePageDraftAction,
    onError: () => pushToast({ message: "Draft could not be saved. Please try again.", tone: "error" }),
    recordIdField: "pageId",
    onSaved: (result) => {
      if (result.recordId) setDraftId(result.recordId);
      if (result.error) pushToast({ message: result.error, tone: "error" });
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

      <AdminLocaleTabs active={activeLocale} onSelect={selectLocale} locales={tabs} />
      <AuthMessage error={state.error} />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2" hidden={activeLocale !== SOURCE_LOCALE}>
          <span className="adm-label">Title</span>
          <input name="title" placeholder="Lookbook" className="adm-field" />
        </label>
        <label className="grid gap-2">
          <span className="adm-label">Slug</span>
          <input name="slug" placeholder="lookbook" className="adm-field" />
        </label>
        <label className="grid gap-2" hidden={activeLocale !== SOURCE_LOCALE}>
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

      {translationLocales.map(({ code, label }) => {
        const fieldName = (key: string) => adminLocaleFieldName(code, key, SOURCE_LOCALE);
        return (
          <section
            key={code}
            role="tabpanel"
            aria-label={`${label} page copy`}
            hidden={activeLocale !== code}
            className="grid gap-4 border border-[var(--adm-border)] bg-[var(--adm-bg-soft)] p-4"
          >
            <div>
              <p className="adm-section-tag">[ {code.toUpperCase()} — {label.toUpperCase()} ]</p>
              <p className="mt-2 text-xs" style={{ color: "var(--adm-muted)" }}>Optional. Empty fields use the English source.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2"><span className="adm-label">Title ({code.toUpperCase()})</span><input name={fieldName("title")} className="adm-field" /></label>
              <label className="grid gap-2"><span className="adm-label">URL handle ({code.toUpperCase()}, optional)</span><input name={fieldName("handle")} className="adm-field" placeholder="diario" /></label>
              <label className="grid gap-2"><span className="adm-label">Eyebrow ({code.toUpperCase()})</span><input name={fieldName("eyebrow")} className="adm-field" /></label>
            </div>
            <label className="grid gap-2"><span className="adm-label">Excerpt ({code.toUpperCase()})</span><textarea name={fieldName("excerpt")} rows={3} className="adm-field" /></label>
            <label className="grid gap-2"><span className="adm-label">Body ({code.toUpperCase()})</span><textarea name={fieldName("body")} rows={5} className="adm-field" /></label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2"><span className="adm-label">CTA label ({code.toUpperCase()})</span><input name={fieldName("ctaLabel")} className="adm-field" /></label>
              <label className="grid gap-2"><span className="adm-label">Quote ({code.toUpperCase()})</span><textarea name={fieldName("quote")} rows={3} className="adm-field" /></label>
              <label className="grid gap-2"><span className="adm-label">Secondary title ({code.toUpperCase()})</span><input name={fieldName("secondaryTitle")} className="adm-field" /></label>
              <label className="grid gap-2"><span className="adm-label">Secondary body ({code.toUpperCase()})</span><textarea name={fieldName("secondaryBody")} rows={3} className="adm-field" /></label>
            </div>
          </section>
        );
      })}

      <label className="grid gap-2" hidden={activeLocale !== SOURCE_LOCALE}>
        <span className="adm-label">Excerpt</span>
        <textarea
          name="excerpt"
          rows={3}
          className="adm-field"
          placeholder="Short summary for the page intro and metadata."
        />
      </label>

      <label className="grid gap-2" hidden={activeLocale !== SOURCE_LOCALE}>
        <span className="adm-label">Body</span>
        <textarea name="body" rows={5} className="adm-field" placeholder="Main editorial body copy." />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2" hidden={activeLocale !== SOURCE_LOCALE}>
          <span className="adm-label">CTA label</span>
          <input name="ctaLabel" placeholder="Shop all products" className="adm-field" />
        </label>
        <label className="grid gap-2">
          <span className="adm-label">CTA href</span>
          <input name="ctaHref" placeholder="/shop" className="adm-field" />
        </label>
      </div>

      <label className="grid gap-2" hidden={activeLocale !== SOURCE_LOCALE}>
        <span className="adm-label">Quote</span>
        <textarea
          name="quote"
          rows={4}
          className="adm-field"
          placeholder="Optional quote or highlighted statement."
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2" hidden={activeLocale !== SOURCE_LOCALE}>
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
