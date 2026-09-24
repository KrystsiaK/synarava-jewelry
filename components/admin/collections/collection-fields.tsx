"use client";

import type { CollectionFieldName } from "@/app/admin/actions/collections";
import { AdminFieldIssue } from "@/components/admin/issues/admin-issues-cms";
import { AdminFieldError } from "@/components/admin/shared/admin-form-validation";
import type { AdminIssueSummary } from "@/components/admin/shared/admin-issue-types";
import { ImageFileField } from "@/components/admin/shared/image-file-field";
import { AdminLocaleTabs, useAdminActiveLocale, type AdminLocaleStatus, type AdminLocaleTab } from "@/components/admin/shared/admin-locale-workspace";
import { adminLocaleFieldName } from "@/lib/i18n/admin-locale-fields";
import type { AdminTranslationLocale } from "@/lib/i18n/admin-translation-locales";
import { fieldClass } from "@/components/admin/collections/collection-helpers";
import type { CollectionDraft, CollectionLocaleDraft } from "@/components/admin/collections/collection-types";
import {
  AdminCheckboxControl,
  AdminHelp,
  AdminLongTextField,
  AdminTextField,
  FieldLabel,
} from "@/components/synarava-cms";

export { FieldLabel } from "@/components/synarava-cms";

const SOURCE_LOCALE = "en";
const DEFAULT_TRANSLATION_LOCALES: AdminTranslationLocale[] = [{ code: "pt", label: "Português" }];

const EMPTY_TRANSLATION: CollectionLocaleDraft = {
  localizedHandle: "", name: "", subtitle: "", description: "", manifesto: "", searchSummary: "",
  symbolismLabel: "", symbolismTitle: "", symbolismBody: "", symbolismBody2: "",
  reviewed: false, syncStatus: "NOT_APPLICABLE", syncError: "",
};

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
  const options: Array<{
    value: CollectionDraft["workflowState"];
    title: string;
    description: string;
  }> = [
    {
      value: "DRAFT",
      title: "Draft",
      description: "Hidden from the site; live member products also go to draft locally.",
    },
    {
      value: "PUBLISHED",
      title: "Published",
      description: "Visible on collection listings and the public collection page.",
    },
  ];

  return (
    <div id="field-workflowState" data-component="WorkflowStateField" className="grid gap-2">
      <p className="adm-label-row">
        <span className="adm-section-tag">[ SITE STATE ]</span>
        <AdminHelp label="Site state guidance">
          Draft keeps this collection private (hidden from the collections index and its detail page)
          and moves its live member products to Draft locally — Shopify commerce status is not pushed.
          Published makes the collection public on the index and detail page; it does not auto-publish products.
        </AdminHelp>
      </p>
      <FieldLabel required help="Draft: collection private + member products draft locally (no Shopify push). Published: collection public; products keep their own status.">
        Site state
      </FieldLabel>
      <input type="hidden" name="workflowState" value={value} />
      <div className="grid gap-3 md:grid-cols-2">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={selected ? "adm-workflow-btn adm-workflow-btn--on" : "adm-workflow-btn adm-workflow-btn--off"}
              aria-pressed={selected}
              aria-label={`${option.title}. ${option.description}`}
            >
              <span className="adm-label-row">
                <span
                  className="text-left text-[0.72rem] font-bold uppercase tracking-[0.08em]"
                  style={{ color: selected ? "var(--adm-accent)" : "var(--adm-muted)" }}
                >
                  {option.title}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <FieldError message={error} />
    </div>
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
    "symbolismLabel", "symbolismTitle", "symbolismBody", "symbolismBody2",
  ];
  return (
    <div hidden>
      {keys.map((key) => (
        <input key={key} type="hidden" readOnly name={key} value={draft[key]} />
      ))}
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
  currentHeroImageUrl?: string | null;
  currentHeroImageLabel?: string;
  fileInputKey?: string | number;
  /** Existing persisted collection only — omit when creating a new one. */
  entityId?: string;
  /** Every non-English locale to render a tab for. Defaults to Portuguese only, matching every editor's behavior before the registry drove this. */
  translationLocales?: AdminTranslationLocale[];
  issues?: AdminIssueSummary[];
}) {
  const tabs: AdminLocaleTab[] = [{ code: SOURCE_LOCALE, label: "English" }, ...translationLocales];
  const [locale, selectLocale] = useAdminActiveLocale(`collection:${draft.slug || "new"}`, tabs);
  const isEn = locale === SOURCE_LOCALE;
  const active = isEn ? null : draft.translations[locale] ?? EMPTY_TRANSLATION;
  const activeLabel = tabs.find((tab) => tab.code === locale)?.label ?? locale;
  const heroIssues = issues.filter(
    (issue) => issue.fieldPath === "field-heroImageUrl" && issue.status === "OPEN",
  );
  const hasHeroIssues = heroIssues.length > 0;

  function updateActiveTranslation<K extends keyof CollectionLocaleDraft>(key: K, value: CollectionLocaleDraft[K]) {
    onChangeTranslation(locale, key, value);
  }

  return (
    <>
      <AdminLocaleTabs
        active={locale}
        onSelect={selectLocale}
        locales={tabs}
        ptStatus={active?.syncStatus as AdminLocaleStatus | undefined}
      />
      <HiddenLocaleFields draft={draft} translationLocales={translationLocales} />

      <div className="grid gap-4 md:grid-cols-2">
        <AdminTextField
          label="Name"
          required={isEn}
          value={isEn ? draft.name : active!.name}
          onChange={(e) => (isEn ? onChange("name", e.target.value) : updateActiveTranslation("name", e.target.value))}
          error={isEn ? fieldErrors?.name : undefined}
          placeholder={isEn ? "Earth Rituals" : "Optional — shows the English name until filled in."}
        />
        <AdminTextField
          label="Subtitle"
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
          name="slug"
          required
          help="Auto-generated from the collection name until you edit it manually. Keep it short, lowercase, and URL-friendly."
          value={draft.slug}
          onChange={(e) => onChange("slug", e.target.value)}
          error={fieldErrors?.slug}
          placeholder="earth-rituals"
        />

        <AdminTextField
          label="Accent code"
          name="code"
          required
          help="Short collection code used in site views and admin references."
          value={draft.code}
          onChange={(e) => onChange("code", e.target.value)}
          error={fieldErrors?.code}
          placeholder="COL-01"
        />

      </div>

      <div
        className="grid gap-4 pt-4"
        style={{ borderTop: "1px solid var(--adm-border)" }}
      >
        <WorkflowStateField
          value={draft.workflowState}
          onChange={(value) => onChange("workflowState", value)}
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
            required={!currentHeroImageUrl}
            className={fieldClass(fieldErrors?.heroImageFile ?? (hasHeroIssues ? "broken" : undefined))}
            aria-invalid={Boolean(fieldErrors?.heroImageFile) || hasHeroIssues}
            currentImageUrl={currentHeroImageUrl}
            currentImageAlt={currentHeroImageLabel ?? "Collection hero image"}
            currentImageLabel="Current hero image"
            previewAspect="video"
            removeFieldName="removeHeroImage"
            removeLabel="Remove"
          />
          <FieldError message={fieldErrors?.heroImageFile} />
        </section>
      </div>

      <AdminLongTextField
        label="Collection summary"
        required={isEn}
        value={isEn ? draft.description : active!.description}
        onChange={(value) => (isEn ? onChange("description", value) : updateActiveTranslation("description", value))}
        error={isEn ? fieldErrors?.description : undefined}
        rows={3}
        placeholder={isEn ? "This text appears on the collection card and collection hero." : "Optional — shows the English summary until filled in."}
      />

      <AdminLongTextField
        label="Manifesto"
        required={isEn}
        value={isEn ? draft.manifesto : active!.manifesto}
        onChange={(value) => (isEn ? onChange("manifesto", value) : updateActiveTranslation("manifesto", value))}
        error={isEn ? fieldErrors?.manifesto : undefined}
        rows={4}
        placeholder={isEn ? "This text powers the manifesto strip on the collection page." : "Optional — shows the English manifesto until filled in."}
      />

      <AdminLongTextField
        label="Search summary"
        required={isEn}
        value={isEn ? draft.searchSummary : active!.searchSummary}
        onChange={(value) => (isEn ? onChange("searchSummary", value) : updateActiveTranslation("searchSummary", value))}
        error={isEn ? fieldErrors?.searchSummary : undefined}
        rows={2}
        placeholder={isEn ? "Short search/discovery helper text." : "Optional — shows the English summary until filled in."}
      />

      {/* Default symbolism — shared layout, value switches with the locale tab */}
      <div
        className="grid gap-4 pt-4"
        style={{ borderTop: "1px solid var(--adm-border)" }}
      >
        <div>
          <p className="adm-label-row">
            <span className="adm-section-tag">[ DEFAULT PRODUCT SYMBOLISM ]</span>
            <AdminHelp>
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

        <AdminLongTextField
          label="Symbolism body"
          value={isEn ? draft.symbolismBody : active!.symbolismBody}
          onChange={(value) => (isEn ? onChange("symbolismBody", value) : updateActiveTranslation("symbolismBody", value))}
          rows={4}
        />

        <AdminLongTextField
          label="Symbolism secondary body"
          value={isEn ? draft.symbolismBody2 : active!.symbolismBody2}
          onChange={(value) => (isEn ? onChange("symbolismBody2", value) : updateActiveTranslation("symbolismBody2", value))}
          rows={3}
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
