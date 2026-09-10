"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { autosavePostDraftAction, savePostAction, type SavedPostPayload } from "@/app/admin/actions/posts";
import { ImageFileField } from "@/components/admin/shared/image-file-field";
import { useDraftAutosave } from "@/components/admin/shared/use-draft-autosave";
import { AuthMessage } from "@/components/auth/auth-form-primitives";

type ContentLocale = "EN" | "PT";

function translationFor(post: SavedPostPayload | undefined, locale: ContentLocale) {
  return post?.translations.find((translation) => translation.locale === locale);
}

function LocaleFields({ locale, post }: { locale: ContentLocale; post?: SavedPostPayload }) {
  const translation = translationFor(post, locale);
  const prefix = locale.toLowerCase();
  const language = locale === "EN" ? "English" : "Portuguese";

  return (
    <div className="grid gap-5">
      <label className="grid gap-2">
        <span className="adm-label">Title ({locale}) *</span>
        <input name={`${prefix}Title`} defaultValue={translation?.title ?? ""} className="adm-field" />
      </label>
      <label className="grid gap-2">
        <span className="adm-label">Excerpt ({locale}) *</span>
        <textarea name={`${prefix}Excerpt`} defaultValue={translation?.excerpt ?? ""} rows={3} className="adm-field" />
      </label>
      <label className="grid gap-2">
        <span className="adm-label">Body ({locale}) *</span>
        <textarea name={`${prefix}Body`} defaultValue={translation?.body ?? ""} rows={14} className="adm-field" />
      </label>
      <div className="grid gap-5 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="adm-label">SEO title ({locale})</span>
          <input name={`${prefix}SeoTitle`} defaultValue={translation?.seoTitle ?? ""} className="adm-field" />
        </label>
        <label className="grid gap-2">
          <span className="adm-label">SEO description ({locale})</span>
          <textarea name={`${prefix}SeoDescription`} defaultValue={translation?.seoDescription ?? ""} rows={2} className="adm-field" />
        </label>
      </div>
      <label className="flex items-start gap-3 border border-[var(--adm-border)] p-4">
        <input
          type="checkbox"
          name={`${prefix}Reviewed`}
          value="1"
          aria-label={`${language} copy reviewed`}
          defaultChecked={translation?.reviewStatus === "REVIEWED"}
          className="mt-0.5"
        />
        <span>
          <span className="block text-sm font-semibold" style={{ color: "var(--adm-ink)" }}>
            {language} copy reviewed
          </span>
          <span className="mt-1 block text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
            Publishing requires this language to be complete and reviewed.
          </span>
        </span>
      </label>
    </div>
  );
}

export function PostEditorForm({ post }: { post?: SavedPostPayload }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [draftId, setDraftId] = useState(post?.id ?? "");
  const [activeLocale, setActiveLocale] = useState<ContentLocale>("EN");
  const [state, setState] = useState<{ error?: string; success?: string }>({});
  const [isPending, startTransition] = useTransition();

  useDraftAutosave({
    formRef,
    saveDraft: autosavePostDraftAction,
    recordIdField: "postId",
    onSaved: (result) => {
      if (result.recordId) setDraftId(result.recordId);
    },
  });

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await savePostAction(formData);
      setState(result);
      if (result.post) {
        if (!post) router.push(`/admin/posts/${result.post.id}`);
        router.refresh();
      }
    });
  }

  return (
    <form ref={formRef} action={submit} className="grid gap-6">
      <input type="hidden" name="postId" value={draftId} />

      <section className="adm-panel p-5 md:p-7">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_15rem]">
          <label className="grid gap-2">
            <span className="adm-label">Slug *</span>
            <input name="slug" defaultValue={post?.slug ?? ""} placeholder="behind-the-piece" className="adm-field" />
          </label>
          <label className="grid gap-2">
            <span className="adm-label">Workflow state</span>
            <select name="workflowState" defaultValue={post?.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"} className="adm-field">
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </select>
          </label>
        </div>
        <div className="mt-5 border-t border-[var(--adm-border)] pt-5">
          <span className="adm-label mb-2 block">Cover image</span>
          <ImageFileField
            name="coverImageFile"
            currentImageUrl={post?.coverUrl}
            currentImageAlt={translationFor(post, "EN")?.title || "Post cover"}
            currentImageLabel="Current cover"
            previewAspect="video"
            removeFieldName="removeCover"
          />
        </div>
      </section>

      <section className="adm-panel p-5 md:p-7">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--adm-border)] pb-5" role="tablist" aria-label="Post language">
          {(["EN", "PT"] as const).map((locale) => (
            <button
              key={locale}
              type="button"
              role="tab"
              aria-selected={activeLocale === locale}
              aria-controls={`post-panel-${locale.toLowerCase()}`}
              className="adm-locale-tab"
              data-active={activeLocale === locale ? "true" : undefined}
              onClick={() => setActiveLocale(locale)}
            >
              {locale === "EN" ? "English" : "Português"}
            </button>
          ))}
          <span className="adm-section-tag ml-auto">BOTH REQUIRED TO PUBLISH</span>
        </div>

        {(["EN", "PT"] as const).map((locale) => (
          <div
            key={locale}
            id={`post-panel-${locale.toLowerCase()}`}
            role="tabpanel"
            hidden={activeLocale !== locale}
            className="pt-6"
          >
            <LocaleFields locale={locale} post={post} />
          </div>
        ))}
      </section>

      <AuthMessage error={state.error} success={state.success} />
      <div className="flex flex-wrap justify-end gap-2">
        {draftId ? (
          <>
            <Link href={`/admin/posts/${draftId}/preview?locale=en`} className="adm-btn-ghost">Preview EN</Link>
            <Link href={`/admin/posts/${draftId}/preview?locale=pt`} className="adm-btn-ghost">Preview PT</Link>
          </>
        ) : null}
        <button type="submit" className="adm-btn-primary" disabled={isPending}>
          {isPending ? "Saving…" : post ? "Save post" : "Create post"}
        </button>
      </div>
    </form>
  );
}
