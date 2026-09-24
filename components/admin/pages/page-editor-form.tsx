"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import {
  savePageAction,
  type PageActionState,
  type SavedPagePayload,
} from "@/app/admin/actions/pages";
import { AdminConfirmModal } from "@/components/admin/shared/admin-confirm-modal";
import { ImageFileField } from "@/components/admin/shared/image-file-field";
import { useAdminFormValidation } from "@/components/admin/shared/admin-form-validation";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { AuthMessage } from "@/components/auth/auth-form-primitives";
import { pageStatusLabel } from "@/components/admin/pages/page-helpers";
import { AdminLocaleTabs, useAdminActiveLocale, type AdminLocaleTab } from "@/components/admin/shared/admin-locale-workspace";
import {
  AdminHelp,
  AdminHrefField,
  AdminListWorkspace,
  AdminLongTextField,
  AdminSelectField,
  AdminTextField,
} from "@/components/synarava-cms";
import { isValidOptionalEmail, OPTIONAL_EMAIL_ERROR } from "@/lib/admin/optional-email";
import { adminLocaleFieldName } from "@/lib/i18n/admin-locale-fields";
import type { AdminTranslationLocale } from "@/lib/i18n/admin-translation-locales";
import type { EditablePageContent, EditablePageCopy } from "@/components/admin/pages/page-types";
import { HomePageEditorSections, type HomeArchiveCollectionOption, type HomeEditProductOption, type HomePageEditorSectionsProps, type MaterialDraft } from "@/components/admin/pages/home-page-editor-sections";
import { OFFER_SECTIONS } from "@/lib/content/offer-defaults";
import { TERMS_SECTIONS } from "@/lib/content/terms-defaults";
import { PRIVACY_SECTIONS } from "@/lib/content/privacy-defaults";
import { LEGAL_NOTICE_SECTIONS } from "@/lib/content/legal-notice-defaults";
import { SERVICE_SECTIONS, type ServicePageSlug } from "@/lib/content/service-page-defaults";
import { isBuiltInPage } from "@/lib/content/built-in-pages";
import { DEFAULT_HOME_EDIT_PRODUCT_TITLES } from "@/lib/content/home-edit-section";
import {
  MAX_HOME_LEXICON_MATERIALS,
  MIN_HOME_LEXICON_MATERIALS,
} from "@/lib/content/home-lexicon-section";

export type { HomeArchiveCollectionOption, HomeEditProductOption } from "@/components/admin/pages/home-page-editor-sections";

const SERVICE_PAGE_SLUGS = Object.keys(SERVICE_SECTIONS) as ServicePageSlug[];
const SOURCE_LOCALE = "en";
const DEFAULT_TRANSLATION_LOCALES: AdminTranslationLocale[] = [{ code: "pt", label: "Português" }];

// One physical field per concept (Title, Body, Edit title, ...),
// not one copy per language: the field's *value* switches with the active
// locale tab, everything else about it (label, position, layout) stays put.
// Adding a third/fourth language later means adding a locale to this draft
// and to AdminLocaleTabs' locale list — it does not mean touching this JSX
// again. See tasks/plan.md and the 2026-09-19 conversation that asked for
// this instead of a duplicated-per-locale layout.
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
  editSectionViewAllLabel: string;
  materialSectionEyebrow: string;
  materialSectionTitle: string;
  materialSectionNoteLabel: string;
  materials: MaterialDraft[];
  manifestoSectionLabel: string;
  manifestoSectionAttribution: string;
  finalCtaLabel: string;
  finalFooterTitle: string;
  finalContactLabel: string;
  legalIntro: string;
  legalSections: Record<string, { title: string; body: string }>;
  serviceSections: Record<string, { title: string; body: string }>;
};

let materialIdCounter = 0;
function nextMaterialId() {
  materialIdCounter += 1;
  return `material-${materialIdCounter}`;
}

function emptyMaterial(overrides?: Partial<MaterialDraft>): MaterialDraft {
  return {
    id: nextMaterialId(),
    name: "",
    category: "",
    description: "",
    properties: "",
    image: "",
    panelOpen: false,
    ...overrides,
  };
}

function materialsFromCopy(copy: EditablePageCopy, sharedImages?: EditablePageCopy): MaterialDraft[] {
  const source = copy.materialLexicon ?? [];
  const images = sharedImages?.materialLexicon ?? source;
  const count = Math.min(
    MAX_HOME_LEXICON_MATERIALS,
    Math.max(MIN_HOME_LEXICON_MATERIALS, source.length, images.length),
  );
  return Array.from({ length: count }, (_, index) => {
    const text = source[index];
    const image = images[index]?.image ?? text?.image ?? "";
    return emptyMaterial({
      name: text?.name ?? "",
      category: text?.category ?? "",
      description: text?.description ?? "",
      properties: text?.properties ?? "",
      image: typeof image === "string" ? image : "",
    });
  });
}

function draftFromCopy(copy: EditablePageCopy, sharedImages?: EditablePageCopy): PageLocaleDraft {
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
    editSectionViewAllLabel: copy.editSectionViewAllLabel ?? "",
    materialSectionEyebrow: copy.materialSectionEyebrow ?? "",
    materialSectionTitle: copy.materialSectionTitle ?? "",
    materialSectionNoteLabel: copy.materialSectionNoteLabel ?? "",
    materials: materialsFromCopy(copy, sharedImages),
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
          field("editSectionViewAllLabel", draft.editSectionViewAllLabel),
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
  collectionOptions = [],
  onUpdated,
  translationLocales = DEFAULT_TRANSLATION_LOCALES,
}: {
  page: SavedPagePayload;
  productOptions?: HomeEditProductOption[];
  collectionOptions?: HomeArchiveCollectionOption[];
  onUpdated?: (page: SavedPagePayload) => void;
  /** Every non-English locale to render a tab for. Defaults to Portuguese only, matching every editor's behavior before the registry drove this. */
  translationLocales?: AdminTranslationLocale[];
}) {
  const [state, setState] = useState<PageActionState>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const validation = useAdminFormValidation<"finalContactEmail" | "finalContactLabel">({ formRef });
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
  const [draftByLocale, setDraftByLocale] = useState<Record<string, PageLocaleDraft>>(() => {
    const english = draftFromCopy({ ...content, title: page.title, excerpt: page.excerpt ?? "" });
    return {
      [SOURCE_LOCALE]: english,
      ...Object.fromEntries(translationLocales.map(({ code }) => {
        const draft = draftFromCopy(translationCopyFor(code), content);
        draft.materials = english.materials.map((enMaterial, index) => {
          const localized = draft.materials[index];
          return emptyMaterial({
            id: enMaterial.id,
            image: enMaterial.image,
            name: localized?.name ?? "",
            category: localized?.category ?? "",
            description: localized?.description ?? "",
            properties: localized?.properties ?? "",
          });
        });
        return [code, draft];
      })),
    };
  });
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
  const [finalCtaProductIds, setFinalCtaProductIds] = useState<string[]>(() =>
    [...(content.finalCtaProductIds ?? []), "", "", "", ""].slice(0, 4),
  );
  const [contactEnabled, setContactEnabled] = useState(() => content.finalContactEnabled === true);
  const [archiveCollectionIds, setArchiveCollectionIds] = useState<string[]>(() => {
    const saved = content.archiveCollectionIds?.filter(Boolean) ?? [];
    return saved.length > 0 ? saved : [""];
  });

  // After save + router.refresh, re-hydrate selection lists from the saved page.
  // Depend on updatedAt only — not content identity — so typing/selecting is not wiped mid-edit.
  useEffect(() => {
    const nextContent = (page.content ?? {}) as EditablePageContent;
    const savedCollections = nextContent.archiveCollectionIds?.filter(Boolean) ?? [];
    setArchiveCollectionIds(savedCollections.length > 0 ? savedCollections : [""]);
    setFinalCtaProductIds([...(nextContent.finalCtaProductIds ?? []), "", "", "", ""].slice(0, 4));
    setContactEnabled(nextContent.finalContactEnabled === true);
    if (nextContent.editProductIds?.length) {
      setEditProductIds([...nextContent.editProductIds, "", "", "", ""].slice(0, 4));
      return;
    }
    const approvedDefaults = DEFAULT_HOME_EDIT_PRODUCT_TITLES.map(
      (title) => productOptions.find((product) => product.title === title)?.id ?? "",
    );
    setEditProductIds(approvedDefaults.every(Boolean) ? approvedDefaults : ["", "", "", ""]);
  }, [page.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: hydrate on server save only

  const draft = draftByLocale[activeLocale];
  const isEn = activeLocale === SOURCE_LOCALE;
  const activeLabel = tabs.find((tab) => tab.code === activeLocale)?.label ?? activeLocale;

  function updateField<K extends keyof PageLocaleDraft>(key: K, value: PageLocaleDraft[K]) {
    setDraftByLocale((prev) => ({ ...prev, [activeLocale]: { ...prev[activeLocale], [key]: value } }));
  }

  function updateMaterial(index: number, key: keyof MaterialDraft, value: string) {
    if (key === "id" || key === "panelOpen") return;
    setDraftByLocale((prev) => {
      if (key === "image") {
        return Object.fromEntries(
          Object.entries(prev).map(([locale, draft]) => [
            locale,
            {
              ...draft,
              materials: draft.materials.map((material, slot) =>
                slot === index ? { ...material, image: value } : material,
              ),
            },
          ]),
        );
      }
      const materials = prev[activeLocale].materials.map((material, slot) =>
        slot === index ? { ...material, [key]: value } : material,
      );
      return { ...prev, [activeLocale]: { ...prev[activeLocale], materials } };
    });
  }

  function setMaterialPanelOpen(index: number, open: boolean) {
    setDraftByLocale((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([locale, draft]) => [
          locale,
          {
            ...draft,
            materials: draft.materials.map((material, slot) =>
              slot === index ? { ...material, panelOpen: open } : material,
            ),
          },
        ]),
      ),
    );
  }

  /** Structural add/remove/reorder — keeps every locale's slots aligned; images travel with the EN order. */
  function setMaterials(next: MaterialDraft[]) {
    setDraftByLocale((prev) => {
      const englishNext = next.map((item) => {
        const existing = prev[SOURCE_LOCALE]?.materials.find((material) => material.id === item.id);
        return {
          ...item,
          image: item.image || existing?.image || "",
          panelOpen: item.panelOpen ?? existing?.panelOpen ?? false,
        };
      });
      return Object.fromEntries(
        Object.entries(prev).map(([locale, draft]) => {
          if (locale === SOURCE_LOCALE) {
            return [locale, { ...draft, materials: englishNext }];
          }
          const byId = new Map(draft.materials.map((material) => [material.id, material]));
          return [
            locale,
            {
              ...draft,
              materials: englishNext.map((enItem) => {
                const existing = byId.get(enItem.id);
                return existing
                  ? { ...existing, image: enItem.image, panelOpen: enItem.panelOpen }
                  : emptyMaterial({
                      id: enItem.id,
                      image: enItem.image,
                      panelOpen: enItem.panelOpen,
                    });
              }),
            },
          ];
        }),
      );
    });
  }

  function createMaterial(): MaterialDraft {
    return emptyMaterial({ panelOpen: true });
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
      validation.showFieldErrors(result.fieldErrors ?? {});
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (result.page) {
        const saved = (result.page.content ?? {}) as EditablePageContent;
        const savedCollections = saved.archiveCollectionIds?.filter(Boolean) ?? [];
        setArchiveCollectionIds(savedCollections.length > 0 ? savedCollections : [""]);
        if (saved.editProductIds?.length) {
          setEditProductIds([...saved.editProductIds, "", "", "", ""].slice(0, 4));
        }
        setFinalCtaProductIds([...(saved.finalCtaProductIds ?? []), "", "", "", ""].slice(0, 4));
        setContactEnabled(saved.finalContactEnabled === true);
        onUpdated?.(result.page);
      }
    });
  }

  function requestSave() {
    setState({});
    if (!contactEnabled) {
      validation.showFieldErrors({});
      setConfirmOpen(true);
      return;
    }

    const emailValue = String(
      (formRef.current?.elements.namedItem("finalContactEmail") as HTMLInputElement | null)?.value ?? "",
    ).trim();
    const errors: Partial<Record<"finalContactEmail" | "finalContactLabel", string>> = {};
    if (!draft.finalContactLabel.trim()) {
      errors.finalContactLabel = "Enter a contact link label.";
    }
    if (!emailValue) {
      errors.finalContactEmail = "Enter a contact email.";
    } else if (!isValidOptionalEmail(emailValue)) {
      errors.finalContactEmail = OPTIONAL_EMAIL_ERROR;
    }
    validation.showFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setConfirmOpen(true);
  }

  return (
    // Collapsed panels use visibility:hidden; native constraints cannot focus
    // those fields (e.g. type=email). noValidate + useAdminFormValidation show
    // field chrome instead of the browser's unfocusable-control error.
    <form data-component="PageEditor" ref={formRef} action={formAction} noValidate>
      <input type="hidden" name="pageId" value={page.id} />
      <input type="hidden" name="slug" value={page.slug} />
      <HiddenLocaleFields
        draftByLocale={draftByLocale}
        legalSectionIds={legalSections.map((section) => section.id)}
        serviceSectionIds={serviceSections.map((section) => section.id)}
      />

      <AdminListWorkspace.Root>
        <AdminListWorkspace.Header
          tag="[ EDIT PAGE ]"
          title={page.title}
          meta={`/${page.slug}`}
          actions={
            <button
              type="button"
              className="adm-btn-primary"
              disabled={isPending}
              onClick={requestSave}
            >
              {isPending ? "Saving..." : "Save page"}
            </button>
          }
        >
          <AdminLocaleTabs
            embedded
            active={activeLocale}
            onSelect={selectLocale}
            locales={tabs}
          />
        </AdminListWorkspace.Header>

        <AdminListWorkspace.Body className="grid gap-5">
        <AuthMessage error={state.error} />

        {isHomePage ? (
          <>
            <AdminLongTextField
              label="Search summary"
              help={<AdminHelp>Search-engine result description (meta description). Not shown in the hero.</AdminHelp>}
              value={draft.excerpt}
              onChange={(value) => updateField("excerpt", value)}
              rows={3}
            />
            <HomePageEditorSections
              key={page.updatedAt.toISOString()}
              content={content}
              draft={draft}
              updateField={updateField as HomePageEditorSectionsProps["updateField"]}
              updateMaterial={updateMaterial}
              setMaterialPanelOpen={setMaterialPanelOpen}
              setMaterials={setMaterials}
              createMaterial={createMaterial}
              editProductIds={editProductIds}
              setEditProductIds={setEditProductIds}
              finalCtaProductIds={finalCtaProductIds}
              setFinalCtaProductIds={setFinalCtaProductIds}
              productOptions={productOptions}
              archiveCollectionIds={archiveCollectionIds}
              setArchiveCollectionIds={setArchiveCollectionIds}
              collectionOptions={collectionOptions}
              contactEnabled={contactEnabled}
              setContactEnabled={(next) => {
                setContactEnabled(next);
                validation.showFieldErrors({});
              }}
              contactLabelError={validation.fieldErrors.finalContactLabel}
              contactLabelErrorId={validation.fieldErrorId("finalContactLabel")}
              onContactLabelEdit={() => validation.clearFieldError("finalContactLabel")}
              contactEmailError={validation.fieldErrors.finalContactEmail}
              contactEmailErrorId={validation.fieldErrorId("finalContactEmail")}
              contactEmailFieldProps={validation.fieldProps("finalContactEmail")}
            />
          </>
        ) : null}

        {!isHomePage && !isEn && !isBuiltInPage(page.slug) ? (
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

        {!isHomePage ? (
        <div className="grid gap-4 md:grid-cols-2">
          <AdminTextField
            label="Title"
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
        ) : null}

        {!isHomePage ? (
        <AdminLongTextField
          label="Excerpt"
          help={
            hideDeadCopyFields ? (
              <AdminHelp>Search-engine result description (meta description). Not shown on the page itself.</AdminHelp>
            ) : undefined
          }
          value={draft.excerpt}
          onChange={(value) => updateField("excerpt", value)}
          rows={3}
        />
        ) : null}

        {!isHomePage ? (
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
        ) : null}

        {!isHomePage ? (
        <div hidden={isCollectionsPage}>
          <AdminLongTextField
            label={isAboutPage ? "About introduction" : isShopPage ? "Hero description" : isServicePage ? "Intro" : "Body"}
            help={
              isShopPage ? (
                <AdminHelp>The paragraph under the hero heading on /shop.</AdminHelp>
              ) : isServicePage ? (
                <AdminHelp>The paragraph under the heading on /{page.slug}, above the four sections below.</AdminHelp>
              ) : undefined
            }
            value={draft.body}
            onChange={(value) => updateField("body", value)}
            rows={5}
          />
        </div>
        ) : null}

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
                  <AdminLongTextField
                    label="Body"
                    value={value?.body ?? ""}
                    onChange={(value) => updateServiceSection(section.id, "body", value)}
                    rows={3}
                  />
                </div>
              );
            })}
          </section>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2" hidden={hideShopCalloutFields || isHomePage}>
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
            <AdminHrefField
              label="CTA href"
              help={
                <AdminHelp>
                  Shared across languages. Search by name, or type /products/ or /collections/ to pick a specific item.
                </AdminHelp>
              }
              name="ctaHref"
              defaultValue={content.ctaHref ?? ""}
              placeholder="/products/…"
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
                <AdminLongTextField
                  className="md:col-span-2"
                  label="Intro paragraph"
                  value={draft.legalIntro}
                  onChange={(value) => updateField("legalIntro", value)}
                  rows={2}
                />
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
                  <AdminLongTextField
                    label="Body (Markdown)"
                    value={value?.body ?? ""}
                    onChange={(value) => updateLegalSection(section.id, "body", value)}
                    rows={6}
                    editorClassName="font-mono text-xs"
                  />
                </div>
              );
            })}
          </section>
        ) : null}

        {!isHomePage ? (
        <div hidden={hideDeadCopyFields}>
          <AdminLongTextField
            label={isAboutPage ? "Movement section headline" : "Quote"}
            value={draft.quote}
            onChange={(value) => updateField("quote", value)}
            rows={4}
          />
        </div>
        ) : null}

        {!isHomePage ? (
        <div className="grid gap-4 md:grid-cols-2" hidden={hideShopCalloutFields}>
          <AdminTextField
            label={isAboutPage ? "Manifesto headline" : isShopPage ? "Collections callout heading" : "Secondary title"}
            help={
              isShopPage ? (
                <AdminHelp>The heading in the “Browse the Collections” callout at the bottom of /shop.</AdminHelp>
              ) : undefined
            }
            value={draft.secondaryTitle}
            onChange={(event) => updateField("secondaryTitle", event.target.value)}
          />
          <AdminLongTextField
            label={isAboutPage ? "Manifesto copy" : isShopPage ? "Secondary link label" : "Secondary body"}
            help={
              isShopPage ? (
                <AdminHelp>The small link under the button (e.g. “About Synarava”). Always links to /about.</AdminHelp>
              ) : undefined
            }
            value={draft.secondaryBody}
            onChange={(value) => updateField("secondaryBody", value)}
            rows={isShopPage ? 2 : 3}
          />
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

        <div className="flex justify-end pt-4" style={{ borderTop: "1px solid var(--adm-border)" }}>
          <button
            type="button"
            className="adm-btn-primary"
            disabled={isPending}
            onClick={requestSave}
          >
            {isPending ? "Saving..." : "Save page"}
          </button>
        </div>
        </AdminListWorkspace.Body>
      </AdminListWorkspace.Root>

      <AdminConfirmModal
        open={confirmOpen}
        title={`Save ${page.title}`}
        description="This writes page copy and publishing state to the database. Published pages may change the site immediately after revalidation."
        confirmLabel="Save page"
        pending={isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </form>
  );
}
