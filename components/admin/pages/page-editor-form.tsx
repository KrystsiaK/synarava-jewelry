"use client";

import { useRef, useState, useTransition } from "react";

import {
  savePageAction,
  type PageActionState,
  type SavedPagePayload,
} from "@/app/admin/actions/pages";
import { AdminConfirmModal } from "@/components/admin/shared/admin-confirm-modal";
import { AdminHelp } from "@/components/admin/shared/admin-help";
import { AdminSelectField } from "@/components/admin/shared/admin-select-field";
import { AdminTextField } from "@/components/admin/shared/admin-text-field";
import { ImageFileField } from "@/components/admin/shared/image-file-field";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { AuthMessage } from "@/components/auth/auth-form-primitives";
import { pageStatusLabel } from "@/components/admin/pages/page-helpers";
import { AdminLocaleTabs, useAdminActiveLocale, type AdminLocaleTab } from "@/components/admin/shared/admin-locale-workspace";
import { adminLocaleFieldName } from "@/lib/i18n/admin-locale-fields";
import type { AdminTranslationLocale } from "@/lib/i18n/admin-translation-locales";
import type { EditablePageContent, EditablePageCopy } from "@/components/admin/pages/page-types";
import { HomeSectionVisibilityEditor } from "@/components/admin/pages/home-section-visibility-editor";
import { OFFER_SECTIONS } from "@/lib/content/offer-defaults";
import { TERMS_SECTIONS } from "@/lib/content/terms-defaults";
import { PRIVACY_SECTIONS } from "@/lib/content/privacy-defaults";
import { LEGAL_NOTICE_SECTIONS } from "@/lib/content/legal-notice-defaults";
import { SERVICE_SECTIONS, type ServicePageSlug } from "@/lib/content/service-page-defaults";
import { isBuiltInPage } from "@/lib/content/built-in-pages";
import { DEFAULT_HOME_EDIT_PRODUCT_TITLES } from "@/lib/content/home-edit-section";

const SERVICE_PAGE_SLUGS = Object.keys(SERVICE_SECTIONS) as ServicePageSlug[];
const SOURCE_LOCALE = "en";
const DEFAULT_TRANSLATION_LOCALES: AdminTranslationLocale[] = [{ code: "pt", label: "Português" }];

export type HomeEditProductOption = {
  id: string;
  title: string;
  slug: string;
};

// One physical field per concept (Title, Body, Edit title, ...),
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
  archiveSectionLabel: string;
  editSectionEyebrow: string;
  editSectionTitle: string;
  editSectionBody: string;
  editSectionCtaLabel: string;
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
  serviceSections: Record<string, { title: string; body: string }>;
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
    archiveSectionLabel: copy.archiveSectionLabel ?? "",
    editSectionEyebrow: copy.editSectionEyebrow ?? "",
    editSectionTitle: copy.editSectionTitle ?? "",
    editSectionBody: copy.editSectionBody ?? "",
    editSectionCtaLabel: copy.editSectionCtaLabel ?? "",
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
    serviceSections: Object.fromEntries(
      Object.entries(copy.serviceSections ?? {}).map(([id, section]) => [id, { title: section.title ?? "", body: section.body ?? "" }]),
    ),
  };
}

function HiddenLocaleFields({
  draftByLocale,
  legalSectionIds,
  serviceSectionIds,
}: {
  draftByLocale: Record<string, PageLocaleDraft>;
  legalSectionIds: string[];
  serviceSectionIds: string[];
}) {
  return (
    <div hidden>
      {Object.keys(draftByLocale).flatMap((locale) => {
        const draft = draftByLocale[locale];
        const name = (key: string) => adminLocaleFieldName(locale, key, SOURCE_LOCALE);
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
          field("archiveSectionLabel", draft.archiveSectionLabel),
          field("editSectionEyebrow", draft.editSectionEyebrow),
          field("editSectionTitle", draft.editSectionTitle),
          field("editSectionBody", draft.editSectionBody),
          field("editSectionCtaLabel", draft.editSectionCtaLabel),
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
          ...serviceSectionIds.flatMap((id) => {
            const section = draft.serviceSections[id] ?? { title: "", body: "" };
            return [field(`service:${id}:title`, section.title), field(`service:${id}:body`, section.body)];
          }),
        ];
      })}
    </div>
  );
}

export function PageEditor({
  page,
  productOptions = [],
  onUpdated,
  translationLocales = DEFAULT_TRANSLATION_LOCALES,
}: {
  page: SavedPagePayload;
  productOptions?: HomeEditProductOption[];
  onUpdated?: (page: SavedPagePayload) => void;
  /** Every non-English locale to render a tab for. Defaults to Portuguese only, matching every editor's behavior before the registry drove this. */
  translationLocales?: AdminTranslationLocale[];
}) {
  const [state, setState] = useState<PageActionState>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const content = (page.content ?? {}) as EditablePageContent;
  function translationCopyFor(code: string): EditablePageCopy {
    const row = page.translations?.find((translation) => translation.locale === code);
    if (row) {
      return { ...(row.content as EditablePageCopy ?? {}), title: row.title, excerpt: row.excerpt ?? "" };
    }
    // The pre-PageTranslation-table content.translations.pt blob is a
    // Portuguese-only legacy fallback — no other locale ever had one.
    return code === "pt" ? content.translations?.pt ?? {} : {};
  }
  const isHomePage = page.slug === "home";
  const isAboutPage = page.slug === "about";
  const isOfferPage = page.slug === "offer";
  const isTermsPage = page.slug === "terms-and-conditions";
  const isPrivacyPage = page.slug === "privacy";
  const isLegalNoticePage = page.slug === "legal-notice";
  const isShopPage = page.slug === "shop";
  const isCollectionsPage = page.slug === "collections";
  const isServicePage = SERVICE_PAGE_SLUGS.includes(page.slug as ServicePageSlug);
  // Shop and the 4 service pages render Title as their on-page H1 too (like home/about
  // already do) — only Collections has literally no on-page CMS text to fall back on.
  const titleIsMetaOnly = isCollectionsPage;
  // Quote never renders on any of these three page kinds; CTA href likewise
  // (Shop's CTA always points to /collections — only its label is editable).
  const hideDeadCopyFields = isShopPage || isServicePage || isCollectionsPage;
  // Eyebrow/CTA label/Secondary title & body power Shop's "Browse the
  // Collections" callout at the bottom of /shop — dead only for Service and
  // Collections pages.
  const hideShopCalloutFields = isServicePage || isCollectionsPage;
  const legalSections = isOfferPage ? OFFER_SECTIONS : isTermsPage ? TERMS_SECTIONS : isPrivacyPage ? PRIVACY_SECTIONS.en : isLegalNoticePage ? LEGAL_NOTICE_SECTIONS : [];
  const serviceSections = isServicePage ? SERVICE_SECTIONS[page.slug as ServicePageSlug] : [];
  const { pushToast } = useAdminToast();
  const tabs: AdminLocaleTab[] = [{ code: SOURCE_LOCALE, label: "English" }, ...translationLocales];
  const [activeLocale, selectLocale] = useAdminActiveLocale(`page:${page.slug}`, tabs);
  const [draftByLocale, setDraftByLocale] = useState<Record<string, PageLocaleDraft>>(() => ({
    [SOURCE_LOCALE]: draftFromCopy({ ...content, title: page.title, excerpt: page.excerpt ?? "" }),
    ...Object.fromEntries(translationLocales.map(({ code }) => [code, draftFromCopy(translationCopyFor(code))])),
  }));
  const [handleByLocale, setHandleByLocale] = useState<Record<string, string>>(() =>
    Object.fromEntries(translationLocales.map(({ code }) =>
      [code, page.translations?.find((translation) => translation.locale === code)?.localizedHandle ?? ""],
    )),
  );
  const [editProductIds, setEditProductIds] = useState<string[]>(() => {
    if (content.editProductIds?.length) return [...content.editProductIds, "", "", "", ""].slice(0, 4);
    const approvedDefaults = DEFAULT_HOME_EDIT_PRODUCT_TITLES.map(
      (title) => productOptions.find((product) => product.title === title)?.id ?? "",
    );
    return approvedDefaults.every(Boolean) ? approvedDefaults : ["", "", "", ""];
  });
  const draft = draftByLocale[activeLocale];
  const isEn = activeLocale === SOURCE_LOCALE;
  const activeLabel = tabs.find((tab) => tab.code === activeLocale)?.label ?? activeLocale;

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

  function updateServiceSection(sectionId: string, key: "title" | "body", value: string) {
    setDraftByLocale((prev) => ({
      ...prev,
      [activeLocale]: {
        ...prev[activeLocale],
        serviceSections: {
          ...prev[activeLocale].serviceSections,
          [sectionId]: { ...(prev[activeLocale].serviceSections[sectionId] ?? { title: "", body: "" }), [key]: value },
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
        <HiddenLocaleFields
          draftByLocale={draftByLocale}
          legalSectionIds={legalSections.map((section) => section.id)}
          serviceSectionIds={serviceSections.map((section) => section.id)}
        />

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

        <AdminLocaleTabs
          active={activeLocale}
          onSelect={selectLocale}
          locales={tabs}
        />
        <AuthMessage error={state.error} />

        {isHomePage ? <HomeSectionVisibilityEditor key={page.updatedAt.toISOString()} content={content} /> : null}

        {!isEn && !isBuiltInPage(page.slug) ? (
          <AdminTextField
            label={`URL handle (${activeLabel}, optional)`}
            help={<AdminHelp label="URL handle guidance">Blank uses the English slug.</AdminHelp>}
            value={handleByLocale[activeLocale] ?? ""}
            onChange={(event) => setHandleByLocale((prev) => ({ ...prev, [activeLocale]: event.target.value }))}
            placeholder={page.slug}
          />
        ) : null}
        <div hidden>
          {translationLocales.map(({ code }) => (
            <input
              key={code}
              type="hidden"
              readOnly
              name={adminLocaleFieldName(code, "handle", SOURCE_LOCALE)}
              value={handleByLocale[code] ?? ""}
            />
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <AdminTextField
            label={isHomePage ? "Hero headline" : "Title"}
            help={
              titleIsMetaOnly ? (
                <AdminHelp>Browser tab title and search-engine result title. Not shown on the page itself.</AdminHelp>
              ) : isShopPage || isServicePage ? (
                <AdminHelp>The big H1 heading on /{page.slug} — also sets the browser tab title.</AdminHelp>
              ) : undefined
            }
            value={draft.title}
            onChange={(event) => updateField("title", event.target.value)}
          />
          <div hidden={!isServicePage && isCollectionsPage}>
            <AdminTextField
              label="Eyebrow"
              help={
                isServicePage ? (
                  <AdminHelp>Small label above the H1 on /{page.slug}.</AdminHelp>
                ) : isShopPage ? (
                  <AdminHelp>The small red label above the heading in the “Browse the Collections” callout at the bottom of /shop.</AdminHelp>
                ) : undefined
              }
              value={draft.eyebrow}
              onChange={(event) => updateField("eyebrow", event.target.value)}
            />
          </div>
        </div>

        <label className="grid gap-2">
          <span className="adm-label flex items-center gap-1.5">
            {isHomePage ? "Search summary" : "Excerpt"}
            {hideDeadCopyFields ? (
              <AdminHelp>Search-engine result description (meta description). Not shown on the page itself.</AdminHelp>
            ) : null}
          </span>
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

        <label className="grid gap-2" hidden={isCollectionsPage}>
          <span className="adm-label flex items-center gap-1.5">
            {isHomePage ? "Hero description" : isAboutPage ? "About introduction" : isShopPage ? "Hero description" : isServicePage ? "Intro" : "Body"}
            {isShopPage ? (
              <AdminHelp>The paragraph under the hero heading on /shop.</AdminHelp>
            ) : isServicePage ? (
              <AdminHelp>The paragraph under the heading on /{page.slug}, above the four sections below.</AdminHelp>
            ) : null}
          </span>
          <textarea value={draft.body} onChange={(event) => updateField("body", event.target.value)} rows={5} className="adm-field" />
        </label>

        {isServicePage ? (
          <section className="grid gap-4 border-t border-[var(--adm-border)] pt-5" aria-labelledby="service-sections-heading">
            <div>
              <h3 id="service-sections-heading" className="adm-title-sm">Page sections</h3>
              <p className="mt-1 text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
                These fixed sections render on /{page.slug} in this order. Leave a title or body empty to fall back to the shipped default text.
              </p>
            </div>
            {serviceSections.map((section, index) => {
              const value = draft.serviceSections[section.id];
              return (
                <div key={section.id} className="grid gap-4 border border-[var(--adm-border)] p-4">
                  <p className="adm-section-tag">SECTION {index + 1} — {section.label}</p>
                  <AdminTextField
                    label="Title"
                    value={value?.title ?? ""}
                    onChange={(event) => updateServiceSection(section.id, "title", event.target.value)}
                  />
                  <label className="grid gap-2">
                    <span className="adm-label">Body</span>
                    <textarea value={value?.body ?? ""} onChange={(event) => updateServiceSection(section.id, "body", event.target.value)} rows={3} className="adm-field" />
                  </label>
                </div>
              );
            })}
          </section>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2" hidden={hideShopCalloutFields}>
          <AdminTextField
            label={isShopPage ? "Primary button label" : "CTA label"}
            help={
              isShopPage ? (
                <AdminHelp>The button in the “Browse the Collections” callout at the bottom of /shop. Always links to /collections.</AdminHelp>
              ) : undefined
            }
            value={draft.ctaLabel}
            onChange={(event) => updateField("ctaLabel", event.target.value)}
          />
          <div hidden={isShopPage}>
            <AdminTextField
              label="CTA href"
              help={<AdminHelp>Shared across languages — a link target, not translated copy.</AdminHelp>}
              name="ctaHref"
              defaultValue={content.ctaHref ?? ""}
            />
          </div>
        </div>

        {isOfferPage || isTermsPage || isPrivacyPage || isLegalNoticePage ? (
          <section className="grid gap-4 border-t border-[var(--adm-border)] pt-5" aria-labelledby="legal-copy-heading">
            <div>
              <h3 id="legal-copy-heading" className="adm-title-sm">Legal document</h3>
              <p className="mt-1 text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
                Section order, numbering, and anchors are fixed and shared across languages. Saved legal
                document content is managed exclusively from Admin. Empty fields remain empty. Default
                content is used only when a new legal document is created. Body supports Markdown.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {isOfferPage || isTermsPage || isLegalNoticePage ? (
                <label className="grid gap-2 md:col-span-2">
                  <span className="adm-label">Intro paragraph</span>
                  <textarea value={draft.legalIntro} onChange={(event) => updateField("legalIntro", event.target.value)} rows={2} className="adm-field" />
                </label>
              ) : null}
              <AdminTextField
                label="Last updated"
                help={<AdminHelp>Shared across languages — a display date, not translated copy.</AdminHelp>}
                name="legalLastUpdated"
                defaultValue={content.legalLastUpdated ?? ""}
                placeholder="e.g. 1 June 2025"
              />
            </div>

            {legalSections.map((section) => {
              const value = draft.legalSections[section.id];
              return (
                <div key={section.id} className="grid gap-4 border border-[var(--adm-border)] p-4">
                  <p className="adm-section-tag">{section.label}</p>
                  <AdminTextField
                    label="Title"
                    value={value?.title ?? ""}
                    onChange={(event) => updateLegalSection(section.id, "title", event.target.value)}
                  />
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
              <AdminTextField
                label="Archive background label"
                value={draft.archiveSectionLabel}
                onChange={(event) => updateField("archiveSectionLabel", event.target.value)}
                placeholder="Recorded"
              />
              <AdminTextField
                label="The Edit eyebrow"
                value={draft.editSectionEyebrow}
                onChange={(event) => updateField("editSectionEyebrow", event.target.value)}
                placeholder="A few to start with"
              />
              <AdminTextField
                label="The Edit title"
                value={draft.editSectionTitle}
                onChange={(event) => updateField("editSectionTitle", event.target.value)}
                placeholder="The Edit"
              />
              <AdminTextField
                label="The Edit product CTA"
                value={draft.editSectionCtaLabel}
                onChange={(event) => updateField("editSectionCtaLabel", event.target.value)}
                placeholder="View piece"
              />
              <label className="grid gap-2 md:col-span-2">
                <span className="adm-label">The Edit description</span>
                <textarea value={draft.editSectionBody} onChange={(event) => updateField("editSectionBody", event.target.value)} rows={2} placeholder="Four pieces, four sides of Synarava." className="adm-field" />
              </label>
              <fieldset className="grid gap-3 md:col-span-2">
                <legend className="adm-label">The Edit products</legend>
                <p className="text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
                  Choose four different published products. Slot order matches the site from left to right.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {editProductIds.map((productId, index) => (
                    <AdminSelectField
                      key={index}
                      label={`Product ${index + 1}`}
                      name={`editProductId${index + 1}`}
                      value={productId}
                      onChange={(event) => setEditProductIds((current) => current.map((id, slot) => slot === index ? event.target.value : id))}
                    >
                      <option value="">Choose a product</option>
                      {productOptions.map((product) => (
                        <option
                          key={product.id}
                          value={product.id}
                          disabled={product.id !== productId && editProductIds.includes(product.id)}
                        >
                          {product.title} · /{product.slug}
                        </option>
                      ))}
                    </AdminSelectField>
                  ))}
                </div>
              </fieldset>
              <AdminTextField
                label="Material eyebrow"
                value={draft.materialSectionEyebrow}
                onChange={(event) => updateField("materialSectionEyebrow", event.target.value)}
                placeholder="Material glossary / scroll to turn"
              />
              <AdminTextField
                label="Material section title"
                value={draft.materialSectionTitle}
                onChange={(event) => updateField("materialSectionTitle", event.target.value)}
                placeholder="Lexicon"
              />
              <AdminTextField
                label="Material note label"
                value={draft.materialSectionNoteLabel}
                onChange={(event) => updateField("materialSectionNoteLabel", event.target.value)}
                placeholder="Material notes"
              />
            </div>

            {draft.materials.map((material, index) => (
              <div key={index} className="grid gap-4 border border-[var(--adm-border)] p-4">
                <p className="adm-section-tag">LEXICON MATERIAL {index + 1}</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <AdminTextField
                    label="Name"
                    value={material.name}
                    onChange={(event) => updateMaterial(index, "name", event.target.value)}
                  />
                  <AdminTextField
                    label="Category"
                    value={material.category}
                    onChange={(event) => updateMaterial(index, "category", event.target.value)}
                  />
                </div>
                <label className="grid gap-2">
                  <span className="adm-label">Description</span>
                  <textarea value={material.description} onChange={(event) => updateMaterial(index, "description", event.target.value)} rows={3} className="adm-field" />
                </label>
                <AdminTextField
                  label="Properties (comma-separated, up to 3)"
                  value={material.properties}
                  onChange={(event) => updateMaterial(index, "properties", event.target.value)}
                  placeholder="Recycled, Hypoallergenic, Handmade"
                />
                <label className="grid gap-2">
                  <span className="adm-label-row">
                    <span className="adm-label">Image</span>
                    <AdminHelp>Shared across languages.</AdminHelp>
                  </span>
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
        <label className="grid gap-2" hidden={hideDeadCopyFields}>
          <span className="adm-label">{isHomePage ? "Manifesto quote" : isAboutPage ? "Movement section headline" : "Quote"}</span>
          <textarea value={draft.quote} onChange={(event) => updateField("quote", event.target.value)} rows={4} className="adm-field" />
        </label>

        {isHomePage ? (
          <div className="grid gap-4 md:grid-cols-2">
            <AdminTextField
              label="Manifesto label"
              value={draft.manifestoSectionLabel}
              onChange={(event) => updateField("manifestoSectionLabel", event.target.value)}
              placeholder="A principle to keep"
            />
            <AdminTextField
              label="Manifesto attribution"
              value={draft.manifestoSectionAttribution}
              onChange={(event) => updateField("manifestoSectionAttribution", event.target.value)}
              placeholder="The Synarava Manifesto // Vol 1."
            />
          </div>
        ) : null}

        {isHomePage ? <h3 className="adm-title-sm border-t border-[var(--adm-border)] pt-5">Final call to action</h3> : null}
        <div className="grid gap-4 md:grid-cols-2" hidden={hideShopCalloutFields}>
          <AdminTextField
            label={isHomePage ? "Final CTA headline" : isAboutPage ? "Manifesto headline" : isShopPage ? "Collections callout heading" : "Secondary title"}
            help={
              isShopPage ? (
                <AdminHelp>The heading in the “Browse the Collections” callout at the bottom of /shop.</AdminHelp>
              ) : undefined
            }
            value={draft.secondaryTitle}
            onChange={(event) => updateField("secondaryTitle", event.target.value)}
          />
          <label className="grid gap-2">
            <span className="adm-label flex items-center gap-1.5">
              {isHomePage ? "Final CTA introduction" : isAboutPage ? "Manifesto copy" : isShopPage ? "Secondary link label" : "Secondary body"}
              {isShopPage ? <AdminHelp>The small link under the button (e.g. “About Synarava”). Always links to /about.</AdminHelp> : null}
            </span>
            <textarea value={draft.secondaryBody} onChange={(event) => updateField("secondaryBody", event.target.value)} rows={isShopPage ? 1 : 3} className="adm-field" />
          </label>
        </div>

        {isHomePage ? (
          <div className="grid gap-4 md:grid-cols-2">
            <AdminTextField
              label="Final CTA label"
              value={draft.finalCtaLabel}
              onChange={(event) => updateField("finalCtaLabel", event.target.value)}
            />
            <AdminTextField
              label="Final CTA href"
              help={<AdminHelp>Shared across languages.</AdminHelp>}
              name="finalCtaHref"
              defaultValue={content.finalCtaHref ?? content.ctaHref ?? ""}
            />
            <label className="grid gap-2">
              <span className="adm-label">Footer statement</span>
              <textarea value={draft.finalFooterTitle} onChange={(event) => updateField("finalFooterTitle", event.target.value)} placeholder={"Objects shaped slowly,\nkept for a lifetime."} rows={2} className="adm-field" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminTextField
                label="Contact label"
                value={draft.finalContactLabel}
                onChange={(event) => updateField("finalContactLabel", event.target.value)}
                placeholder="synarava.shop@gmail.com"
              />
              <AdminTextField
                label="Contact email"
                help={<AdminHelp>Shared across languages — an address, not translated copy.</AdminHelp>}
                name="finalContactEmail"
                type="email"
                defaultValue={content.finalContactEmail ?? ""}
                placeholder="synarava.shop@gmail.com"
              />
            </div>
          </div>
        ) : null}

        <AdminSelectField
          className="md:max-w-xs"
          label="Publishing state after save"
          name="workflowState"
          defaultValue={pageStatusLabel(page) === "PUBLISHED" ? "PUBLISHED" : "DRAFT"}
        >
          <option value="DRAFT">Draft - hidden</option>
          <option value="PUBLISHED">Published - visible</option>
        </AdminSelectField>

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
        description="This writes page copy and publishing state to the database. Published pages may change the site immediately after revalidation."
        confirmLabel="Save page"
        pending={isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </div>
  );
}
