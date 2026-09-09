"use client";

import type { CollectionFieldName } from "@/app/admin/actions/collections";
import { AdminHelp } from "@/components/admin/shared/admin-help";
import { ImageFileField } from "@/components/admin/shared/image-file-field";
import { LocaleTabStrip } from "@/components/admin/shared/admin-primitives";
import { fieldClass } from "@/components/admin/collections/collection-helpers";
import type { CollectionDraft } from "@/components/admin/collections/collection-types";

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
  fieldErrors,
  currentHeroImageUrl,
  currentHeroImageLabel,
  fileInputKey,
}: {
  draft: CollectionDraft;
  onChange: <K extends keyof CollectionDraft>(key: K, value: CollectionDraft[K]) => void;
  fieldErrors?: Partial<Record<CollectionFieldName, string>>;
  currentHeroImageUrl?: string | null;
  currentHeroImageLabel?: string;
  fileInputKey?: string | number;
}) {
  return (
    <>
      {/* i18n groundwork */}
      <LocaleTabStrip />

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2">
          <FieldLabel required>Name</FieldLabel>
          <input
            name="name"
            required
            value={draft.name}
            onChange={(e) => onChange("name", e.target.value)}
            className={fieldClass(fieldErrors?.name)}
            aria-invalid={Boolean(fieldErrors?.name)}
            placeholder="Belarus Heritage"
          />
          <FieldError message={fieldErrors?.name} />
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
            placeholder="belarus-heritage"
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

      <label className="grid gap-2">
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

      <label className="grid gap-2">
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
    </>
  );
}
