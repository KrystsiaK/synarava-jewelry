"use client";

import { createContext, use, useEffect, type ReactNode } from "react";

import type { CollectionFieldName } from "@/lib/admin/collection-form-validation";
import { AdminFieldIssue } from "@/components/admin/issues/admin-issues-cms";
import { AdminFieldError } from "@/components/admin/shared/admin-form-validation";
import { localeOfFirstError } from "@/components/admin/shared/admin-locale-panel";
import type { AdminIssueSummary } from "@/components/admin/shared/admin-issue-types";
import { ImageFileField } from "@/components/admin/shared/image-file-field";
import { AdminLocaleTabs, useAdminActiveLocale, type AdminLocaleStatus, type AdminLocaleTab } from "@/components/admin/shared/admin-locale-workspace";
import { adminLocaleFieldName } from "@/lib/i18n/admin-locale-fields";
import type { AdminTranslationLocale } from "@/lib/i18n/admin-translation-locales";
import { fieldClass } from "@/components/admin/collections/collection-helpers";
import type { CollectionDraft, CollectionLocaleDraft } from "@/components/admin/collections/collection-types";
import { DEFAULT_COLLECTION_STORY_TITLE } from "@/lib/collections/story-copy";
import {
  AdminCheckboxControl,
  AdminHelp,
  AdminRichTextField,
  AdminSelectField,
  AdminSerpPreview,
  AdminTextField,
  FieldLabel,
} from "@/components/synarava-cms";
import { localePath } from "@/lib/i18n/routing";
import {
  resolveSerpDescription,
  resolveSerpTitle,
  seoDescriptionWarning,
  seoTitleWarning,
} from "@/lib/seo/serp-preview";

export { FieldLabel } from "@/components/synarava-cms";

const SOURCE_LOCALE = "en";
const DEFAULT_TRANSLATION_LOCALES: AdminTranslationLocale[] = [{ code: "pt", label: "Português" }];

const EMPTY_TRANSLATION: CollectionLocaleDraft = {
  localizedHandle: "", name: "", subtitle: "", description: "", manifesto: "", searchSummary: "",
  storyTitle: "", storyBody: "",
  symbolismLabel: "", symbolismTitle: "", symbolismBody: "", symbolismBody2: "",
  reviewed: false, syncStatus: "NOT_APPLICABLE", syncError: "",
};

type CollectionLocaleContextValue = {
  locale: string;
  selectLocale: (code: string) => void;
  tabs: AdminLocaleTab[];
  isEn: boolean;
  active: CollectionLocaleDraft | null;
  activeLabel: string;
  ptStatus?: AdminLocaleStatus;
};

const CollectionLocaleContext = createContext<CollectionLocaleContextValue | null>(null);

function useCollectionLocale() {
  const value = use(CollectionLocaleContext);
  if (!value) throw new Error("Collection fields must render inside CollectionLocaleProvider.");
  return value;
}

export function CollectionLocaleProvider({
  draft,
  translationLocales = DEFAULT_TRANSLATION_LOCALES,
  fieldErrors,
  children,
}: {
  draft: CollectionDraft;
  translationLocales?: AdminTranslationLocale[];
  fieldErrors?: Partial<Record<CollectionFieldName, string>>;
  children: ReactNode;
}) {
  const tabs: AdminLocaleTab[] = [{ code: SOURCE_LOCALE, label: "English" }, ...translationLocales];
  const [locale, selectLocale] = useAdminActiveLocale(`collection:${draft.slug || "new"}`, tabs);
  const isEn = locale === SOURCE_LOCALE;

  useEffect(() => {
    if (!fieldErrors) return;
    const forced = localeOfFirstError(fieldErrors, translationLocales.map((item) => item.code));
    if (forced) selectLocale(forced);
    // selectLocale identity changes with the tab list; errors are the signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldErrors]);

  const active = isEn ? null : draft.translations[locale] ?? EMPTY_TRANSLATION;
  const activeLabel = tabs.find((tab) => tab.code === locale)?.label ?? locale;

  return (
    <CollectionLocaleContext.Provider
      value={{
        locale,
        selectLocale,
        tabs,
        isEn,
        active,
        activeLabel,
        ptStatus: active?.syncStatus as AdminLocaleStatus | undefined,
      }}
    >
      {children}
    </CollectionLocaleContext.Provider>
  );
}

export function CollectionLocaleTabs({ embedded = false }: { embedded?: boolean }) {
  const { locale, selectLocale, tabs, ptStatus } = useCollectionLocale();
  return (
    <AdminLocaleTabs
      embedded={embedded}
      active={locale}
      onSelect={selectLocale}
      locales={tabs}
      ptStatus={ptStatus}
    />
  );
}

export function FieldError({ message }: { message?: string }) {
  return <AdminFieldError message={message} />;
}

export function WorkflowStateField({
  value,
  onChange,
  error,
}: {
  value: CollectionDraft["workflowState"];
  onChange: (value: CollectionDraft["workflowState"]) => void;
  error?: string;
}) {
  return (
    <AdminSelectField
      label="Site state"
      owner="Synarava"
      name="workflowState"
      required
      unitId="field-workflowState"
      validationName="workflowState"
      help="Draft hides the collection and moves its live member products to Draft locally. Shopify commerce status is not pushed. Published shows the collection; it does not auto-publish products."
      value={value}
      onChange={(event) => onChange(event.target.value as CollectionDraft["workflowState"])}
      error={error}
      className="md:max-w-xs"
    >
      <option value="DRAFT">Draft — hidden</option>
      <option value="PUBLISHED">Published — visible</option>
    </AdminSelectField>
  );
}

// One physical field per concept (Name, Subtitle, Collection summary, ...),
// not one copy per language: the field's *value* switches with the active
// locale tab, everything else about it (label, position, layout) stays put.
// The always-present hidden mirrors below carry every locale's real value on
// submit regardless of which tab is active. Adding a third language is a
// registry row (Task U1) — this JSX and the mirror list don't change.
function HiddenLocaleFields({ draft, translationLocales }: { draft: CollectionDraft; translationLocales: AdminTranslationLocale[] }) {
  const keys: Array<keyof CollectionLocaleDraft & keyof CollectionDraft> = [
    "name", "subtitle", "description", "manifesto", "searchSummary",
    "storyTitle", "storyBody",
    "symbolismLabel", "symbolismTitle", "symbolismBody", "symbolismBody2",
  ];
  return (
    <div hidden>
      {keys.map((key) => (
        <input key={key} type="hidden" readOnly name={key} value={draft[key]} />
      ))}
      <input type="hidden" readOnly name="seoTitle" value={draft.seoTitle} />
      <input type="hidden" readOnly name="seoDescription" value={draft.seoDescription} />
      {translationLocales.flatMap(({ code }) => {
        const translation = draft.translations[code] ?? EMPTY_TRANSLATION;
        return [
          ...keys.map((key) => (
            <input
              key={adminLocaleFieldName(code, key, SOURCE_LOCALE)}
              type="hidden"
              readOnly
              name={adminLocaleFieldName(code, key, SOURCE_LOCALE)}
              value={translation[key]}
            />
          )),
          <input
            key={adminLocaleFieldName(code, "localizedHandle", SOURCE_LOCALE)}
            type="hidden"
            readOnly
            name={adminLocaleFieldName(code, "localizedHandle", SOURCE_LOCALE)}
            value={translation.localizedHandle}
          />,
          <input
            key={adminLocaleFieldName(code, "reviewed", SOURCE_LOCALE)}
            type="hidden"
            readOnly
            name={adminLocaleFieldName(code, "reviewed", SOURCE_LOCALE)}
            value={translation.reviewed ? "on" : ""}
          />,
        ];
      })}
    </div>
  );
}

export function CollectionFields({
  draft,
  onChange,
  onChangeTranslation,
  fieldErrors,
  onFieldEdit,
  currentHeroImageUrl,
  currentHeroImageLabel,
  fileInputKey,
  entityId,
  translationLocales = DEFAULT_TRANSLATION_LOCALES,
  issues = [],
}: {
  draft: CollectionDraft;
  onChange: <K extends keyof CollectionDraft>(key: K, value: CollectionDraft[K]) => void;
  onChangeTranslation: <K extends keyof CollectionLocaleDraft>(locale: string, key: K, value: CollectionLocaleDraft[K]) => void;
  fieldErrors?: Partial<Record<CollectionFieldName, string>>;
  /** Clears that field's error as soon as the operator edits it. */
  onFieldEdit?: (name: CollectionFieldName) => void;
  currentHeroImageUrl?: string | null;
  currentHeroImageLabel?: string;
  fileInputKey?: string | number;
  /** Existing persisted collection only — omit when creating a new one. */
  entityId?: string;
  /** Every non-English locale to render a tab for. Defaults to Portuguese only, matching every editor's behavior before the registry drove this. */
  translationLocales?: AdminTranslationLocale[];
  issues?: AdminIssueSummary[];
}) {
  const { locale, isEn, active, activeLabel } = useCollectionLocale();
  const heroIssues = issues.filter(
    (issue) => issue.fieldPath === "field-heroImageUrl" && issue.status === "OPEN",
  );
  const hasHeroIssues = heroIssues.length > 0;

  function updateActiveTranslation<K extends keyof CollectionLocaleDraft>(key: K, value: CollectionLocaleDraft[K]) {
    onChangeTranslation(locale, key, value);
  }

  return (
    <>
      <HiddenLocaleFields draft={draft} translationLocales={translationLocales} />

      <div className="grid gap-4 md:grid-cols-2">
        <AdminTextField
          label="Name"
          owner="Shopify"
          required={isEn}
          unitId="field-name"
          validationName="name"
          value={isEn ? draft.name : active!.name}
          onChange={(e) => {
            if (isEn) {
              onChange("name", e.target.value);
              onFieldEdit?.("name");
            } else {
              updateActiveTranslation("name", e.target.value);
            }
          }}
          error={isEn ? fieldErrors?.name : undefined}
          placeholder={isEn ? "Earth Rituals" : "Optional — shows the English name until filled in."}
        />
        <AdminTextField
          label="Subtitle"
          owner="Synarava"
          value={isEn ? draft.subtitle : active!.subtitle}
          onChange={(e) => (isEn ? onChange("subtitle", e.target.value) : updateActiveTranslation("subtitle", e.target.value))}
          placeholder={isEn ? "A short editorial line" : "Optional — shows the English subtitle until filled in."}
        />
        <div hidden={isEn}>
          <AdminTextField
            label={`URL handle (${activeLabel}, optional)`}
            value={active?.localizedHandle ?? ""}
            onChange={(e) => updateActiveTranslation("localizedHandle", e.target.value)}
            placeholder={draft.slug}
          />
        </div>

        <AdminTextField
          label="Slug"
          owner="Shopify"
          name="slug"
          required
          unitId="field-slug"
          validationName="slug"
          help="Auto-generated from the collection name until you edit it manually. Keep it short, lowercase, and URL-friendly."
          value={draft.slug}
          onChange={(e) => {
            onChange("slug", e.target.value);
            onFieldEdit?.("slug");
          }}
          error={fieldErrors?.slug}
          placeholder="earth-rituals"
        />

        <AdminTextField
          label="Accent code"
          owner="Synarava"
          name="code"
          required
          unitId="field-code"
          validationName="code"
          help="Short collection code used in site views and admin references."
          value={draft.code}
          onChange={(e) => {
            onChange("code", e.target.value);
            onFieldEdit?.("code");
          }}
          error={fieldErrors?.code}
          placeholder="COL-01"
        />

        <WorkflowStateField
          value={draft.workflowState}
          onChange={(value) => {
            onChange("workflowState", value);
            onFieldEdit?.("workflowState");
          }}
          error={fieldErrors?.workflowState}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/*
          Tall media composite: do NOT wrap in `.adm-field-unit`.
          Absolute error band is for single-line controls; here it paints over the path.
          Mirror ProductMediaManager — issue copy stays in normal flow under the label.
        */}
        <section
          id="field-heroImageUrl"
          data-component="CollectionHeroField"
          data-validation-for="heroImageFile"
          className="grid gap-2"
          style={
            hasHeroIssues
              ? {
                  border: "1px solid rgba(255, 93, 93, 0.38)",
                  background: "rgba(255, 93, 93, 0.06)",
                  borderRadius: "8px",
                  padding: "0.75rem",
                }
              : undefined
          }
        >
          <FieldLabel
            required
            help="Upload a hero image for new collections. When editing, leave the field empty to keep the current media."
          >
            Hero image
          </FieldLabel>
          <AdminFieldIssue issues={heroIssues} />
          <ImageFileField
            key={fileInputKey}
            name="heroImageFile"
            className={fieldClass(fieldErrors?.heroImageFile ?? (hasHeroIssues ? "broken" : undefined))}
            aria-invalid={Boolean(fieldErrors?.heroImageFile) || hasHeroIssues}
            currentImageUrl={currentHeroImageUrl}
            currentImageAlt={currentHeroImageLabel ?? "Collection hero image"}
            currentImageLabel="Current hero image"
            previewAspect="video"
            removeFieldName="removeHeroImage"
            removeLabel="Remove"
            onFileChange={(file) => {
              if (file && file.size > 0) onFieldEdit?.("heroImageFile");
            }}
            onRemoveChange={(removing) => {
              if (!removing && currentHeroImageUrl) onFieldEdit?.("heroImageFile");
            }}
          />
          <FieldError message={fieldErrors?.heroImageFile} />
        </section>
      </div>

      <AdminRichTextField
        label="Collection summary"
        owner="Shopify"
        required={isEn}
        unitId="field-description"
        validationName="description"
        value={isEn ? draft.description : active!.description}
        onChange={(value) => {
          if (isEn) {
            onChange("description", value);
            onFieldEdit?.("description");
          } else {
            updateActiveTranslation("description", value);
          }
        }}
        error={isEn ? fieldErrors?.description : undefined}
        placeholder={isEn ? "This text appears on the collection card and collection hero." : "Optional — shows the English summary until filled in."}
      />

      <div className="grid gap-4 md:grid-cols-2" hidden={!isEn}>
        <AdminTextField
          label="SEO title"
          owner="Shopify"
          value={draft.seoTitle}
          warning={seoTitleWarning(draft.seoTitle)}
          onChange={(event) => onChange("seoTitle", event.target.value)}
          placeholder="Search result title"
        />
        <AdminRichTextField
          label="SEO description"
          owner="Shopify"
          value={draft.seoDescription}
          warning={seoDescriptionWarning(draft.seoDescription)}
          onChange={(value) => onChange("seoDescription", value)}
          placeholder="Search result description"
        />
      </div>
      <div hidden={!isEn}>
        <AdminSerpPreview
          title={resolveSerpTitle(draft.seoTitle, draft.name)}
          description={resolveSerpDescription(
            draft.seoDescription,
            draft.searchSummary,
            draft.description,
          )}
          path={localePath("en", `/collections/${draft.slug.trim() || "slug"}`)}
        />
      </div>

      <AdminRichTextField
        label="Manifesto"
        owner="Synarava"
        required={isEn}
        unitId="field-manifesto"
        validationName="manifesto"
        value={isEn ? draft.manifesto : active!.manifesto}
        onChange={(value) => {
          if (isEn) {
            onChange("manifesto", value);
            onFieldEdit?.("manifesto");
          } else {
            updateActiveTranslation("manifesto", value);
          }
        }}
        error={isEn ? fieldErrors?.manifesto : undefined}
        placeholder={isEn ? "This text powers the manifesto strip on the collection page." : "Optional — shows the English manifesto until filled in."}
      />

      <AdminRichTextField
        label="Search summary"
        owner="Synarava"
        required={isEn}
        unitId="field-searchSummary"
        validationName="searchSummary"
        value={isEn ? draft.searchSummary : active!.searchSummary}
        onChange={(value) => {
          if (isEn) {
            onChange("searchSummary", value);
            onFieldEdit?.("searchSummary");
          } else {
            updateActiveTranslation("searchSummary", value);
          }
        }}
        error={isEn ? fieldErrors?.searchSummary : undefined}
        placeholder={isEn ? "Short search/discovery helper text." : "Optional — shows the English summary until filled in."}
      />

      {/* First text block beside the collection image. Independent of the header summary. */}
      <div
        className="grid gap-4 pt-4"
        style={{ borderTop: "1px solid var(--adm-border)" }}
      >
        <div>
          <p className="adm-label-row">
            <span className="adm-section-tag">[ STORY BLOCK ]</span>
            <AdminHelp>
              First text block beside the collection image. The heading and paragraph are edited here and are not copied from the header summary.
              {isEn ? "" : ` Optional — leave blank to show the English text to ${activeLabel} visitors.`}
            </AdminHelp>
          </p>
        </div>
        <AdminTextField
          label="Story heading"
          owner="Synarava"
          value={isEn ? draft.storyTitle : active!.storyTitle}
          onChange={(e) => (isEn ? onChange("storyTitle", e.target.value) : updateActiveTranslation("storyTitle", e.target.value))}
          placeholder={isEn ? DEFAULT_COLLECTION_STORY_TITLE : "Optional — shows the English heading until filled in."}
        />
        <AdminRichTextField
          label="Story paragraph"
          owner="Synarava"
          value={isEn ? draft.storyBody : active!.storyBody}
          onChange={(value) => (isEn ? onChange("storyBody", value) : updateActiveTranslation("storyBody", value))}
          placeholder={isEn ? "Paragraph under the story heading. Leave empty to hide it." : "Optional — shows the English paragraph until filled in."}
        />
      </div>

      {/* Second text block — shared layout, value switches with the locale tab */}
      <div
        className="grid gap-4 pt-4"
        style={{ borderTop: "1px solid var(--adm-border)" }}
      >
        <div>
          <p className="adm-label-row">
            <span className="adm-section-tag">[ DEFAULT PRODUCT SYMBOLISM ]</span>
            <AdminHelp>
              Second text block on the collection page: eyebrow, title, and the two paragraphs.
              Products in this collection inherit these values when their own symbolism override is empty.
              {isEn ? "" : ` Optional — leave blank to show the English text to ${activeLabel} visitors.`}
            </AdminHelp>
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <AdminTextField
            label="Symbolism label"
            value={isEn ? draft.symbolismLabel : active!.symbolismLabel}
            onChange={(e) => (isEn ? onChange("symbolismLabel", e.target.value) : updateActiveTranslation("symbolismLabel", e.target.value))}
            placeholder={isEn ? "Symbolic Language" : undefined}
          />
          <AdminTextField
            label="Symbolism title"
            value={isEn ? draft.symbolismTitle : active!.symbolismTitle}
            onChange={(e) => (isEn ? onChange("symbolismTitle", e.target.value) : updateActiveTranslation("symbolismTitle", e.target.value))}
            placeholder={isEn ? "Wood, Lava, Embroidery" : undefined}
          />
        </div>

        <AdminRichTextField
          label="Symbolism body"
          value={isEn ? draft.symbolismBody : active!.symbolismBody}
          onChange={(value) => (isEn ? onChange("symbolismBody", value) : updateActiveTranslation("symbolismBody", value))}
        />

        <AdminRichTextField
          label="Symbolism secondary body"
          value={isEn ? draft.symbolismBody2 : active!.symbolismBody2}
          onChange={(value) => (isEn ? onChange("symbolismBody2", value) : updateActiveTranslation("symbolismBody2", value))}
        />
      </div>

      {/* Translation-only status — no English counterpart, so this stays locale-gated */}
      <div
        hidden={isEn}
        className="grid gap-4 border border-[var(--adm-border)] bg-[var(--adm-bg-soft)] p-4"
      >
        <div>
          <p className="adm-section-tag">[ {locale.toUpperCase()} — {activeLabel.toUpperCase()} ]</p>
          <p className="mt-2 text-xs text-[var(--adm-muted)]">
            Optional — publishing never blocks on this. Whatever is left blank here shows the English
            text to {activeLabel} visitors instead, until it&apos;s filled in.
          </p>
          {active?.syncError ? (
            <p className="mt-2 text-xs text-[var(--adm-danger)]">{active.syncError}</p>
          ) : null}
        </div>

        <AdminCheckboxControl
          checked={active?.reviewed ?? false}
          onChange={(e) => updateActiveTranslation("reviewed", e.target.checked)}
          label={`${activeLabel} translation reviewed`}
        />
      </div>
    </>
  );
}
