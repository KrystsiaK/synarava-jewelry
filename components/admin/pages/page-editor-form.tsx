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
import { HomeSectionVisibilityEditor } from "@/components/admin/pages/home-section-visibility-editor";

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
    <div data-component="PageEditor" className="adm-panel grid gap-5 p-5 md:p-6">
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

        {isHomePage ? <HomeSectionVisibilityEditor content={content} /> : null}

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

        {isHomePage ? (
          <section className="grid gap-4 border-t border-[var(--adm-border)] pt-5" aria-labelledby="department-copy-heading">
            <div>
              <p id="department-copy-heading" className="adm-section-tag">HOME / DEPARTMENT PATHWAY</p>
              <p className="mt-2 text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
                This section stays hidden until it is enabled and both the English headline and description are filled.
                Department links and imagery come from the primary navigation collections.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="adm-label">Department headline (EN)</span>
                <input name="departmentSectionTitle" defaultValue={content.departmentSectionTitle ?? ""} className="adm-field" />
              </label>
              <label className="grid gap-2">
                <span className="adm-label">Department CTA label (EN)</span>
                <input name="departmentSectionCtaLabel" defaultValue={content.departmentSectionCtaLabel ?? ""} className="adm-field" />
              </label>
            </div>
            <label className="grid gap-2">
              <span className="adm-label">Department description (EN)</span>
              <textarea name="departmentSectionBody" defaultValue={content.departmentSectionBody ?? ""} rows={3} className="adm-field" />
            </label>
            <label className="grid gap-2">
              <span className="adm-label">Department image caption (EN)</span>
              <input name="departmentSectionImageCaption" defaultValue={content.departmentSectionImageCaption ?? ""} className="adm-field" />
            </label>
          </section>
        ) : null}

        {isHomePage ? (
          <section className="grid gap-4 border-t border-[var(--adm-border)] pt-5" aria-labelledby="collection-sections-heading">
            <div>
              <h3 id="collection-sections-heading" className="adm-title-sm">Collection-led sections</h3>
              <p className="mt-1 text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
                Images, names, and descriptions come from the first three published collections. These labels control the home-page presentation.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2">
                <span className="adm-label">Archive background label (EN)</span>
                <input name="archiveSectionLabel" defaultValue={content.archiveSectionLabel ?? ""} placeholder="Recorded" className="adm-field" />
              </label>
              <label className="grid gap-2">
                <span className="adm-label">Material eyebrow (EN)</span>
                <input name="materialSectionEyebrow" defaultValue={content.materialSectionEyebrow ?? ""} placeholder="Material glossary / scroll to turn" className="adm-field" />
              </label>
              <label className="grid gap-2">
                <span className="adm-label">Material section title (EN)</span>
                <input name="materialSectionTitle" defaultValue={content.materialSectionTitle ?? ""} placeholder="Lexicon" className="adm-field" />
              </label>
            </div>
          </section>
        ) : null}

        {isHomePage ? <h3 className="adm-title-sm border-t border-[var(--adm-border)] pt-5">Manifesto</h3> : null}
        <label className="grid gap-2">
          <span className="adm-label">{isHomePage ? "Manifesto quote" : isAboutPage ? "Movement section headline" : "Quote"}</span>
          <textarea name="quote" defaultValue={content.quote ?? ""} rows={4} className="adm-field" />
        </label>

        {isHomePage ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="adm-label">Manifesto label (EN)</span>
              <input name="manifestoSectionLabel" defaultValue={content.manifestoSectionLabel ?? ""} placeholder="A principle to keep" className="adm-field" />
            </label>
            <label className="grid gap-2">
              <span className="adm-label">Manifesto attribution (EN)</span>
              <input name="manifestoSectionAttribution" defaultValue={content.manifestoSectionAttribution ?? ""} placeholder="The Synarava Manifesto // Vol 1." className="adm-field" />
            </label>
          </div>
        ) : null}

        {isHomePage ? <h3 className="adm-title-sm border-t border-[var(--adm-border)] pt-5">Final call to action</h3> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="adm-label">{isHomePage ? "Final CTA headline" : isAboutPage ? "Manifesto headline" : "Secondary title"}</span>
            <input name="secondaryTitle" defaultValue={content.secondaryTitle ?? ""} className="adm-field" />
          </label>
          <label className="grid gap-2">
            <span className="adm-label">{isHomePage ? "Final CTA introduction" : isAboutPage ? "Manifesto copy" : "Secondary body"}</span>
            <textarea name="secondaryBody" defaultValue={content.secondaryBody ?? ""} rows={3} className="adm-field" />
          </label>
        </div>

        {isHomePage ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="adm-label">Final CTA label (EN)</span>
              <input name="finalCtaLabel" defaultValue={content.finalCtaLabel ?? content.ctaLabel ?? ""} className="adm-field" />
            </label>
            <label className="grid gap-2">
              <span className="adm-label">Final CTA href</span>
              <input name="finalCtaHref" defaultValue={content.finalCtaHref ?? content.ctaHref ?? ""} className="adm-field" />
            </label>
            <label className="grid gap-2">
              <span className="adm-label">Footer statement (EN)</span>
              <textarea name="finalFooterTitle" defaultValue={content.finalFooterTitle ?? ""} placeholder={"Objects shaped slowly,\nkept for a lifetime."} rows={2} className="adm-field" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="adm-label">Contact label (EN)</span>
                <input name="finalContactLabel" defaultValue={content.finalContactLabel ?? ""} placeholder="studio@synarava.com" className="adm-field" />
              </label>
              <label className="grid gap-2">
                <span className="adm-label">Contact email</span>
                <input name="finalContactEmail" type="email" defaultValue={content.finalContactEmail ?? ""} placeholder="studio@synarava.com" className="adm-field" />
              </label>
            </div>
          </div>
        ) : null}

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
          {isHomePage ? (
            <div className="grid gap-4 border border-[var(--adm-border)] p-4">
              <p className="adm-section-tag">DEPARTMENT PATHWAY / PT</p>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2"><span className="adm-label">Department headline (PT)</span><input name="ptDepartmentSectionTitle" defaultValue={ptContent.departmentSectionTitle ?? ""} className="adm-field" /></label>
                <label className="grid gap-2"><span className="adm-label">Department CTA label (PT)</span><input name="ptDepartmentSectionCtaLabel" defaultValue={ptContent.departmentSectionCtaLabel ?? ""} className="adm-field" /></label>
              </div>
              <label className="grid gap-2"><span className="adm-label">Department description (PT)</span><textarea name="ptDepartmentSectionBody" defaultValue={ptContent.departmentSectionBody ?? ""} rows={3} className="adm-field" /></label>
              <label className="grid gap-2"><span className="adm-label">Department image caption (PT)</span><input name="ptDepartmentSectionImageCaption" defaultValue={ptContent.departmentSectionImageCaption ?? ""} className="adm-field" /></label>
            </div>
          ) : null}
          {isHomePage ? (
            <div className="grid gap-4 border border-[var(--adm-border)] p-4">
              <p className="adm-section-tag">HOME SECTIONS / PT</p>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2"><span className="adm-label">Archive background label (PT)</span><input name="ptArchiveSectionLabel" defaultValue={ptContent.archiveSectionLabel ?? ""} className="adm-field" /></label>
                <label className="grid gap-2"><span className="adm-label">Material eyebrow (PT)</span><input name="ptMaterialSectionEyebrow" defaultValue={ptContent.materialSectionEyebrow ?? ""} className="adm-field" /></label>
                <label className="grid gap-2"><span className="adm-label">Material section title (PT)</span><input name="ptMaterialSectionTitle" defaultValue={ptContent.materialSectionTitle ?? ""} className="adm-field" /></label>
                <label className="grid gap-2"><span className="adm-label">Manifesto label (PT)</span><input name="ptManifestoSectionLabel" defaultValue={ptContent.manifestoSectionLabel ?? ""} className="adm-field" /></label>
                <label className="grid gap-2"><span className="adm-label">Manifesto attribution (PT)</span><input name="ptManifestoSectionAttribution" defaultValue={ptContent.manifestoSectionAttribution ?? ""} className="adm-field" /></label>
                <label className="grid gap-2"><span className="adm-label">Final CTA label (PT)</span><input name="ptFinalCtaLabel" defaultValue={ptContent.finalCtaLabel ?? ""} className="adm-field" /></label>
                <label className="grid gap-2"><span className="adm-label">Footer statement (PT)</span><textarea name="ptFinalFooterTitle" defaultValue={ptContent.finalFooterTitle ?? ""} rows={2} className="adm-field" /></label>
                <label className="grid gap-2"><span className="adm-label">Contact label (PT)</span><input name="ptFinalContactLabel" defaultValue={ptContent.finalContactLabel ?? ""} className="adm-field" /></label>
              </div>
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2"><span className="adm-label">Hero CTA label (PT)</span><input name="ptCtaLabel" defaultValue={ptContent.ctaLabel ?? ""} className="adm-field" /></label>
            <label className="grid gap-2"><span className="adm-label">Manifesto quote (PT)</span><textarea name="ptQuote" defaultValue={ptContent.quote ?? ""} rows={3} className="adm-field" /></label>
            <label className="grid gap-2"><span className="adm-label">Final CTA headline (PT)</span><input name="ptSecondaryTitle" defaultValue={ptContent.secondaryTitle ?? ""} className="adm-field" /></label>
            <label className="grid gap-2"><span className="adm-label">Final CTA introduction (PT)</span><textarea name="ptSecondaryBody" defaultValue={ptContent.secondaryBody ?? ""} rows={3} className="adm-field" /></label>
          </div>
        </section>

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
