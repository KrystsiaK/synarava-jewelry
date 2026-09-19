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
  return (
    <>
      <AdminLocaleTabs active={locale} onSelect={selectLocale} ptStatus={draft.pt.syncStatus as AdminLocaleStatus} />

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2" hidden={locale !== "EN"}>
          <FieldLabel required>Name</FieldLabel>
          <input
            name="name"
            required
            value={draft.name}
            onChange={(e) => onChange("name", e.target.value)}
            className={fieldClass(fieldErrors?.name)}
            aria-invalid={Boolean(fieldErrors?.name)}
            placeholder="Earth Rituals"
          />
          <FieldError message={fieldErrors?.name} />
        </label>
        <label className="grid gap-2" hidden={locale !== "PT"}>
          <FieldLabel>Name (PT)</FieldLabel>
          <input
            name="ptName"
            value={draft.pt.name}
            onChange={(e) => onChangePt("name", e.target.value)}
            className="adm-field"
            placeholder="Rituais da Terra"
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

      <label className="grid gap-2" hidden={locale !== "EN"}>
        <FieldLabel required>Collection summary</FieldLabel>
        <textarea
          name="description"
          rows={3}
          required
          value={draft.description}
          onChange={(e) => onChange("description", e.target.value)}
          className={fieldClass(fieldErrors?.description)}
          aria-invalid={Boolean(fieldErrors?.description)}
          placeholder="This text appears on the collection card and collection hero."
        />
        <FieldError message={fieldErrors?.description} />
      </label>
      <label className="grid gap-2" hidden={locale !== "PT"}>
        <FieldLabel>Collection summary (PT)</FieldLabel>
        <textarea
          name="ptDescription"
          rows={3}
          value={draft.pt.description}
          onChange={(e) => onChangePt("description", e.target.value)}
          className="adm-field"
          placeholder="Optional — shows the English summary until filled in."
        />
      </label>

      <label className="grid gap-2" hidden={locale !== "EN"}>
        <FieldLabel required>Manifesto</FieldLabel>
        <textarea
          name="manifesto"
          rows={4}
          required
          value={draft.manifesto}
          onChange={(e) => onChange("manifesto", e.target.value)}
          className={fieldClass(fieldErrors?.manifesto)}
          aria-invalid={Boolean(fieldErrors?.manifesto)}
          placeholder="This text powers the manifesto strip on the collection page."
        />
        <FieldError message={fieldErrors?.manifesto} />
      </label>
      <label className="grid gap-2" hidden={locale !== "PT"}>
        <FieldLabel>Manifesto (PT)</FieldLabel>
        <textarea
          name="ptManifesto"
          rows={4}
          value={draft.pt.manifesto}
          onChange={(e) => onChangePt("manifesto", e.target.value)}
          className="adm-field"
          placeholder="Optional — shows the English manifesto until filled in."
        />
      </label>

      <label className="grid gap-2" hidden={locale !== "EN"}>
        <FieldLabel required>Search summary</FieldLabel>
        <textarea
          name="searchSummary"
          rows={2}
          required
          value={draft.searchSummary}
          onChange={(e) => onChange("searchSummary", e.target.value)}
          className={fieldClass(fieldErrors?.searchSummary)}
          aria-invalid={Boolean(fieldErrors?.searchSummary)}
          placeholder="Short search/discovery helper text."
        />
        <FieldError message={fieldErrors?.searchSummary} />
      </label>
      <label className="grid gap-2" hidden={locale !== "PT"}>
        <FieldLabel>Search summary (PT)</FieldLabel>
        <textarea
          name="ptSearchSummary"
          rows={2}
          value={draft.pt.searchSummary}
          onChange={(e) => onChangePt("searchSummary", e.target.value)}
          className="adm-field"
          placeholder="Optional — shows the English summary until filled in."
        />
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

      {/* Default symbolism */}
      <div
        hidden={locale !== "EN"}
        className="grid gap-4 pt-4"
        style={{ borderTop: "1px solid var(--adm-border)" }}
      >
        <div>
          <p className="adm-label-row">
            <span className="adm-section-tag">[ DEFAULT PRODUCT SYMBOLISM ]</span>
            <AdminHelp>
              Products in this collection inherit these values when their own symbolism override is empty.
            </AdminHelp>
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <FieldLabel>Symbolism label</FieldLabel>
            <input
              name="symbolismLabel"
              value={draft.symbolismLabel}
              onChange={(e) => onChange("symbolismLabel", e.target.value)}
              className="adm-field"
              placeholder="Symbolic Language"
            />
          </label>
          <label className="grid gap-2">
            <FieldLabel>Symbolism title</FieldLabel>
            <input
              name="symbolismTitle"
              value={draft.symbolismTitle}
              onChange={(e) => onChange("symbolismTitle", e.target.value)}
              className="adm-field"
              placeholder="Wood, Lava, Embroidery"
            />
          </label>
        </div>

        <label className="grid gap-2">
          <FieldLabel>Symbolism body</FieldLabel>
          <textarea
            name="symbolismBody"
            rows={4}
            value={draft.symbolismBody}
            onChange={(e) => onChange("symbolismBody", e.target.value)}
            className="adm-field"
          />
        </label>

        <label className="grid gap-2">
          <FieldLabel>Symbolism secondary body</FieldLabel>
          <textarea
            name="symbolismBody2"
            rows={3}
            value={draft.symbolismBody2}
            onChange={(e) => onChange("symbolismBody2", e.target.value)}
            className="adm-field"
          />
        </label>
      </div>

      {/* Default symbolism (PT) */}
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

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <FieldLabel>Symbolism label (PT)</FieldLabel>
            <input
              name="ptSymbolismLabel"
              value={draft.pt.symbolismLabel}
              onChange={(e) => onChangePt("symbolismLabel", e.target.value)}
              className="adm-field"
            />
          </label>
          <label className="grid gap-2">
            <FieldLabel>Symbolism title (PT)</FieldLabel>
            <input
              name="ptSymbolismTitle"
              value={draft.pt.symbolismTitle}
              onChange={(e) => onChangePt("symbolismTitle", e.target.value)}
              className="adm-field"
            />
          </label>
        </div>

        <label className="grid gap-2">
          <FieldLabel>Symbolism body (PT)</FieldLabel>
          <textarea
            name="ptSymbolismBody"
            rows={4}
            value={draft.pt.symbolismBody}
            onChange={(e) => onChangePt("symbolismBody", e.target.value)}
            className="adm-field"
          />
        </label>

        <label className="grid gap-2">
          <FieldLabel>Symbolism secondary body (PT)</FieldLabel>
          <textarea
            name="ptSymbolismBody2"
            rows={3}
            value={draft.pt.symbolismBody2}
            onChange={(e) => onChangePt("symbolismBody2", e.target.value)}
            className="adm-field"
          />
        </label>

        <label className="flex items-center gap-3 border-t border-[var(--adm-border)] pt-4 text-sm">
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
