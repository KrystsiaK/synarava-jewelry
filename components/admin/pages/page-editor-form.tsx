"use client";

import { useRef, useState, useTransition } from "react";

import {
  savePageAction,
  type PageActionState,
  type SavedPagePayload,
} from "@/app/admin/actions/pages";
import { AdminConfirmModal } from "@/components/admin/shared/admin-confirm-modal";
import { AdminHelp } from "@/components/admin/shared/admin-help";
import { ImageFileField } from "@/components/admin/shared/image-file-field";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { AuthMessage } from "@/components/auth/auth-form-primitives";
import { pageStatusLabel } from "@/components/admin/pages/page-helpers";
import type { EditablePageContent } from "@/components/admin/pages/page-types";

export function PageEditor({
  page,
  onUpdated,
}: {
  page: SavedPagePayload;
  onUpdated?: (page: SavedPagePayload) => void;
}) {
  const [state, setState] = useState<PageActionState>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const content = (page.content ?? {}) as EditablePageContent;
  const ptContent = content.translations?.pt ?? {};
  const isHomePage = page.slug === "home";
  const isAboutPage = page.slug === "about";
  const { pushToast } = useAdminToast();

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await savePageAction(formData);
      setState(result);
      setConfirmOpen(false);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (result.page) onUpdated?.(result.page);
    });
  }

  return (
    <div className="adm-panel grid gap-5 p-5 md:p-6">
      <form ref={formRef} action={formAction} className="grid gap-5">
        <input type="hidden" name="slug" value={page.slug} />

        <div
          className="flex flex-wrap items-start justify-between gap-4 pb-5"
          style={{ borderBottom: "1px solid var(--adm-border)" }}
        >
          <div>
            <p className="adm-section-tag">[ EDIT PAGE ]</p>
            <h2 className="adm-title-sm mt-2">{page.title}</h2>
            <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>
              /{page.slug}
            </p>
          </div>
          <button
            type="button"
            className="adm-btn-primary"
            disabled={isPending}
            onClick={() => setConfirmOpen(true)}
          >
            {isPending ? "Saving..." : "Save page"}
          </button>
        </div>

        <p className="adm-section-tag border-b border-[var(--adm-border)] pb-4">LOCALE / EN — SOURCE</p>
        <AuthMessage error={state.error} />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="adm-label">{isHomePage ? "Hero headline" : "Title"}</span>
            <input name="title" defaultValue={page.title} className="adm-field" />
          </label>
          <label className="grid gap-2">
            <span className="adm-label">Eyebrow</span>
            <input name="eyebrow" defaultValue={content.eyebrow ?? ""} className="adm-field" />
          </label>
        </div>

        <label className="grid gap-2">
          <span className="adm-label">{isHomePage ? "Search summary" : "Excerpt"}</span>
          <textarea name="excerpt" defaultValue={page.excerpt ?? ""} rows={3} className="adm-field" />
        </label>

        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <span className="adm-label">Hero image</span>
            <AdminHelp>Optional page-specific hero. It takes priority over the default visual or video, and is converted to optimized WebP on upload.</AdminHelp>
          </div>
          <ImageFileField
            name="heroImageFile"
            currentImageUrl={content.heroImage}
            currentImageAlt={`${page.title} hero`}
            currentImageLabel="Current hero image"
            previewAspect="video"
            removeFieldName="removeHeroImage"
          />
        </div>

        <label className="grid gap-2">
          <span className="adm-label">{isHomePage ? "Hero description" : isAboutPage ? "Studio introduction" : "Body"}</span>
          <textarea name="body" defaultValue={content.body ?? ""} rows={5} className="adm-field" />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="adm-label">CTA label</span>
            <input name="ctaLabel" defaultValue={content.ctaLabel ?? ""} className="adm-field" />
          </label>
          <label className="grid gap-2">
            <span className="adm-label">CTA href</span>
            <input name="ctaHref" defaultValue={content.ctaHref ?? ""} className="adm-field" />
          </label>
        </div>

        <section className="grid gap-4 border-t border-[var(--adm-border)] pt-5" aria-labelledby="pt-copy-heading">
          <div>
            <p id="pt-copy-heading" className="adm-section-tag">LOCALE / PT — PORTUGUÊS</p>
            <p className="mt-2 text-xs" style={{ color: "var(--adm-muted)" }}>
              Empty fields fall back to the English source on the storefront.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2"><span className="adm-label">Title (PT)</span><input name="ptTitle" defaultValue={ptContent.title ?? ""} className="adm-field" /></label>
            <label className="grid gap-2"><span className="adm-label">Eyebrow (PT)</span><input name="ptEyebrow" defaultValue={ptContent.eyebrow ?? ""} className="adm-field" /></label>
          </div>
          <label className="grid gap-2"><span className="adm-label">Excerpt (PT)</span><textarea name="ptExcerpt" defaultValue={ptContent.excerpt ?? ""} rows={3} className="adm-field" /></label>
          <label className="grid gap-2"><span className="adm-label">Body (PT)</span><textarea name="ptBody" defaultValue={ptContent.body ?? ""} rows={5} className="adm-field" /></label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2"><span className="adm-label">CTA label (PT)</span><input name="ptCtaLabel" defaultValue={ptContent.ctaLabel ?? ""} className="adm-field" /></label>
            <label className="grid gap-2"><span className="adm-label">Quote (PT)</span><textarea name="ptQuote" defaultValue={ptContent.quote ?? ""} rows={3} className="adm-field" /></label>
            <label className="grid gap-2"><span className="adm-label">Secondary title (PT)</span><input name="ptSecondaryTitle" defaultValue={ptContent.secondaryTitle ?? ""} className="adm-field" /></label>
            <label className="grid gap-2"><span className="adm-label">Secondary body (PT)</span><textarea name="ptSecondaryBody" defaultValue={ptContent.secondaryBody ?? ""} rows={3} className="adm-field" /></label>
          </div>
        </section>

        <label className="grid gap-2">
          <span className="adm-label">{isHomePage ? "Manifesto quote" : isAboutPage ? "Movement section headline" : "Quote"}</span>
          <textarea name="quote" defaultValue={content.quote ?? ""} rows={4} className="adm-field" />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="adm-label">{isHomePage ? "Final CTA headline" : isAboutPage ? "Manifesto headline" : "Secondary title"}</span>
            <input
              name="secondaryTitle"
              defaultValue={content.secondaryTitle ?? ""}
              className="adm-field"
            />
          </label>
          <label className="grid gap-2">
            <span className="adm-label">{isHomePage ? "Final CTA introduction" : isAboutPage ? "Manifesto copy" : "Secondary body"}</span>
            <textarea
              name="secondaryBody"
              defaultValue={content.secondaryBody ?? ""}
              rows={3}
              className="adm-field"
            />
          </label>
        </div>

        <label className="grid gap-2 md:max-w-xs">
          <span className="adm-label">Publishing state after save</span>
          <select
            name="workflowState"
            defaultValue={pageStatusLabel(page) === "PUBLISHED" ? "PUBLISHED" : "DRAFT"}
            className="adm-field"
          >
            <option value="DRAFT">Draft - hidden</option>
            <option value="PUBLISHED">Published - visible</option>
          </select>
        </label>

        <div
          className="flex justify-end pt-4"
          style={{ borderTop: "1px solid var(--adm-border)" }}
        >
          <button
            type="button"
            className="adm-btn-primary"
            disabled={isPending}
            onClick={() => setConfirmOpen(true)}
          >
            {isPending ? "Saving..." : "Save page"}
          </button>
        </div>
      </form>

      <AdminConfirmModal
        open={confirmOpen}
        title={`Save ${page.title}`}
        description="This writes page copy and publishing state to the database. Published pages may change the storefront immediately after revalidation."
        confirmLabel="Save page"
        pending={isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </div>
  );
}
