"use client";

import { useEffect, useState } from "react";

import {
  AdminFieldError,
  type AdminFormValidation,
} from "@/components/admin/shared/admin-form-validation";
import { AdminHelp } from "@/components/admin/shared/admin-help";
import { AdminLongTextField } from "@/components/admin/shared/admin-long-text-field";
import { AdminLocaleTabs, useAdminActiveLocale, type AdminLocale, type AdminLocaleStatus } from "@/components/admin/shared/admin-locale-workspace";
import { localeOfFirstError } from "@/components/admin/shared/admin-locale-panel";
import { AdminIssueInlineWarning } from "@/components/admin/issues/admin-issues-cms";
import type { AdminIssueSummary } from "@/components/admin/shared/admin-issue-types";
import { ImageFileField } from "@/components/admin/shared/image-file-field";
import { slugify } from "@/lib/text/slug";
import { ShopifyCategoryField } from "@/components/admin/products/shopify-category-field";
import { PRODUCT_CHARACTERISTICS, PRODUCT_CHARACTERISTIC_GROUPS } from "@/lib/products/characteristics";
import {
  PRODUCT_FIELD_MESSAGES,
  type ProductFieldName,
} from "@/lib/products/product-form-validation";
import { getProductEditorDetails, issuesForField } from "@/components/admin/products/product-helpers";
import type { CollectionOption, ProductDraft, ProductLocaleDetailsDraft } from "@/components/admin/products/product-types";

export function OwnershipLabel({ children, owner }: { children: React.ReactNode; owner: "Shopify" | "Synarava" | "Shopify push" }) {
  return (
    <span data-component="OwnershipLabel" className="adm-label flex items-center justify-between gap-2">
      <span>{children}</span>
      <span className={owner === "Shopify" ? "text-[var(--adm-accent)]" : "text-[var(--adm-subtle)]"}>{owner}</span>
    </span>
  );
}

// Maps a locale + field key to the exact FormData field name the server
// action already reads: EN uses the bare key, any other locale prefixes it
// and capitalizes it ("materialsEyebrow" -> "ptMaterialsEyebrow"). Matches
// the convention used by page-editor-form.tsx and collection-fields.tsx.
function localizedFieldName(locale: AdminLocale, key: string): string {
  if (locale === "EN") return key;
  return `${locale.toLowerCase()}${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

type ProductDetailsSource = {
  materialsEyebrow: string;
  materialsTitle: string;
  materials: Array<{ title: string; body: string }>;
  process: { eyebrow: string; title: string; stats: Array<{ value: string; label: string }> };
  lookbookEyebrow: string;
  lookbookTitle: string;
  lookbook: Array<{ label: string }>;
};

type ProductDetailsLocaleDraft = {
  materialsEyebrow: string;
  materialsTitle: string;
  materials: Array<{ title: string; body: string }>;
  processEyebrow: string;
  processTitle: string;
  processStats: Array<{ value: string; label: string }>;
  lookbookEyebrow: string;
  lookbookTitle: string;
  lookbookLabels: string[];
};

function detailsDraftFrom(source: ProductDetailsSource): ProductDetailsLocaleDraft {
  return {
    materialsEyebrow: source.materialsEyebrow,
    materialsTitle: source.materialsTitle,
    materials: source.materials.map((material) => ({ title: material.title, body: material.body })),
    processEyebrow: source.process.eyebrow,
    processTitle: source.process.title,
    processStats: source.process.stats.map((stat) => ({ value: stat.value, label: stat.label })),
    lookbookEyebrow: source.lookbookEyebrow,
    lookbookTitle: source.lookbookTitle,
    lookbookLabels: source.lookbook.map((item) => item.label),
  };
}

// One physical field per concept (Materials eyebrow, Material 1 title, ...),
// not one copy per language: the field's *value* switches with the active
// locale tab. These always-rendered hidden mirrors carry both locales' real
// values on submit regardless of which tab is active. See
// components/admin/pages/page-editor-form.tsx for the same pattern.
function HiddenDetailsLocaleFields({ draftByLocale }: { draftByLocale: Record<AdminLocale, ProductDetailsLocaleDraft> }) {
  return (
    <div hidden>
      {(Object.keys(draftByLocale) as AdminLocale[]).flatMap((locale) => {
        const draft = draftByLocale[locale];
        const name = (key: string) => localizedFieldName(locale, key);
        const field = (key: string, value: string) => <input key={name(key)} type="hidden" readOnly name={name(key)} value={value} />;
        return [
          field("materialsEyebrow", draft.materialsEyebrow),
          field("materialsTitle", draft.materialsTitle),
          ...draft.materials.flatMap((material, index) => [
            field(`materialTitle${index + 1}`, material.title),
            field(`materialBody${index + 1}`, material.body),
          ]),
          field("processEyebrow", draft.processEyebrow),
          field("processTitle", draft.processTitle),
          ...draft.processStats.flatMap((stat, index) => [
            field(`processStatValue${index + 1}`, stat.value),
            field(`processStatLabel${index + 1}`, stat.label),
          ]),
          field("lookbookEyebrow", draft.lookbookEyebrow),
          field("lookbookTitle", draft.lookbookTitle),
          ...draft.lookbookLabels.map((label, index) => field(`lookbookLabel${index + 1}`, label)),
        ];
      })}
    </div>
  );
}

export function ProductDetailFields({
  details,
  ptDetails,
  sku,
  mode,
  issues = [],
  collections,
  entityId,
}: {
  details: ReturnType<typeof getProductEditorDetails>;
  ptDetails: ProductLocaleDetailsDraft;
  sku: string;
  mode: "create" | "edit";
  issues?: AdminIssueSummary[];
  collections: CollectionOption[];
  /** Existing persisted product only — omit while creating a new one. */
  entityId?: string;
}) {
  const departmentCollections = collections
    .filter((collection) => collection.isPrimaryNav)
    .sort((a, b) => a.navSortOrder - b.navSortOrder);
  const [detailsLocale, selectDetailsLocale] = useAdminActiveLocale(`product-details:${sku || "new"}`, "EN");
  const [draftByLocale, setDraftByLocale] = useState<Record<AdminLocale, ProductDetailsLocaleDraft>>(() => ({
    EN: detailsDraftFrom(details),
    PT: detailsDraftFrom(ptDetails),
  }));
  const draft = draftByLocale[detailsLocale];
  const isEn = detailsLocale === "EN";

  function updateField<K extends keyof ProductDetailsLocaleDraft>(key: K, value: ProductDetailsLocaleDraft[K]) {
    setDraftByLocale((prev) => ({ ...prev, [detailsLocale]: { ...prev[detailsLocale], [key]: value } }));
  }

  function updateMaterial(index: number, key: "title" | "body", value: string) {
    setDraftByLocale((prev) => {
      const materials = [...prev[detailsLocale].materials];
      materials[index] = { ...materials[index], [key]: value };
      return { ...prev, [detailsLocale]: { ...prev[detailsLocale], materials } };
    });
  }

  function updateProcessStat(index: number, key: "value" | "label", value: string) {
    setDraftByLocale((prev) => {
      const processStats = [...prev[detailsLocale].processStats];
      processStats[index] = { ...processStats[index], [key]: value };
      return { ...prev, [detailsLocale]: { ...prev[detailsLocale], processStats } };
    });
  }

  function updateLookbookLabel(index: number, value: string) {
    setDraftByLocale((prev) => {
      const lookbookLabels = [...prev[detailsLocale].lookbookLabels];
      lookbookLabels[index] = value;
      return { ...prev, [detailsLocale]: { ...prev[detailsLocale], lookbookLabels } };
    });
  }

  return (
    <div data-component="ProductDetailFields"
      className="grid gap-6 pt-5"
      style={{ borderTop: "1px solid var(--adm-border)" }}
    >
      <div>
        <p className="adm-label-row">
          <span className="adm-section-tag">[ SYNARAVA CMS LAYER ]</span>
          <AdminHelp>
            Extended content enriches the storefront without being erased by Shopify catalog pulls.
          </AdminHelp>
        </p>
        <p className="mt-2 text-xs text-[var(--adm-muted)]">Characteristics are mirrored to Shopify metafields. Editorial photography, materials, process, and lookbook remain managed by Synarava.</p>
      </div>

      <AdminLocaleTabs
        active={detailsLocale}
        onSelect={selectDetailsLocale}
        syncScope={entityId ? { entityType: "PRODUCT", entityId } : undefined}
      />
      <HiddenDetailsLocaleFields draftByLocale={draftByLocale} />

      {!isEn ? (
        <p className="text-xs text-[var(--adm-muted)]">
          Optional — blank fields show the English text to Portuguese visitors instead. Images stay
          shared with English and are not repeated here.
        </p>
      ) : null}

      <section
        className="grid gap-4 p-4"
        style={{ border: "1px solid var(--adm-border)" }}
      >
        <div>
          <p className="adm-label-row">
            <span className="adm-label">Department &amp; characteristics</span>
            <AdminHelp>
              Department drives the top-level shop navigation. Characteristics adapt the same
              product page to jewelry, pet accessories, kids products, and jewelry-making supplies.
            </AdminHelp>
          </p>
        </div>

        <label className="grid gap-2 md:max-w-sm">
          <span className="adm-label">Department</span>
          <select name="department" defaultValue={details.department} className="adm-field">
            <option value="">No department</option>
            {departmentCollections.map((department) => (
              <option key={department.slug} value={department.slug}>
                {department.name}
              </option>
            ))}
          </select>
        </label>

        {PRODUCT_CHARACTERISTIC_GROUPS.map((group) => (
          <fieldset key={group} className="grid gap-3 border-t pt-4" style={{ borderColor: "var(--adm-border)" }}>
            <legend className="adm-section-tag px-2">{group}</legend>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {PRODUCT_CHARACTERISTICS.filter((item) => item.group === group).map((definition) => {
                const current = details.characteristics[definition.key] ?? { value: definition.type === "BOOLEAN" ? false : "", certificateUrl: "" };
                const name = `characteristic_${definition.key}`;
                if (definition.type === "BOOLEAN") {
                  return (
                    <div key={definition.key} className="grid content-start gap-2 border p-3" style={{ borderColor: "var(--adm-border)" }}>
                      <label className="flex items-center gap-3 text-sm">
                        <input type="checkbox" name={name} defaultChecked={Boolean(current.value)} />
                        <span>{definition.label}</span>
                      </label>
                      {"certificate" in definition ? (
                        <input name={`${name}_certificate`} defaultValue={current.certificateUrl} className="adm-field" placeholder="Certificate URL" type="url" />
                      ) : null}
                    </div>
                  );
                }
                const input = (
                  "multiline" in definition && definition.multiline
                    ? <textarea name={name} defaultValue={String(current.value)} className="adm-field min-h-24" rows={3} />
                    : <input name={name} defaultValue={String(current.value)} className="adm-field min-w-0 flex-1" type={definition.type === "NUMBER" ? "number" : "text"} step={definition.type === "NUMBER" ? "0.01" : undefined} />
                );
                return (
                  <label key={definition.key} className="grid gap-2">
                    <span className="adm-label">{definition.label}</span>
                    <span className={"multiline" in definition && definition.multiline ? "grid" : "flex"}>
                      {input}
                      {"unit" in definition ? <span className="flex items-center border border-l-0 px-3 text-xs text-[var(--adm-muted)]" style={{ borderColor: "var(--adm-border)" }}>{definition.unit}</span> : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </section>

      {/* Materials */}
      <section
        className="grid gap-4 p-4"
        style={{ border: "1px solid var(--adm-border)" }}
      >
        <div>
          <p className="adm-label-row">
            <span className="adm-label">Materials</span>
            <AdminHelp>Three material cards shown on the storefront product detail page.</AdminHelp>
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={draft.materialsEyebrow}
            onChange={(event) => updateField("materialsEyebrow", event.target.value)}
            placeholder="Section eyebrow"
            className="adm-field"
          />
          <input
            value={draft.materialsTitle}
            onChange={(event) => updateField("materialsTitle", event.target.value)}
            placeholder="Section title"
            className="adm-field"
          />
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {details.materials.map((material, index) => (
            <div
              key={`material-${index}`}
              id={`field-details-materials-${index}-image`}
              className="grid gap-3 p-4"
              style={{ border: "1px solid var(--adm-border)" }}
            >
              <p className="adm-section-tag">MATERIAL {index + 1}</p>
              <AdminIssueInlineWarning issues={issuesForField(issues, `field-details-materials-${index}-image`)} />
              <input
                value={draft.materials[index].title}
                onChange={(event) => updateMaterial(index, "title", event.target.value)}
                placeholder="Lava Stone"
                className="adm-field"
              />
              <textarea
                rows={4}
                value={draft.materials[index].body}
                onChange={(event) => updateMaterial(index, "body", event.target.value)}
                placeholder="Describe the material story."
                className="adm-field"
              />
              {/* Image is shared across locales and always visible. */}
              <input
                type="hidden"
                name={`existingMaterialImage${index + 1}`}
                value={material.image}
              />
              <ImageFileField
                name={`materialImageFile${index + 1}`}
                currentImageUrl={mode === "edit" ? material.image : ""}
                currentImageAlt={draft.materials[index].title || `Material ${index + 1}`}
                removeFieldName={`removeMaterialImage${index + 1}`}
                removeLabel="Remove"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Process */}
      <section
        className="grid gap-4 p-4"
        style={{ border: "1px solid var(--adm-border)" }}
      >
        <div>
          <p className="adm-label-row">
            <span className="adm-label">Process</span>
            <AdminHelp>Craftsmanship section with media and stats.</AdminHelp>
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={draft.processEyebrow}
            onChange={(event) => updateField("processEyebrow", event.target.value)}
            placeholder="Process"
            className="adm-field"
          />
          <input
            value={draft.processTitle}
            onChange={(event) => updateField("processTitle", event.target.value)}
            placeholder="Human Precision"
            className="adm-field"
          />
        </div>
        {/* Media is shared across locales and always visible. */}
        <input
          type="hidden"
          name="existingProcessMediaImage"
          value={details.process.mediaImage}
        />
        <ImageFileField
          name="processMediaImageFile"
          currentImageUrl={mode === "edit" ? details.process.mediaImage : ""}
          currentImageAlt={draft.processTitle || "Process media"}
          currentImageLabel="Current process media"
          previewAspect="video"
          fieldId="field-details-process-mediaImage"
          removeFieldName="removeProcessMediaImage"
          removeLabel="Remove"
        />
        <AdminIssueInlineWarning issues={issuesForField(issues, "field-details-process-mediaImage")} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {draft.processStats.map((stat, index) => (
            <div
              key={`process-stat-${index}`}
              className="grid gap-3 p-3"
              style={{ border: "1px solid var(--adm-border)" }}
            >
              <p className="adm-section-tag">STAT {index + 1}</p>
              <input
                value={stat.value}
                onChange={(event) => updateProcessStat(index, "value", event.target.value)}
                placeholder="12"
                className="adm-field"
              />
              <input
                value={stat.label}
                onChange={(event) => updateProcessStat(index, "label", event.target.value)}
                placeholder="Hours of weaving"
                className="adm-field"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Lookbook */}
      <section
        className="grid gap-4 p-4"
        style={{ border: "1px solid var(--adm-border)" }}
      >
        <div>
          <p className="adm-label-row">
            <span className="adm-label">Lookbook</span>
            <AdminHelp>Gallery blocks used in the pairing guide and lookbook section.</AdminHelp>
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={draft.lookbookEyebrow}
            onChange={(event) => updateField("lookbookEyebrow", event.target.value)}
            placeholder="Section eyebrow"
            className="adm-field"
          />
          <input
            value={draft.lookbookTitle}
            onChange={(event) => updateField("lookbookTitle", event.target.value)}
            placeholder="Section title"
            className="adm-field"
          />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {details.lookbook.map((item, index) => (
            <div
              key={`lookbook-${index}`}
              id={`field-details-lookbook-${index}-src`}
              className="grid gap-3 p-4"
              style={{ border: "1px solid var(--adm-border)" }}
            >
              <AdminIssueInlineWarning issues={issuesForField(issues, `field-details-lookbook-${index}-src`)} />
              <div className="flex items-center justify-between gap-3">
                <p className="adm-section-tag">LOOKBOOK {index + 1}</p>
                {/* Featured is shared across locales and always visible. */}
                <label
                  className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.08em] cursor-pointer"
                  style={{ color: "var(--adm-muted)" }}
                >
                  <input
                    type="checkbox"
                    name={`lookbookFeatured${index + 1}`}
                    defaultChecked={item.featured}
                  />
                  Featured
                </label>
              </div>
              <input
                value={draft.lookbookLabels[index] ?? ""}
                onChange={(event) => updateLookbookLabel(index, event.target.value)}
                placeholder="01 / The Ensemble"
                className="adm-field"
              />
              {/* Image is shared across locales and always visible. */}
              <input
                type="hidden"
                name={`existingLookbookImage${index + 1}`}
                value={item.src}
              />
              <ImageFileField
                name={`lookbookImageFile${index + 1}`}
                currentImageUrl={mode === "edit" ? item.src : ""}
                currentImageAlt={draft.lookbookLabels[index] || `Lookbook ${index + 1}`}
                removeFieldName={`removeLookbookImage${index + 1}`}
                removeLabel="Remove"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

type ProductCoreLocaleDraft = {
  shortDescription: string;
  description: string;
  materialLine: string;
  symbolismLabel: string;
  symbolismTitle: string;
  symbolismBody: string;
  symbolismBody2: string;
  seoTitle: string;
  seoDescription: string;
};

function coreDraftFrom(source: ProductCoreLocaleDraft): ProductCoreLocaleDraft {
  return {
    shortDescription: source.shortDescription,
    description: source.description,
    materialLine: source.materialLine,
    symbolismLabel: source.symbolismLabel,
    symbolismTitle: source.symbolismTitle,
    symbolismBody: source.symbolismBody,
    symbolismBody2: source.symbolismBody2,
    seoTitle: source.seoTitle,
    seoDescription: source.seoDescription,
  };
}

// Same one-field-per-concept pattern as HiddenDetailsLocaleFields above.
// Product name/title is NOT included here — it keeps its own duplicated
// EN/PT fields (see the comment above the "Name" field below) because it's
// wired into useAdminFormValidation's native-DOM constraint-validation scan,
// which requires the real, currently-required "name" input to always be a
// non-hidden, named element for the browser to flag it when empty.
function HiddenCoreLocaleFields({ draftByLocale }: { draftByLocale: Record<AdminLocale, ProductCoreLocaleDraft> }) {
  return (
    <div hidden>
      {(Object.keys(draftByLocale) as AdminLocale[]).flatMap((locale) => {
        const draft = draftByLocale[locale];
        const name = (key: string) => localizedFieldName(locale, key);
        const field = (key: keyof ProductCoreLocaleDraft) => <input key={name(key)} type="hidden" readOnly name={name(key)} value={draft[key]} />;
        return [
          field("shortDescription"),
          field("description"),
          field("materialLine"),
          field("symbolismLabel"),
          field("symbolismTitle"),
          field("symbolismBody"),
          field("symbolismBody2"),
          field("seoTitle"),
          field("seoDescription"),
        ];
      })}
    </div>
  );
}

export function ProductFormFields({
  draft,
  entityId,
  collections,
  variantExists = false,
  issues = [],
  validation,
}: {
  draft: ProductDraft;
  entityId?: string;
  collections: CollectionOption[];
  variantExists?: boolean;
  issues?: AdminIssueSummary[];
  validation: AdminFormValidation<ProductFieldName>;
}) {
  const { fieldErrors } = validation;
  const [nameValue, setNameValue] = useState(draft.name);
  const [ptTitleValue, setPtTitleValue] = useState(draft.pt.title);
  const [slugValue, setSlugValue] = useState(draft.slug);
  const [slugLocked, setSlugLocked] = useState(Boolean(draft.slug));
  const [activeLocale, selectLocale] = useAdminActiveLocale(`product:${draft.sku || "new"}`, "EN");
  const [draftByLocale, setDraftByLocale] = useState<Record<AdminLocale, ProductCoreLocaleDraft>>(() => ({
    EN: coreDraftFrom(draft),
    PT: coreDraftFrom(draft.pt),
  }));
  const coreDraft = draftByLocale[activeLocale];
  const isEn = activeLocale === "EN";

  useEffect(() => {
    // Fixes a real bug: the required "Name" field sits inside a `hidden`
    // ancestor while the PT tab is active, so a browser (and jsdom) skips it
    // during native constraint validation — a save attempted from the PT tab
    // with a blank required EN field reported no visible error until this
    // forced the EN tab back open. See admin-locale-panel.tsx / Task 4.
    const forced = localeOfFirstError(fieldErrors);
    if (forced) selectLocale(forced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldErrors]);

  function updateName(value: string) {
    setNameValue(value);
    if (!slugLocked) {
      setSlugValue(slugify(value));
    }
  }

  function updateSlug(value: string) {
    if (!value.trim()) {
      setSlugValue(slugify(nameValue));
      setSlugLocked(false);
      return;
    }

    setSlugValue(value);
    setSlugLocked(true);
  }

  function updateCore<K extends keyof ProductCoreLocaleDraft>(key: K, value: ProductCoreLocaleDraft[K]) {
    setDraftByLocale((prev) => ({ ...prev, [activeLocale]: { ...prev[activeLocale], [key]: value } }));
  }

  return (
    <>
      <div className="flex flex-col gap-2 border border-[var(--adm-border)] bg-[var(--adm-bg-soft)] p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="adm-section-tag">[ SHOPIFY COMMERCE CORE ]</p>
          <p className="mt-2 text-xs text-[var(--adm-muted)]">Every field is labelled by owner. Shopify fields form the sellable product; Synarava fields enrich it without being overwritten by catalog pulls.</p>
        </div>
        <span className="adm-badge-published w-fit">Shopify-backed</span>
      </div>

      <AdminLocaleTabs
        active={activeLocale}
        onSelect={selectLocale}
        ptStatus={draft.pt.syncStatus as AdminLocaleStatus}
        syncScope={entityId ? { entityType: "PRODUCT", entityId } : undefined}
      />
      <HiddenCoreLocaleFields draftByLocale={draftByLocale} />

      {!isEn ? (
        <div className="border border-[var(--adm-border)] bg-[var(--adm-bg-soft)] p-4">
          <p className="adm-section-tag">[ PT — PORTUGUÊS ]</p>
          <p className="mt-2 text-xs text-[var(--adm-muted)]">
            Optional — publishing never blocks on this. Whatever is left blank here shows the English text
            to Portuguese visitors instead, until it&apos;s filled in.
          </p>
          {draft.pt.syncError ? (
            <p className="mt-2 text-xs text-[var(--adm-danger)]">{draft.pt.syncError}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid items-start gap-4 md:grid-cols-2">
        {/*
          The Name field is the one exception to "single field per concept"
          in this form: it stays duplicated (this EN input plus the PT one
          further down) because useAdminFormValidation's native constraint
          scan (collectNativeFieldErrors) only detects a blank *required*
          field when that field is a real, named, non-hidden DOM node. A
          type="hidden" mirror can never satisfy `required` (the HTML spec
          excludes hidden inputs from constraint validation entirely), so
          collapsing Name into a locale-switching value here would silently
          break the existing Task 4 empty-name-while-on-PT-tab protection
          below. Every other localized field here has no `required`
          attribute and safely uses the single-field pattern.
        */}
        <div className="grid content-start gap-2" hidden={activeLocale !== "EN"}>
          <label htmlFor={validation.fieldId("name")}>
            <OwnershipLabel owner="Shopify">Name *</OwnershipLabel>
          </label>
          <input
            name="name"
            required
            data-validation-message={PRODUCT_FIELD_MESSAGES.name}
            value={nameValue}
            onChange={(event) => updateName(event.target.value)}
            {...validation.fieldProps("name")}
            className={fieldErrors.name ? "adm-field adm-field--error" : "adm-field"}
          />
          <AdminFieldError id={validation.fieldErrorId("name")} message={fieldErrors.name} />
        </div>
        <label className="grid content-start gap-2" hidden={activeLocale !== "PT"}>
          <span className="adm-label">Product name (PT)</span>
          <input name="ptTitle" value={ptTitleValue} onChange={(event) => setPtTitleValue(event.target.value)} className="adm-field" />
        </label>
        <div className="grid content-start gap-2">
          <label htmlFor={validation.fieldId("slug")}>
            <OwnershipLabel owner="Shopify">Slug *</OwnershipLabel>
          </label>
          <input
            name="slug"
            required
            data-validation-message={PRODUCT_FIELD_MESSAGES.slug}
            value={slugValue}
            onChange={(event) => updateSlug(event.target.value)}
            {...validation.fieldProps("slug")}
            className={fieldErrors.slug ? "adm-field adm-field--error" : "adm-field"}
          />
          <AdminFieldError id={validation.fieldErrorId("slug")} message={fieldErrors.slug} />
        </div>
      </div>

      {!isEn ? (
        <label className="grid gap-2">
          <span className="adm-label">URL handle (PT, optional)</span>
          <input name="ptHandle" defaultValue={draft.pt.localizedHandle} className="adm-field" placeholder={draft.slug} />
          <span className="text-xs text-[var(--adm-muted)]">Blank uses the English slug.</span>
        </label>
      ) : null}

      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="grid content-start gap-2">
          <label htmlFor={validation.fieldId("sku")}>
            <OwnershipLabel owner="Shopify">SKU *</OwnershipLabel>
          </label>
          <input
            name="sku"
            required
            data-validation-message={PRODUCT_FIELD_MESSAGES.sku}
            defaultValue={draft.sku}
            {...validation.fieldProps("sku")}
            className={fieldErrors.sku ? "adm-field adm-field--error" : "adm-field"}
          />
          <AdminFieldError id={validation.fieldErrorId("sku")} message={fieldErrors.sku} />
        </div>
        <label className="grid content-start gap-2">
          <OwnershipLabel owner="Synarava">Series label</OwnershipLabel>
          <input name="seriesLabel" defaultValue={draft.seriesLabel} className="adm-field" />
        </label>
        <div className="grid content-start gap-2">
          <label htmlFor={validation.fieldId("price")}>
            <OwnershipLabel owner="Shopify">Price EUR *</OwnershipLabel>
          </label>
          <input
            name="price"
            type="number"
            required
            min="0.01"
            step="0.01"
            inputMode="decimal"
            data-validation-message={PRODUCT_FIELD_MESSAGES.price}
            defaultValue={draft.price}
            {...validation.fieldProps("price")}
            className={fieldErrors.price ? "adm-field adm-field--error" : "adm-field"}
          />
          <AdminFieldError id={validation.fieldErrorId("price")} message={fieldErrors.price} />
        </div>
        <label className="grid content-start gap-2">
          <OwnershipLabel owner="Shopify">Available quantity</OwnershipLabel>
          <input name="stockOnHand" type="number" min="0" step="1" inputMode="numeric" defaultValue={draft.stockOnHand} className="adm-field" />
          <span className="text-xs text-[var(--adm-subtle)]">{variantExists ? "Primary variant inventory synced with Shopify." : "No variant record yet. Enter quantity and save to create the primary variant."}</span>
        </label>
      </div>

      {/* Vendor/brand and Product type are shared across locales — always visible, no PT counterpart. */}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <OwnershipLabel owner="Shopify">Vendor / brand</OwnershipLabel>
          <input name="vendor" defaultValue={draft.vendor} className="adm-field" />
        </label>
        <label className="grid gap-2">
          <OwnershipLabel owner="Shopify">Product type</OwnershipLabel>
          <input name="productType" defaultValue={draft.productType} className="adm-field" />
        </label>
      </div>

      <AdminLongTextField
        label={<OwnershipLabel owner="Synarava">Short description</OwnershipLabel>}
        dialogLabel="Short description"
        value={coreDraft.shortDescription}
        onChange={(value) => updateCore("shortDescription", value)}
        rows={8}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <OwnershipLabel owner="Shopify">SEO title</OwnershipLabel>
          <input value={coreDraft.seoTitle} onChange={(event) => updateCore("seoTitle", event.target.value)} className="adm-field" />
        </label>
        <AdminLongTextField
          label={<OwnershipLabel owner="Shopify">SEO description</OwnershipLabel>}
          dialogLabel="SEO description"
          value={coreDraft.seoDescription}
          onChange={(value) => updateCore("seoDescription", value)}
          rows={7}
        />
      </div>

      <AdminLongTextField
        label={<OwnershipLabel owner="Shopify">Description</OwnershipLabel>}
        dialogLabel="Description"
        value={coreDraft.description}
        onChange={(value) => updateCore("description", value)}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <OwnershipLabel owner="Synarava">Material line</OwnershipLabel>
          <input value={coreDraft.materialLine} onChange={(event) => updateCore("materialLine", event.target.value)} className="adm-field" />
        </label>
        <div id="field-imageUrl" className="grid content-start gap-2 border border-[var(--adm-border)] bg-[var(--adm-bg-soft)] p-4">
          <OwnershipLabel owner="Shopify">Catalog cover</OwnershipLabel>
          <AdminIssueInlineWarning issues={issuesForField(issues, "field-imageUrl")} />
          <input type="hidden" name="existingImageUrl" value={draft.imageUrl} />
          <input type="hidden" name="removeImage" value="0" />
          <span className="text-xs leading-5 text-[var(--adm-subtle)]">Managed by Product gallery below. The first image is the catalog cover and is sent first to Shopify.</span>
        </div>
      </div>

      {/* Symbolism */}
      <div
        className="grid gap-4 pt-4"
        style={{ borderTop: "1px solid var(--adm-border)" }}
      >
        <div>
          <p className="adm-label-row">
            <span className="adm-section-tag">[ PRODUCT SYMBOLISM OVERRIDE ]</span>
            <AdminHelp>If empty, the symbolism section stays hidden on the product page.</AdminHelp>
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={coreDraft.symbolismLabel}
            onChange={(event) => updateCore("symbolismLabel", event.target.value)}
            placeholder="Symbolic Language"
            className="adm-field"
          />
          <input
            value={coreDraft.symbolismTitle}
            onChange={(event) => updateCore("symbolismTitle", event.target.value)}
            placeholder="Wood, Lava, Embroidery"
            className="adm-field"
          />
        </div>
        <AdminLongTextField label={<span className="adm-label">Symbolism body</span>} dialogLabel="Symbolism body" value={coreDraft.symbolismBody} onChange={(value) => updateCore("symbolismBody", value)} />
        <AdminLongTextField label={<span className="adm-label">Symbolism continuation</span>} dialogLabel="Symbolism continuation" value={coreDraft.symbolismBody2} onChange={(value) => updateCore("symbolismBody2", value)} rows={8} />
      </div>

      {!isEn ? (
        <label className="flex items-center gap-3 border-t border-[var(--adm-border)] pt-4 text-sm">
          <input type="checkbox" name="ptReviewed" defaultChecked={draft.pt.reviewed} />
          <span>Portuguese translation reviewed</span>
        </label>
      ) : null}

      {/* Taxonomy + state */}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div id="field-taxonomy-category" className="grid content-start gap-2">
          <div className="adm-label-row">
            <OwnershipLabel owner="Shopify">Product category</OwnershipLabel>
            <AdminHelp>
              This is the exact Shopify Standard Product Taxonomy category. Its Shopify ID powers
              the Category section and filter on the storefront; Collections and Departments are
              separate merchandising groups.
            </AdminHelp>
          </div>
          <AdminIssueInlineWarning issues={issuesForField(issues, "field-taxonomy-category")} />
          <ShopifyCategoryField
            initialId={draft.shopifyCategoryId}
            initialName={draft.shopifyCategoryName}
          />
        </div>
        <div id="field-taxonomy-collection" className="grid content-start gap-2">
          <OwnershipLabel owner="Synarava">Collection</OwnershipLabel>
          <AdminIssueInlineWarning issues={issuesForField(issues, "field-taxonomy-collection")} />
          <select name="collectionSlug" defaultValue={draft.collectionSlug} className="adm-field">
            <option value="">No collection</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.slug}>
                {collection.name}
              </option>
            ))}
          </select>
        </div>
        <div id="field-taxonomy-tags" className="grid content-start gap-2">
          <OwnershipLabel owner="Shopify push">Tags</OwnershipLabel>
          <AdminIssueInlineWarning issues={issuesForField(issues, "field-taxonomy-tags")} />
          <input
            name="tags"
            defaultValue={draft.tags}
            placeholder="lava, heritage, symbolic"
            className="adm-field"
          />
        </div>
      </div>

      <label className="grid gap-2 md:max-w-xs">
        <OwnershipLabel owner="Shopify">Storefront state</OwnershipLabel>
        <select name="workflowState" defaultValue={draft.workflowState} className="adm-field">
          <option value="DRAFT">Draft — hidden</option>
          <option value="PUBLISHED">Published — visible</option>
          <option value="UNLISTED">Unlisted — direct link only</option>
        </select>
      </label>
    </>
  );
}
