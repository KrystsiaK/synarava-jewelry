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
import { AdminLocaleTabs, useAdminActiveLocale, type AdminLocale } from "@/components/admin/shared/admin-locale-workspace";
import type { EditablePageContent, EditablePageCopy } from "@/components/admin/pages/page-types";
import { HomeSectionVisibilityEditor } from "@/components/admin/pages/home-section-visibility-editor";
import { OFFER_SECTIONS } from "@/lib/content/offer-defaults";
import { PRIVACY_SECTIONS_EN } from "@/lib/content/privacy-defaults";
import { isBuiltInPage } from "@/lib/content/built-in-pages";

// One physical field per concept (Title, Body, Department headline, ...),
// not one copy per language: the field's *value* switches with the active
// locale tab, everything else about it (label, position, layout) stays put.
// Adding a third/fourth language later means adding a locale to this draft
// and to AdminLocaleTabs' locale list — it does not mean touching this JSX
// again. See tasks/plan.md and the 2026-09-19 conversation that asked for
// this instead of a duplicated-per-locale layout.
type MaterialDraft = { name: string; category: string; description: string; properties: string };

type PageLocaleDraft = {
  title: string;
  eyebrow: string;
  excerpt: string;
  body: string;
  ctaLabel: string;
  quote: string;
  secondaryTitle: string;
  secondaryBody: string;
  departmentSectionTitle: string;
  departmentSectionBody: string;
  departmentSectionImageCaption: string;
  departmentSectionCtaLabel: string;
  archiveSectionLabel: string;
  materialSectionEyebrow: string;
  materialSectionTitle: string;
  materialSectionNoteLabel: string;
  materials: [MaterialDraft, MaterialDraft, MaterialDraft];
  manifestoSectionLabel: string;
  manifestoSectionAttribution: string;
  finalCtaLabel: string;
  finalFooterTitle: string;
  finalContactLabel: string;
  legalIntro: string;
  legalSections: Record<string, { title: string; body: string }>;
};

const emptyMaterial = (): MaterialDraft => ({ name: "", category: "", description: "", properties: "" });

function draftFromCopy(copy: EditablePageCopy): PageLocaleDraft {
  return {
    title: copy.title ?? "",
    eyebrow: copy.eyebrow ?? "",
    excerpt: copy.excerpt ?? "",
    body: copy.body ?? "",
    ctaLabel: copy.ctaLabel ?? "",
    quote: copy.quote ?? "",
    secondaryTitle: copy.secondaryTitle ?? "",
    secondaryBody: copy.secondaryBody ?? "",
    departmentSectionTitle: copy.departmentSectionTitle ?? "",
    departmentSectionBody: copy.departmentSectionBody ?? "",
    departmentSectionImageCaption: copy.departmentSectionImageCaption ?? "",
    departmentSectionCtaLabel: copy.departmentSectionCtaLabel ?? "",
    archiveSectionLabel: copy.archiveSectionLabel ?? "",
    materialSectionEyebrow: copy.materialSectionEyebrow ?? "",
    materialSectionTitle: copy.materialSectionTitle ?? "",
    materialSectionNoteLabel: copy.materialSectionNoteLabel ?? "",
    materials: [0, 1, 2].map((index): MaterialDraft => {
      const source = copy.materialLexicon?.[index];
      return source
        ? { name: source.name ?? "", category: source.category ?? "", description: source.description ?? "", properties: source.properties ?? "" }
        : emptyMaterial();
    }) as [MaterialDraft, MaterialDraft, MaterialDraft],
    manifestoSectionLabel: copy.manifestoSectionLabel ?? "",
    manifestoSectionAttribution: copy.manifestoSectionAttribution ?? "",
    finalCtaLabel: copy.finalCtaLabel ?? "",
    finalFooterTitle: copy.finalFooterTitle ?? "",
    finalContactLabel: copy.finalContactLabel ?? "",
    legalIntro: copy.legalIntro ?? "",
    legalSections: Object.fromEntries(
      Object.entries(copy.legalSections ?? {}).map(([id, section]) => [id, { title: section.title ?? "", body: section.body ?? "" }]),
    ),
  };
}

/**
 * Maps a locale + field key to the exact FormData field name savePageAction
 * already reads: EN uses the bare key, every other locale prefixes it and
 * capitalizes ("title" -> "ptTitle", "legal:x:title" -> "ptLegal:x:title").
 * Adding a locale later just needs the server action to read its prefix —
 * this function doesn't change.
 */
function localizedFieldName(locale: AdminLocale, key: string): string {
  if (locale === "EN") return key;
  return `${locale.toLowerCase()}${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

function HiddenLocaleFields({
  draftByLocale,
  legalSectionIds,
}: {
  draftByLocale: Record<AdminLocale, PageLocaleDraft>;
  legalSectionIds: string[];
}) {
  return (
    <div hidden>
      {(Object.keys(draftByLocale) as AdminLocale[]).flatMap((locale) => {
        const draft = draftByLocale[locale];
        const name = (key: string) => localizedFieldName(locale, key);
        const field = (key: string, value: string) => <input key={name(key)} type="hidden" name={name(key)} value={value} readOnly />;
        return [
          field("title", draft.title),
          field("eyebrow", draft.eyebrow),
          field("excerpt", draft.excerpt),
          field("body", draft.body),
          field("ctaLabel", draft.ctaLabel),
          field("quote", draft.quote),
          field("secondaryTitle", draft.secondaryTitle),
          field("secondaryBody", draft.secondaryBody),
          field("departmentSectionTitle", draft.departmentSectionTitle),
          field("departmentSectionBody", draft.departmentSectionBody),
          field("departmentSectionImageCaption", draft.departmentSectionImageCaption),
          field("departmentSectionCtaLabel", draft.departmentSectionCtaLabel),
          field("archiveSectionLabel", draft.archiveSectionLabel),
          field("materialSectionEyebrow", draft.materialSectionEyebrow),
          field("materialSectionTitle", draft.materialSectionTitle),
          field("materialSectionNoteLabel", draft.materialSectionNoteLabel),
          field("manifestoSectionLabel", draft.manifestoSectionLabel),
          field("manifestoSectionAttribution", draft.manifestoSectionAttribution),
          field("finalCtaLabel", draft.finalCtaLabel),
          field("finalFooterTitle", draft.finalFooterTitle),
          field("finalContactLabel", draft.finalContactLabel),
          field("legalIntro", draft.legalIntro),
          ...draft.materials.flatMap((material, index) => [
            field(`material${index + 1}Name`, material.name),
            field(`material${index + 1}Category`, material.category),
            field(`material${index + 1}Description`, material.description),
            field(`material${index + 1}Properties`, material.properties),
          ]),
          ...legalSectionIds.flatMap((id) => {
            const section = draft.legalSections[id] ?? { title: "", body: "" };
            return [field(`legal:${id}:title`, section.title), field(`legal:${id}:body`, section.body)];
          }),
        ];
      })}
    </div>
  );
}

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
  const normalizedPortuguese = page.translations?.find((translation) => translation.locale === "PT");
  const ptContent: EditablePageCopy = normalizedPortuguese
    ? { ...(normalizedPortuguese.content as EditablePageCopy ?? {}), title: normalizedPortuguese.title, excerpt: normalizedPortuguese.excerpt ?? "" }
    : content.translations?.pt ?? {};
  const isHomePage = page.slug === "home";
  const isAboutPage = page.slug === "about";
  const isOfferPage = page.slug === "offer";
  const isPrivacyPage = page.slug === "privacy";
  const legalSections = isOfferPage ? OFFER_SECTIONS : isPrivacyPage ? PRIVACY_SECTIONS_EN : [];
  const { pushToast } = useAdminToast();
  const [activeLocale, selectLocale] = useAdminActiveLocale(`page:${page.slug}`, "EN");
  const [draftByLocale, setDraftByLocale] = useState<Record<AdminLocale, PageLocaleDraft>>(() => ({
    EN: draftFromCopy({ ...content, title: page.title, excerpt: page.excerpt ?? "" }),
    PT: draftFromCopy(ptContent),
  }));
  const draft = draftByLocale[activeLocale];

  function updateField<K extends keyof PageLocaleDraft>(key: K, value: PageLocaleDraft[K]) {
    setDraftByLocale((prev) => ({ ...prev, [activeLocale]: { ...prev[activeLocale], [key]: value } }));
  }

  function updateMaterial(index: number, key: keyof MaterialDraft, value: string) {
    setDraftByLocale((prev) => {
      const materials = [...prev[activeLocale].materials] as [MaterialDraft, MaterialDraft, MaterialDraft];
      materials[index] = { ...materials[index], [key]: value };
      return { ...prev, [activeLocale]: { ...prev[activeLocale], materials } };
    });
  }

  function updateLegalSection(sectionId: string, key: "title" | "body", value: string) {
    setDraftByLocale((prev) => ({
      ...prev,
      [activeLocale]: {
        ...prev[activeLocale],
        legalSections: {
          ...prev[activeLocale].legalSections,
          [sectionId]: { ...(prev[activeLocale].legalSections[sectionId] ?? { title: "", body: "" }), [key]: value },
        },
      },
    }));
  }

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
        <HiddenLocaleFields draftByLocale={draftByLocale} legalSectionIds={legalSections.map((section) => section.id)} />

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

        <AdminLocaleTabs active={activeLocale} onSelect={selectLocale} />
        <AuthMessage error={state.error} />

        {isHomePage ? <HomeSectionVisibilityEditor content={content} /> : null}

        <label className="grid gap-2" hidden={activeLocale === "EN" || isBuiltInPage(page.slug)}>
          <span className="adm-label">URL handle ({activeLocale}, optional)</span>
          <input name="ptHandle" defaultValue={normalizedPortuguese?.localizedHandle ?? ""} className="adm-field" placeholder={page.slug} />
          <span className="text-xs" style={{ color: "var(--adm-muted)" }}>Blank uses the English slug.</span>
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="adm-label">{isHomePage ? "Hero headline" : "Title"}</span>
            <input value={draft.title} onChange={(event) => updateField("title", event.target.value)} className="adm-field" />
          </label>
          <label className="grid gap-2">
            <span className="adm-label">Eyebrow</span>
            <input value={draft.eyebrow} onChange={(event) => updateField("eyebrow", event.target.value)} className="adm-field" />
          </label>
        </div>

        <label className="grid gap-2">
          <span className="adm-label">{isHomePage ? "Search summary" : "Excerpt"}</span>
          <textarea value={draft.excerpt} onChange={(event) => updateField("excerpt", event.target.value)} rows={3} className="adm-field" />
        </label>

        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <span className="adm-label">Hero image</span>
            <AdminHelp>Optional page-specific hero, shared across languages. Built-in pages show a neutral header when this is empty; uploaded images are converted to optimized WebP.</AdminHelp>
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
          <textarea value={draft.body} onChange={(event) => updateField("body", event.target.value)} rows={5} className="adm-field" />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="adm-label">CTA label</span>
            <input value={draft.ctaLabel} onChange={(event) => updateField("ctaLabel", event.target.value)} className="adm-field" />
          </label>
          <label className="grid gap-2">
            <span className="adm-label">CTA href</span>
            <AdminHelp>Shared across languages — a link target, not translated copy.</AdminHelp>
            <input name="ctaHref" defaultValue={content.ctaHref ?? ""} className="adm-field" />
          </label>
        </div>

        {isOfferPage || isPrivacyPage ? (
          <section className="grid gap-4 border-t border-[var(--adm-border)] pt-5" aria-labelledby="legal-copy-heading">
            <div>
              <h3 id="legal-copy-heading" className="adm-title-sm">Legal document</h3>
              <p className="mt-1 text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
                Section order, numbering, and anchors are fixed and shared across languages. Leave a title or
                body empty to fall back to the shipped default text. Body supports Markdown.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {isOfferPage ? (
                <label className="grid gap-2 md:col-span-2">
                  <span className="adm-label">Intro paragraph</span>
                  <textarea value={draft.legalIntro} onChange={(event) => updateField("legalIntro", event.target.value)} rows={2} className="adm-field" />
                </label>
              ) : null}
              <label className="grid gap-2">
                <span className="adm-label">Last updated</span>
                <AdminHelp>Shared across languages — a display date, not translated copy.</AdminHelp>
                <input name="legalLastUpdated" defaultValue={content.legalLastUpdated ?? ""} placeholder="e.g. 1 June 2025" className="adm-field" />
              </label>
            </div>

            {legalSections.map((section) => {
              const value = draft.legalSections[section.id];
              return (
                <div key={section.id} className="grid gap-4 border border-[var(--adm-border)] p-4">
                  <p className="adm-section-tag">{section.label}</p>
                  <label className="grid gap-2">
                    <span className="adm-label">Title</span>
                    <input value={value?.title ?? ""} onChange={(event) => updateLegalSection(section.id, "title", event.target.value)} className="adm-field" />
                  </label>
                  <label className="grid gap-2">
                    <span className="adm-label">Body (Markdown)</span>
                    <textarea value={value?.body ?? ""} onChange={(event) => updateLegalSection(section.id, "body", event.target.value)} rows={6} className="adm-field font-mono text-xs" />
                  </label>
                </div>
              );
            })}
          </section>
        ) : null}

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
                <span className="adm-label">Department headline</span>
                <input value={draft.departmentSectionTitle} onChange={(event) => updateField("departmentSectionTitle", event.target.value)} className="adm-field" />
              </label>
              <label className="grid gap-2">
                <span className="adm-label">Department CTA label</span>
                <input value={draft.departmentSectionCtaLabel} onChange={(event) => updateField("departmentSectionCtaLabel", event.target.value)} className="adm-field" />
              </label>
            </div>
            <label className="grid gap-2">
              <span className="adm-label">Department description</span>
              <textarea value={draft.departmentSectionBody} onChange={(event) => updateField("departmentSectionBody", event.target.value)} rows={3} className="adm-field" />
            </label>
            <label className="grid gap-2">
              <span className="adm-label">Department image caption</span>
              <input value={draft.departmentSectionImageCaption} onChange={(event) => updateField("departmentSectionImageCaption", event.target.value)} className="adm-field" />
            </label>
          </section>
        ) : null}

        {isHomePage ? (
          <section className="grid gap-4 border-t border-[var(--adm-border)] pt-5" aria-labelledby="collection-sections-heading">
            <div>
              <h3 id="collection-sections-heading" className="adm-title-sm">Collection-led sections</h3>
              <p className="mt-1 text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
                The archive background label reuses the first three published collections. Lexicon materials below are
                edited directly here — leave a material blank to fall back to the first three collections instead.
                Images are shared across languages.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="adm-label">Archive background label</span>
                <input value={draft.archiveSectionLabel} onChange={(event) => updateField("archiveSectionLabel", event.target.value)} placeholder="Recorded" className="adm-field" />
              </label>
              <label className="grid gap-2">
                <span className="adm-label">Material eyebrow</span>
                <input value={draft.materialSectionEyebrow} onChange={(event) => updateField("materialSectionEyebrow", event.target.value)} placeholder="Material glossary / scroll to turn" className="adm-field" />
              </label>
              <label className="grid gap-2">
                <span className="adm-label">Material section title</span>
                <input value={draft.materialSectionTitle} onChange={(event) => updateField("materialSectionTitle", event.target.value)} placeholder="Lexicon" className="adm-field" />
              </label>
              <label className="grid gap-2">
                <span className="adm-label">Material note label</span>
                <input value={draft.materialSectionNoteLabel} onChange={(event) => updateField("materialSectionNoteLabel", event.target.value)} placeholder="Material notes" className="adm-field" />
              </label>
            </div>

            {draft.materials.map((material, index) => (
              <div key={index} className="grid gap-4 border border-[var(--adm-border)] p-4">
                <p className="adm-section-tag">LEXICON MATERIAL {index + 1}</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="adm-label">Name</span>
                    <input value={material.name} onChange={(event) => updateMaterial(index, "name", event.target.value)} className="adm-field" />
                  </label>
                  <label className="grid gap-2">
                    <span className="adm-label">Category</span>
                    <input value={material.category} onChange={(event) => updateMaterial(index, "category", event.target.value)} className="adm-field" />
                  </label>
                </div>
                <label className="grid gap-2">
                  <span className="adm-label">Description</span>
                  <textarea value={material.description} onChange={(event) => updateMaterial(index, "description", event.target.value)} rows={3} className="adm-field" />
                </label>
                <label className="grid gap-2">
                  <span className="adm-label">Properties (comma-separated, up to 3)</span>
                  <input value={material.properties} onChange={(event) => updateMaterial(index, "properties", event.target.value)} placeholder="Recycled, Hypoallergenic, Handmade" className="adm-field" />
                </label>
                <label className="grid gap-2">
                  <span className="adm-label">Image</span>
                  <AdminHelp>Shared across languages.</AdminHelp>
                  <ImageFileField
                    name={`material${index + 1}ImageFile`}
                    currentImageUrl={content.materialLexicon?.[index]?.image}
                    currentImageAlt={material.name || `Material ${index + 1}`}
                    currentImageLabel="Current image"
                    removeFieldName={`removeMaterial${index + 1}Image`}
                  />
                </label>
              </div>
            ))}
          </section>
        ) : null}

        {isHomePage ? <h3 className="adm-title-sm border-t border-[var(--adm-border)] pt-5">Manifesto</h3> : null}
        <label className="grid gap-2">
          <span className="adm-label">{isHomePage ? "Manifesto quote" : isAboutPage ? "Movement section headline" : "Quote"}</span>
          <textarea value={draft.quote} onChange={(event) => updateField("quote", event.target.value)} rows={4} className="adm-field" />
        </label>

        {isHomePage ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="adm-label">Manifesto label</span>
              <input value={draft.manifestoSectionLabel} onChange={(event) => updateField("manifestoSectionLabel", event.target.value)} placeholder="A principle to keep" className="adm-field" />
            </label>
            <label className="grid gap-2">
              <span className="adm-label">Manifesto attribution</span>
              <input value={draft.manifestoSectionAttribution} onChange={(event) => updateField("manifestoSectionAttribution", event.target.value)} placeholder="The Synarava Manifesto // Vol 1." className="adm-field" />
            </label>
          </div>
        ) : null}

        {isHomePage ? <h3 className="adm-title-sm border-t border-[var(--adm-border)] pt-5">Final call to action</h3> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="adm-label">{isHomePage ? "Final CTA headline" : isAboutPage ? "Manifesto headline" : "Secondary title"}</span>
            <input value={draft.secondaryTitle} onChange={(event) => updateField("secondaryTitle", event.target.value)} className="adm-field" />
          </label>
          <label className="grid gap-2">
            <span className="adm-label">{isHomePage ? "Final CTA introduction" : isAboutPage ? "Manifesto copy" : "Secondary body"}</span>
            <textarea value={draft.secondaryBody} onChange={(event) => updateField("secondaryBody", event.target.value)} rows={3} className="adm-field" />
          </label>
        </div>

        {isHomePage ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="adm-label">Final CTA label</span>
              <input value={draft.finalCtaLabel} onChange={(event) => updateField("finalCtaLabel", event.target.value)} className="adm-field" />
            </label>
            <label className="grid gap-2">
              <span className="adm-label">Final CTA href</span>
              <AdminHelp>Shared across languages.</AdminHelp>
              <input name="finalCtaHref" defaultValue={content.finalCtaHref ?? content.ctaHref ?? ""} className="adm-field" />
            </label>
            <label className="grid gap-2">
              <span className="adm-label">Footer statement</span>
              <textarea value={draft.finalFooterTitle} onChange={(event) => updateField("finalFooterTitle", event.target.value)} placeholder={"Objects shaped slowly,\nkept for a lifetime."} rows={2} className="adm-field" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="adm-label">Contact label</span>
                <input value={draft.finalContactLabel} onChange={(event) => updateField("finalContactLabel", event.target.value)} placeholder="studio@synarava.com" className="adm-field" />
              </label>
              <label className="grid gap-2">
                <span className="adm-label">Contact email</span>
                <AdminHelp>Shared across languages — an address, not translated copy.</AdminHelp>
                <input name="finalContactEmail" type="email" defaultValue={content.finalContactEmail ?? ""} placeholder="studio@synarava.com" className="adm-field" />
              </label>
            </div>
          </div>
        ) : null}

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
