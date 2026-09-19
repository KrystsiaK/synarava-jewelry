"use client";

import type { CollectionFieldName } from "@/app/admin/actions/collections";
import { AdminHelp } from "@/components/admin/shared/admin-help";
import { ImageFileField } from "@/components/admin/shared/image-file-field";
import { AdminLocaleTabs, useAdminActiveLocale, type AdminLocaleStatus } from "@/components/admin/shared/admin-locale-workspace";
import { fieldClass } from "@/components/admin/collections/collection-helpers";
import type { CollectionDraft, CollectionLocaleDraft } from "@/components/admin/collections/collection-types";

export function FieldLabel({
  children,
  help,
  required,
}: {
  children: React.ReactNode;
  help?: React.ReactNode;
  required?: boolean;
}) {
  return (
    <span data-component="FieldLabel" className="adm-label-row">
      <span className="adm-label">
        {children}
        {required ? <span style={{ color: "var(--adm-accent)", marginLeft: "0.25rem" }}>*</span> : null}
      </span>
      {help ? <AdminHelp>{help}</AdminHelp> : null}
    </span>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p data-component="FieldError" className="adm-field-error">{message}</p>;
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
      description: "Hidden from the storefront while you prepare content.",
    },
    {
      value: "PUBLISHED",
      title: "Published",
      description: "Visible on collection listings and the public collection page.",
    },
  ];

  return (
    <div data-component="WorkflowStateField" className="grid gap-2">
      <FieldLabel required help="Draft collections stay private. Published collections appear on the collections index and their public detail page.">
        Storefront state
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
// The always-present hidden mirrors below carry both locales' real values on
// submit regardless of which tab is active. Adding a third language later is
// a matter of extending AdminLocale + these mirrors, not this JSX.
function HiddenLocaleFields({ draft }: { draft: CollectionDraft }) {
  return (
    <div hidden>
      <input type="hidden" readOnly name="name" value={draft.name} />
      <input type="hidden" readOnly name="ptName" value={draft.pt.name} />
      <input type="hidden" readOnly name="subtitle" value={draft.subtitle} />
      <input type="hidden" readOnly name="ptSubtitle" value={draft.pt.subtitle} />
      <input type="hidden" readOnly name="description" value={draft.description} />
      <input type="hidden" readOnly name="ptDescription" value={draft.pt.description} />
      <input type="hidden" readOnly name="manifesto" value={draft.manifesto} />
      <input type="hidden" readOnly name="ptManifesto" value={draft.pt.manifesto} />
      <input type="hidden" readOnly name="searchSummary" value={draft.searchSummary} />
      <input type="hidden" readOnly name="ptSearchSummary" value={draft.pt.searchSummary} />
      <input type="hidden" readOnly name="symbolismLabel" value={draft.symbolismLabel} />
      <input type="hidden" readOnly name="ptSymbolismLabel" value={draft.pt.symbolismLabel} />
      <input type="hidden" readOnly name="symbolismTitle" value={draft.symbolismTitle} />
      <input type="hidden" readOnly name="ptSymbolismTitle" value={draft.pt.symbolismTitle} />
      <input type="hidden" readOnly name="symbolismBody" value={draft.symbolismBody} />
      <input type="hidden" readOnly name="ptSymbolismBody" value={draft.pt.symbolismBody} />
      <input type="hidden" readOnly name="symbolismBody2" value={draft.symbolismBody2} />
      <input type="hidden" readOnly name="ptSymbolismBody2" value={draft.pt.symbolismBody2} />
    </div>
  );
}

export function CollectionFields({
  draft,
  onChange,
  onChangePt,
  fieldErrors,
  currentHeroImageUrl,
  currentHeroImageLabel,
  fileInputKey,
}: {
  draft: CollectionDraft;
  onChange: <K extends keyof CollectionDraft>(key: K, value: CollectionDraft[K]) => void;
  onChangePt: <K extends keyof CollectionLocaleDraft>(key: K, value: CollectionLocaleDraft[K]) => void;
  fieldErrors?: Partial<Record<CollectionFieldName, string>>;
  currentHeroImageUrl?: string | null;
  currentHeroImageLabel?: string;
  fileInputKey?: string | number;
}) {
  const [locale, selectLocale] = useAdminActiveLocale(`collection:${draft.slug || "new"}`, "EN");
  const isEn = locale === "EN";
  return (
    <>
      <AdminLocaleTabs active={locale} onSelect={selectLocale} ptStatus={draft.pt.syncStatus as AdminLocaleStatus} />
      <HiddenLocaleFields draft={draft} />

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2">
          <FieldLabel required={isEn}>Name</FieldLabel>
          <input
            required={isEn}
            value={isEn ? draft.name : draft.pt.name}
            onChange={(e) => (isEn ? onChange("name", e.target.value) : onChangePt("name", e.target.value))}
            className={fieldClass(isEn ? fieldErrors?.name : undefined)}
            aria-invalid={isEn && Boolean(fieldErrors?.name)}
            placeholder={isEn ? "Earth Rituals" : "Rituais da Terra"}
          />
          <FieldError message={isEn ? fieldErrors?.name : undefined} />
        </label>
        <label className="grid gap-2">
          <FieldLabel>Subtitle</FieldLabel>
          <input
            value={isEn ? draft.subtitle : draft.pt.subtitle}
            onChange={(e) => (isEn ? onChange("subtitle", e.target.value) : onChangePt("subtitle", e.target.value))}
            className="adm-field"
            placeholder={isEn ? "A short editorial line" : "Optional — shows the English subtitle until filled in."}
          />
        </label>
        <label className="grid gap-2" hidden={locale !== "PT"}>
          <FieldLabel>URL handle (PT, optional)</FieldLabel>
          <input
            name="ptHandle"
            value={draft.pt.localizedHandle}
            onChange={(e) => onChangePt("localizedHandle", e.target.value)}
            className="adm-field"
            placeholder={draft.slug}
          />
        </label>

        <label className="grid gap-2">
          <FieldLabel required help="Auto-generated from the collection name until you edit it manually. Keep it short, lowercase, and URL-friendly.">
            Slug
          </FieldLabel>
          <input
            name="slug"
            required
            value={draft.slug}
            onChange={(e) => onChange("slug", e.target.value)}
            className={fieldClass(fieldErrors?.slug)}
            aria-invalid={Boolean(fieldErrors?.slug)}
            placeholder="earth-rituals"
          />
          <FieldError message={fieldErrors?.slug} />
        </label>

        <label className="grid gap-2">
          <FieldLabel required help="Short collection code used in storefront views and admin references.">
            Accent code
          </FieldLabel>
          <input
            name="code"
            required
            value={draft.code}
            onChange={(e) => onChange("code", e.target.value)}
            className={fieldClass(fieldErrors?.code)}
            aria-invalid={Boolean(fieldErrors?.code)}
            placeholder="COL-01"
          />
          <FieldError message={fieldErrors?.code} />
        </label>

      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <FieldLabel
            required
            help="Upload a hero image for new collections. When editing, leave the field empty to keep the current media."
          >
            Hero image
          </FieldLabel>
          <ImageFileField
            key={fileInputKey}
            name="heroImageFile"
            required={!currentHeroImageUrl}
            className={fieldClass(fieldErrors?.heroImageFile)}
            aria-invalid={Boolean(fieldErrors?.heroImageFile)}
            currentImageUrl={currentHeroImageUrl}
            currentImageAlt={currentHeroImageLabel ?? "Collection hero image"}
            currentImageLabel="Current hero image"
            previewAspect="video"
            removeFieldName="removeHeroImage"
            removeLabel="Remove"
          />
          <FieldError message={fieldErrors?.heroImageFile} />
        </label>
      </div>

      <label className="grid gap-2">
        <FieldLabel required={isEn}>Collection summary</FieldLabel>
        <textarea
          rows={3}
          required={isEn}
          value={isEn ? draft.description : draft.pt.description}
          onChange={(e) => (isEn ? onChange("description", e.target.value) : onChangePt("description", e.target.value))}
          className={fieldClass(isEn ? fieldErrors?.description : undefined)}
          aria-invalid={isEn && Boolean(fieldErrors?.description)}
          placeholder={isEn ? "This text appears on the collection card and collection hero." : "Optional — shows the English summary until filled in."}
        />
        <FieldError message={isEn ? fieldErrors?.description : undefined} />
      </label>

      <label className="grid gap-2">
        <FieldLabel required={isEn}>Manifesto</FieldLabel>
        <textarea
          rows={4}
          required={isEn}
          value={isEn ? draft.manifesto : draft.pt.manifesto}
          onChange={(e) => (isEn ? onChange("manifesto", e.target.value) : onChangePt("manifesto", e.target.value))}
          className={fieldClass(isEn ? fieldErrors?.manifesto : undefined)}
          aria-invalid={isEn && Boolean(fieldErrors?.manifesto)}
          placeholder={isEn ? "This text powers the manifesto strip on the collection page." : "Optional — shows the English manifesto until filled in."}
        />
        <FieldError message={isEn ? fieldErrors?.manifesto : undefined} />
      </label>

      <label className="grid gap-2">
        <FieldLabel required={isEn}>Search summary</FieldLabel>
        <textarea
          rows={2}
          required={isEn}
          value={isEn ? draft.searchSummary : draft.pt.searchSummary}
          onChange={(e) => (isEn ? onChange("searchSummary", e.target.value) : onChangePt("searchSummary", e.target.value))}
          className={fieldClass(isEn ? fieldErrors?.searchSummary : undefined)}
          aria-invalid={isEn && Boolean(fieldErrors?.searchSummary)}
          placeholder={isEn ? "Short search/discovery helper text." : "Optional — shows the English summary until filled in."}
        />
        <FieldError message={isEn ? fieldErrors?.searchSummary : undefined} />
      </label>

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
              {isEn ? "" : " Optional — leave blank to show the English text to Portuguese visitors."}
            </AdminHelp>
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <FieldLabel>Symbolism label</FieldLabel>
            <input
              value={isEn ? draft.symbolismLabel : draft.pt.symbolismLabel}
              onChange={(e) => (isEn ? onChange("symbolismLabel", e.target.value) : onChangePt("symbolismLabel", e.target.value))}
              className="adm-field"
              placeholder={isEn ? "Symbolic Language" : undefined}
            />
          </label>
          <label className="grid gap-2">
            <FieldLabel>Symbolism title</FieldLabel>
            <input
              value={isEn ? draft.symbolismTitle : draft.pt.symbolismTitle}
              onChange={(e) => (isEn ? onChange("symbolismTitle", e.target.value) : onChangePt("symbolismTitle", e.target.value))}
              className="adm-field"
              placeholder={isEn ? "Wood, Lava, Embroidery" : undefined}
            />
          </label>
        </div>

        <label className="grid gap-2">
          <FieldLabel>Symbolism body</FieldLabel>
          <textarea
            rows={4}
            value={isEn ? draft.symbolismBody : draft.pt.symbolismBody}
            onChange={(e) => (isEn ? onChange("symbolismBody", e.target.value) : onChangePt("symbolismBody", e.target.value))}
            className="adm-field"
          />
        </label>

        <label className="grid gap-2">
          <FieldLabel>Symbolism secondary body</FieldLabel>
          <textarea
            rows={3}
            value={isEn ? draft.symbolismBody2 : draft.pt.symbolismBody2}
            onChange={(e) => (isEn ? onChange("symbolismBody2", e.target.value) : onChangePt("symbolismBody2", e.target.value))}
            className="adm-field"
          />
        </label>
      </div>

      {/* PT-only translation status — no EN counterpart, so this stays locale-gated */}
      <div
        hidden={locale !== "PT"}
        className="grid gap-4 border border-[var(--adm-border)] bg-[var(--adm-bg-soft)] p-4"
      >
        <div>
          <p className="adm-section-tag">[ PT — PORTUGUÊS ]</p>
          <p className="mt-2 text-xs text-[var(--adm-muted)]">
            Optional — publishing never blocks on this. Whatever is left blank here shows the English
            text to Portuguese visitors instead, until it&apos;s filled in.
          </p>
          {draft.pt.syncError ? (
            <p className="mt-2 text-xs text-[var(--adm-danger)]">{draft.pt.syncError}</p>
          ) : null}
        </div>

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="ptReviewed"
            checked={draft.pt.reviewed}
            onChange={(e) => onChangePt("reviewed", e.target.checked)}
          />
          <span>Portuguese translation reviewed</span>
        </label>
      </div>
    </>
  );
}
