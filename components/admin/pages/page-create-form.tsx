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
import { AdminLongTextField, AdminSelectField, AdminTextField } from "@/components/synarava-cms";
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
        <div hidden={activeLocale !== SOURCE_LOCALE}>
          <AdminTextField label="Title" name="title" placeholder="Lookbook" />
        </div>
        <AdminTextField label="Slug" name="slug" placeholder="lookbook" />
        <div hidden={activeLocale !== SOURCE_LOCALE}>
          <AdminTextField label="Eyebrow" name="eyebrow" placeholder="Editorial note" />
        </div>
        <AdminSelectField label="Publishing state" name="workflowState" defaultValue="PUBLISHED">
          <option value="DRAFT">Draft - hidden</option>
          <option value="PUBLISHED">Published - visible</option>
        </AdminSelectField>
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
              <AdminTextField label={`Title (${code.toUpperCase()})`} name={fieldName("title")} />
              <AdminTextField label={`URL handle (${code.toUpperCase()}, optional)`} name={fieldName("handle")} placeholder="diario" />
              <AdminTextField label={`Eyebrow (${code.toUpperCase()})`} name={fieldName("eyebrow")} />
            </div>
            <AdminLongTextField label={`Excerpt (${code.toUpperCase()})`} name={fieldName("excerpt")} rows={3} />
            <AdminLongTextField label={`Body (${code.toUpperCase()})`} name={fieldName("body")} rows={5} />
            <div className="grid gap-4">
              <AdminTextField label={`CTA label (${code.toUpperCase()})`} name={fieldName("ctaLabel")} />
              <AdminLongTextField label={`Quote (${code.toUpperCase()})`} name={fieldName("quote")} rows={3} />
              <AdminTextField label={`Secondary title (${code.toUpperCase()})`} name={fieldName("secondaryTitle")} />
              <AdminLongTextField label={`Secondary body (${code.toUpperCase()})`} name={fieldName("secondaryBody")} rows={3} />
            </div>
          </section>
        );
      })}

      <div hidden={activeLocale !== SOURCE_LOCALE}>
        <AdminLongTextField
          label="Excerpt"
          name="excerpt"
          rows={3}
          placeholder="Short summary for the page intro and metadata."
        />
      </div>

      <div hidden={activeLocale !== SOURCE_LOCALE}>
        <AdminLongTextField
          label="Body"
          name="body"
          rows={5}
          placeholder="Main editorial body copy."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div hidden={activeLocale !== SOURCE_LOCALE}>
          <AdminTextField label="CTA label" name="ctaLabel" placeholder="Shop all products" />
        </div>
        <AdminTextField label="CTA href" name="ctaHref" placeholder="/shop" />
      </div>

      <div hidden={activeLocale !== SOURCE_LOCALE}>
        <AdminLongTextField
          label="Quote"
          name="quote"
          rows={4}
          placeholder="Optional quote or highlighted statement."
        />
      </div>

      <div className="grid gap-4" hidden={activeLocale !== SOURCE_LOCALE}>
        <AdminTextField label="Secondary title" name="secondaryTitle" placeholder="Further reading" />
        <AdminLongTextField
          label="Secondary body"
          name="secondaryBody"
          rows={3}
          placeholder="Optional follow-up copy block."
        />
      </div>
    </form>
  );
}
