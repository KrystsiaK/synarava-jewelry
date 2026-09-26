"use client";

import { useEffect, useRef, useState } from "react";

import {
  type AdminFormValidation,
} from "@/components/admin/shared/admin-form-validation";
import { localeOfFirstError } from "@/components/admin/shared/admin-locale-panel";
import { AdminFieldIssue } from "@/components/admin/issues/admin-issues-cms";
import type { AdminIssueSummary } from "@/components/admin/shared/admin-issue-types";
import { ImageFileField } from "@/components/admin/shared/image-file-field";
import {
  AdminCheckboxControl,
  AdminFieldShell,
  AdminHelp,
  AdminLongTextField,
  AdminSelectField,
  AdminTextField,
} from "@/components/synarava-cms";
import { slugify } from "@/lib/text/slug";
import { adminLocaleFieldName } from "@/lib/i18n/admin-locale-fields";
import type { AdminTranslationLocale } from "@/lib/i18n/admin-translation-locales";
import {
  ShopifyCategoryAttributes,
  ShopifyCategoryControl,
  ShopifyCategoryField,
} from "@/components/admin/products/shopify-category-field";
import { ShopifyOrganizationSuggestField } from "@/components/admin/products/shopify-organization-suggest-field";
import { ShopifyProductFactsPanel } from "@/components/admin/products/shopify-product-facts";
import { ProductPassportFields } from "@/components/admin/products/product-passport-fields";
import { ProductPriceFields } from "@/components/admin/products/product-price-fields";
import {
  ProductInventoryFields,
  type InventoryShippingFacts,
} from "@/components/admin/products/product-inventory-fields";
import type { ProductEditorSection } from "@/components/admin/products/product-editor-tabs";
import type { ProductCharacteristicValue } from "@/lib/products/characteristics";
import {
  PRODUCT_FIELD_MESSAGES,
  type ProductFieldName,
} from "@/lib/products/product-form-validation";
import { getProductEditorDetails, issuesForField, taxonomySatisfactionFromDraft } from "@/components/admin/products/product-helpers";
import type { TaxonomySatisfaction } from "@/components/admin/products/product-helpers";
import type { CollectionOption, ProductDraft, ProductLocaleDetailsDraft } from "@/components/admin/products/product-types";
import {
  collectionSelectOptionLabel,
  filterCollectionsForProductSelect,
} from "@/lib/admin/collection-select-options";
import type { ShopifyCategoryAttributeSelection } from "@/lib/shopify/category-attribute-values";
import { extractShopifyProductFacts } from "@/lib/shopify/product-facts";

export { OwnershipLabel } from "@/components/synarava-cms";

const SOURCE_LOCALE = "en";
const DEFAULT_TRANSLATION_LOCALES: AdminTranslationLocale[] = [{ code: "pt", label: "Português" }];

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

const EMPTY_DETAILS_SOURCE: ProductDetailsSource = {
  materialsEyebrow: "", materialsTitle: "", materials: [],
  process: { eyebrow: "", title: "", stats: [] },
  lookbookEyebrow: "", lookbookTitle: "", lookbook: [],
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
// locale tab. These always-rendered hidden mirrors carry every locale's real
// values on submit regardless of which tab is active. See
// components/admin/pages/page-editor-form.tsx for the same pattern.
function HiddenDetailsLocaleFields({ draftByLocale }: { draftByLocale: Record<string, ProductDetailsLocaleDraft> }) {
  return (
    <div hidden>
      {Object.keys(draftByLocale).flatMap((locale) => {
        const draft = draftByLocale[locale];
        const name = (key: string) => adminLocaleFieldName(locale, key, SOURCE_LOCALE);
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
  translationsDetails,
  mode,
  issues = [],
  collections,
  translationLocales = DEFAULT_TRANSLATION_LOCALES,
  activeSection = "details",
  activeLocale,
  shopifyLinked = false,
  shopifySnapshot = null,
  shopifyCategoryName = "",
  vendor = "",
  productType = "",
  characteristicValues = [],
}: {
  details: ReturnType<typeof getProductEditorDetails>;
  /** Every translation locale's details, keyed by locale code. */
  translationsDetails: Record<string, ProductLocaleDetailsDraft>;
  mode: "create" | "edit";
  issues?: AdminIssueSummary[];
  collections: CollectionOption[];
  /** Every non-English locale to render a tab for. Defaults to Portuguese only, matching every editor's behavior before the registry drove this. */
  translationLocales?: AdminTranslationLocale[];
  /** Top-level product workspace section. Hidden fields stay mounted so one save still submits the whole record. */
  activeSection?: ProductEditorSection;
  /** Shared workspace locale from the product form shell. */
  activeLocale: string;
  shopifyLinked?: boolean;
  shopifySnapshot?: unknown;
  shopifyCategoryName?: string;
  vendor?: string;
  productType?: string;
  characteristicValues?: ProductCharacteristicValue[];
}) {
  const [draftByLocale, setDraftByLocale] = useState<Record<string, ProductDetailsLocaleDraft>>(() => ({
    [SOURCE_LOCALE]: detailsDraftFrom(details),
    ...Object.fromEntries(translationLocales.map(({ code }) => [code, detailsDraftFrom(translationsDetails[code] ?? EMPTY_DETAILS_SOURCE)])),
  }));
  const draft = draftByLocale[activeLocale] ?? draftByLocale[SOURCE_LOCALE];
  const isEn = activeLocale === SOURCE_LOCALE;
  const shopifyFacts = extractShopifyProductFacts({
    snapshot: shopifySnapshot,
    shopifyCategoryName,
    vendor,
    productType,
    characteristics: characteristicValues,
  });

  function updateField<K extends keyof ProductDetailsLocaleDraft>(key: K, value: ProductDetailsLocaleDraft[K]) {
    setDraftByLocale((prev) => ({ ...prev, [activeLocale]: { ...prev[activeLocale], [key]: value } }));
  }

  function updateMaterial(index: number, key: "title" | "body", value: string) {
    setDraftByLocale((prev) => {
      const materials = [...prev[activeLocale].materials];
      materials[index] = { ...materials[index], [key]: value };
      return { ...prev, [activeLocale]: { ...prev[activeLocale], materials } };
    });
  }

  function updateProcessStat(index: number, key: "value" | "label", value: string) {
    setDraftByLocale((prev) => {
      const processStats = [...prev[activeLocale].processStats];
      processStats[index] = { ...processStats[index], [key]: value };
      return { ...prev, [activeLocale]: { ...prev[activeLocale], processStats } };
    });
  }

  function updateLookbookLabel(index: number, value: string) {
    setDraftByLocale((prev) => {
      const lookbookLabels = [...prev[activeLocale].lookbookLabels];
      lookbookLabels[index] = value;
      return { ...prev, [activeLocale]: { ...prev[activeLocale], lookbookLabels } };
    });
  }

  return (
    <div
      data-component="ProductDetailFields"
      className="grid gap-6"
      hidden={activeSection !== "essentials" && activeSection !== "details" && activeSection !== "passport"}
    >
      <div hidden={activeSection !== "details"}>
        <p className="adm-label-row">
          <span className="adm-section-tag">[ SYNARAVA CMS LAYER ]</span>
          <AdminHelp>
            Editorial product-page sections enrich the site. Shopify category and publish stay under Product; jewelry specs under Passport.
          </AdminHelp>
        </p>
        <p className="mt-2 text-xs text-[var(--adm-muted)]">
          Short description, symbolism, materials, process, and lookbook are Synarava-only.
          Shopify description and SEO live under Product.
        </p>
      </div>

      <HiddenDetailsLocaleFields draftByLocale={draftByLocale} />

      {!isEn && activeSection === "details" ? (
        <p className="text-xs text-[var(--adm-muted)]">
          Optional — blank fields show the English text to visitors of this language instead. Images
          stay shared with English and are not repeated here.
        </p>
      ) : null}

      <div hidden={activeSection !== "essentials"} className="grid gap-4">
        <ShopifyProductFactsPanel facts={shopifyFacts} linked={shopifyLinked} />
      </div>

      <div hidden={activeSection !== "passport"} className="grid gap-4">
        <p className="adm-label-row">
          <span className="adm-section-tag">[ SYNARAVA PASSPORT ]</span>
          <AdminHelp>
            Jewelry core specs for the PDP and filters. Save, then Push as synarava.* metafields.
            Arbitrary Shopify merchant fields stay on Metafields.
          </AdminHelp>
        </p>
        <ProductPassportFields characteristics={details.characteristics} />
      </div>

      {/* Materials */}
      <section
        className="grid gap-4 p-4"
        style={{ border: "1px solid var(--adm-border)" }}
        hidden={activeSection !== "details"}
      >
        <div>
          <p className="adm-label-row">
            <span className="adm-label">Materials</span>
            <AdminHelp>Three material cards shown on the site’s product detail page.</AdminHelp>
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <AdminTextField
            value={draft.materialsEyebrow}
            onChange={(event) => updateField("materialsEyebrow", event.target.value)}
            placeholder="Section eyebrow"
          />
          <AdminTextField
            value={draft.materialsTitle}
            onChange={(event) => updateField("materialsTitle", event.target.value)}
            placeholder="Section title"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {details.materials.map((material, index) => {
            const materialIssues = issuesForField(issues, `field-details-materials-${index}-image`);
            return (
            <div
              key={`material-${index}`}
              id={`field-details-materials-${index}-image`}
              className="adm-field-unit grid gap-3 p-4"
              style={{
                border: materialIssues.length > 0
                  ? "1px solid var(--adm-danger)"
                  : "1px solid var(--adm-border)",
                background: materialIssues.length > 0
                  ? "color-mix(in srgb, var(--adm-field) 92%, var(--adm-danger) 8%)"
                  : undefined,
              }}
            >
              <p className="adm-section-tag">MATERIAL {index + 1}</p>
              <div className="min-w-0">
                <AdminFieldIssue issues={materialIssues} />
              </div>
              <AdminTextField
                label="Title"
                value={draft.materials[index].title}
                onChange={(event) => updateMaterial(index, "title", event.target.value)}
                placeholder="Lava Stone"
              />
              <AdminLongTextField
                label="Story"
                dialogLabel={`Material ${index + 1} story`}
                value={draft.materials[index].body}
                onChange={(value) => updateMaterial(index, "body", value)}
                placeholder="Describe the material story."
                rows={4}
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
            );
          })}
        </div>
      </section>

      {/* Process */}
      <section
        className="grid gap-4 p-4"
        style={{ border: "1px solid var(--adm-border)" }}
        hidden={activeSection !== "details"}
      >
        <div>
          <p className="adm-label-row">
            <span className="adm-label">Process</span>
            <AdminHelp>Craftsmanship section with media and stats.</AdminHelp>
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <AdminTextField
            value={draft.processEyebrow}
            onChange={(event) => updateField("processEyebrow", event.target.value)}
            placeholder="Process"
          />
          <AdminTextField
            value={draft.processTitle}
            onChange={(event) => updateField("processTitle", event.target.value)}
            placeholder="Human Precision"
          />
        </div>
        <div className="adm-field-unit grid gap-3">
          {/* Media is shared across locales and always visible. */}
          <input
            type="hidden"
            name="existingProcessMediaImage"
            value={details.process.mediaImage}
          />
          {/* Wrapper keeps AdminFieldIssue out of the absolute `.adm-field-unit > .adm-field-error` band. */}
          <div className="min-w-0">
            <AdminFieldIssue issues={issuesForField(issues, "field-details-process-mediaImage")} />
          </div>
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
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {draft.processStats.map((stat, index) => (
            <div
              key={`process-stat-${index}`}
              className="grid gap-3 p-3"
              style={{ border: "1px solid var(--adm-border)" }}
            >
              <p className="adm-section-tag">STAT {index + 1}</p>
              <AdminTextField
                value={stat.value}
                onChange={(event) => updateProcessStat(index, "value", event.target.value)}
                placeholder="12"
              />
              <AdminTextField
                value={stat.label}
                onChange={(event) => updateProcessStat(index, "label", event.target.value)}
                placeholder="Hours of weaving"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Lookbook */}
      <section
        className="grid gap-4 p-4"
        style={{ border: "1px solid var(--adm-border)" }}
        hidden={activeSection !== "details"}
      >
        <div>
          <p className="adm-label-row">
            <span className="adm-label">Lookbook</span>
            <AdminHelp>Gallery blocks used in the pairing guide and lookbook section.</AdminHelp>
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <AdminTextField
            value={draft.lookbookEyebrow}
            onChange={(event) => updateField("lookbookEyebrow", event.target.value)}
            placeholder="Section eyebrow"
          />
          <AdminTextField
            value={draft.lookbookTitle}
            onChange={(event) => updateField("lookbookTitle", event.target.value)}
            placeholder="Section title"
          />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {details.lookbook.map((item, index) => {
            const lookbookIssues = issuesForField(issues, `field-details-lookbook-${index}-src`);
            return (
            <div
              key={`lookbook-${index}`}
              id={`field-details-lookbook-${index}-src`}
              className="adm-field-unit grid gap-3 p-4"
              style={{
                border: lookbookIssues.length > 0
                  ? "1px solid var(--adm-danger)"
                  : "1px solid var(--adm-border)",
                background: lookbookIssues.length > 0
                  ? "color-mix(in srgb, var(--adm-field) 92%, var(--adm-danger) 8%)"
                  : undefined,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="adm-section-tag">LOOKBOOK {index + 1}</p>
                {/* Featured is shared across locales and always visible. */}
                <AdminCheckboxControl
                  name={`lookbookFeatured${index + 1}`}
                  defaultChecked={item.featured}
                  label="Featured"
                  labelClassName="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--adm-muted)]"
                />
              </div>
              <div className="min-w-0">
                <AdminFieldIssue issues={lookbookIssues} />
              </div>
              <AdminTextField
                value={draft.lookbookLabels[index] ?? ""}
                onChange={(event) => updateLookbookLabel(index, event.target.value)}
                placeholder="01 / The Ensemble"
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
            );
          })}
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
// Product name/title is NOT included here — it keeps its own dedicated
// EN field (see the comment above the "Name" field below) because it's
// wired into useAdminFormValidation's native-DOM constraint-validation scan,
// which requires the real, currently-required "name" input to always be a
// non-hidden, named element for the browser to flag it when empty.
function HiddenCoreLocaleFields({ draftByLocale }: { draftByLocale: Record<string, ProductCoreLocaleDraft> }) {
  return (
    <div hidden>
      {Object.keys(draftByLocale).flatMap((locale) => {
        const draft = draftByLocale[locale];
        const name = (key: string) => adminLocaleFieldName(locale, key, SOURCE_LOCALE);
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
  collections,
  variantExists = false,
  inventoryFacts,
  issues = [],
  validation,
  translationLocales = DEFAULT_TRANSLATION_LOCALES,
  activeSection = "essentials",
  activeLocale,
  onLocaleChange,
  onTaxonomySatisfactionChange,
  selectedShopifyCategoryAttributes = [],
  mode = "edit",
}: {
  draft: ProductDraft;
  collections: CollectionOption[];
  variantExists?: boolean;
  /** Pull projections for Inventory tab shipping / location cards. */
  inventoryFacts?: InventoryShippingFacts;
  issues?: AdminIssueSummary[];
  validation: AdminFormValidation<ProductFieldName>;
  /** Every non-English locale to render a tab for. Defaults to Portuguese only, matching every editor's behavior before the registry drove this. */
  translationLocales?: AdminTranslationLocale[];
  /** Top-level product workspace section. All inputs remain mounted so switching tabs never drops unsaved values. */
  activeSection?: ProductEditorSection;
  /** Shared workspace locale from the product form shell. */
  activeLocale: string;
  /** Lets validation force the source locale open when a required English field fails. */
  onLocaleChange: (locale: string) => void;
  /** Keeps the section issue strip in sync when taxonomy fields are filled before Save. */
  onTaxonomySatisfactionChange?: (satisfaction: TaxonomySatisfaction) => void;
  /** Resolved Shopify category attribute values from the last pull snapshot. */
  selectedShopifyCategoryAttributes?: ShopifyCategoryAttributeSelection[];
  mode?: "create" | "edit";
}) {
  const { fieldErrors } = validation;
  const [nameValue, setNameValue] = useState(draft.name);
  const [titleByLocale, setTitleByLocale] = useState<Record<string, string>>(() =>
    Object.fromEntries(translationLocales.map(({ code }) => [code, draft.translations[code]?.title ?? ""])),
  );
  const [handleByLocale, setHandleByLocale] = useState<Record<string, string>>(() =>
    Object.fromEntries(translationLocales.map(({ code }) => [code, draft.translations[code]?.localizedHandle ?? ""])),
  );
  const [reviewedByLocale, setReviewedByLocale] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(translationLocales.map(({ code }) => [code, draft.translations[code]?.reviewed ?? false])),
  );
  const [slugValue, setSlugValue] = useState(draft.slug);
  const [slugLocked, setSlugLocked] = useState(Boolean(draft.slug));
  const [draftByLocale, setDraftByLocale] = useState<Record<string, ProductCoreLocaleDraft>>(() => ({
    [SOURCE_LOCALE]: coreDraftFrom(draft),
    ...Object.fromEntries(translationLocales.map(({ code }) => [code, coreDraftFrom(draft.translations[code] ?? draft)])),
  }));
  const taxonomySatisfactionRef = useRef(taxonomySatisfactionFromDraft(draft));
  const coreDraft = draftByLocale[activeLocale] ?? draftByLocale[SOURCE_LOCALE];
  const isEn = activeLocale === SOURCE_LOCALE;
  const activeLabel = translationLocales.find((locale) => locale.code === activeLocale)?.label
    ?? (isEn ? "English" : activeLocale);
  const activeTranslation = isEn ? null : draft.translations[activeLocale];
  const categoryIssues = issuesForField(issues, "field-taxonomy-category");
  const collectionIssues = issuesForField(issues, "field-taxonomy-collection");
  const tagsIssues = issuesForField(issues, "field-taxonomy-tags");

  function updateTaxonomySatisfaction(patch: Partial<TaxonomySatisfaction>) {
    const next = { ...taxonomySatisfactionRef.current, ...patch };
    taxonomySatisfactionRef.current = next;
    onTaxonomySatisfactionChange?.(next);
  }

  useEffect(() => {
    // Fixes a real bug: the required "Name" field sits inside a `hidden`
    // ancestor while a translation tab is active, so a browser (and jsdom)
    // skips it during native constraint validation — a save attempted from
    // a translation tab with a blank required EN field reported no visible
    // error until this forced the EN tab back open. See
    // admin-locale-panel.tsx / Task 4.
    const forced = localeOfFirstError(fieldErrors, translationLocales.map((locale) => locale.code));
    if (forced) onLocaleChange(forced);
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
      <HiddenCoreLocaleFields draftByLocale={draftByLocale} />

      {activeTranslation ? (
        <div className="border border-[var(--adm-border)] bg-[var(--adm-bg-soft)] p-4" hidden={activeSection !== "essentials" && activeSection !== "details"}>
          <p className="adm-section-tag">[ {activeLabel.toUpperCase()} ]</p>
          <p className="mt-2 text-xs text-[var(--adm-muted)]">
            Optional — publishing never blocks on this. Whatever is left blank here shows the English text
            to {activeLabel} visitors instead, until it&apos;s filled in.
          </p>
          {activeTranslation.syncError ? (
            <p className="mt-2 text-xs text-[var(--adm-danger)]">{activeTranslation.syncError}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-5" hidden={activeSection !== "essentials"}>
        <div className="grid items-start gap-x-4 gap-y-6 md:grid-cols-2">
          {/*
            The Name field is the one exception to "single field per concept"
            in this form: it stays a dedicated EN input (plus a dedicated
            input per translation locale below) because
            useAdminFormValidation's native constraint scan
            (collectNativeFieldErrors) only detects a blank *required* field
            when that field is a real, named, non-hidden DOM node. A
            type="hidden" mirror can never satisfy `required` (the HTML spec
            excludes hidden inputs from constraint validation entirely), so
            collapsing Name into a locale-switching value here would silently
            break the existing Task 4 empty-name-while-on-a-translation-tab
            protection below. Every other localized field here has no
            `required` attribute and safely uses the single-field pattern.
          */}
          <div hidden={activeLocale !== SOURCE_LOCALE}>
            <AdminTextField
              label="Title"
              owner="Shopify"
              required
              name="name"
              data-validation-message={PRODUCT_FIELD_MESSAGES.name}
              value={nameValue}
              onChange={(event) => updateName(event.target.value)}
              error={fieldErrors.name}
              errorId={validation.fieldErrorId("name")}
              {...validation.fieldProps("name")}
            />
          </div>
          {activeTranslation ? (
            <AdminTextField
              label={`Product name (${activeLabel})`}
              value={titleByLocale[activeLocale] ?? ""}
              onChange={(event) => setTitleByLocale((prev) => ({ ...prev, [activeLocale]: event.target.value }))}
            />
          ) : null}
          <div hidden>
            {translationLocales.map(({ code }) => (
              <input
                key={code}
                type="hidden"
                readOnly
                name={adminLocaleFieldName(code, "title", SOURCE_LOCALE)}
                value={titleByLocale[code] ?? ""}
              />
            ))}
          </div>
          <AdminTextField
            label="Slug"
            owner="Shopify"
            required
            name="slug"
            data-validation-message={PRODUCT_FIELD_MESSAGES.slug}
            value={slugValue}
            onChange={(event) => updateSlug(event.target.value)}
            error={fieldErrors.slug}
            errorId={validation.fieldErrorId("slug")}
            {...validation.fieldProps("slug")}
          />
        </div>

        {activeTranslation ? (
          <AdminTextField
            label={`URL handle (${activeLabel}, optional)`}
            help={<AdminHelp label="URL handle guidance">Blank uses the English slug.</AdminHelp>}
            value={handleByLocale[activeLocale] ?? ""}
            onChange={(event) => setHandleByLocale((prev) => ({ ...prev, [activeLocale]: event.target.value }))}
            placeholder={draft.slug}
          />
        ) : null}
        <div hidden>
          {translationLocales.map(({ code }) => (
            <input
              key={code}
              type="hidden"
              readOnly
              name={adminLocaleFieldName(code, "localizedHandle", SOURCE_LOCALE)}
              value={handleByLocale[code] ?? ""}
            />
          ))}
        </div>

        <div className="grid items-start gap-x-4 gap-y-6 md:grid-cols-2">
          <ShopifyOrganizationSuggestField
            kind="vendors"
            label="Vendor"
            owner="Shopify"
            name="vendor"
            defaultValue={draft.vendor}
            clearable
          />
          <ShopifyOrganizationSuggestField
            kind="types"
            label="Product type"
            owner="Shopify"
            name="productType"
            defaultValue={draft.productType}
            clearable
          />
        </div>
        <ShopifyOrganizationSuggestField
          kind="tags"
          unitId="field-taxonomy-tags"
          id="field-taxonomy-tags-input"
          label="Tags"
          owner="Shopify"
          name="tags"
          defaultValue={draft.tags}
          placeholder="bracelet, heritage, symbolic"
          clearable
          invalid={tagsIssues.length > 0}
          issue={<AdminFieldIssue issues={tagsIssues} />}
          onChange={(event) => updateTaxonomySatisfaction({ hasTags: Boolean(event.target.value.trim()) })}
          onClear={() => updateTaxonomySatisfaction({ hasTags: false })}
        />

        <AdminLongTextField
          label="Description"
          owner="Shopify"
          dialogLabel="Description"
          value={coreDraft.description}
          onChange={(value) => updateCore("description", value)}
        />
        <AdminTextField
          label="SEO title"
          owner="Shopify"
          value={coreDraft.seoTitle}
          onChange={(event) => updateCore("seoTitle", event.target.value)}
        />
        <AdminLongTextField
          label="SEO description"
          owner="Shopify"
          dialogLabel="SEO description"
          value={coreDraft.seoDescription}
          onChange={(value) => updateCore("seoDescription", value)}
          rows={7}
        />
      </div>

      {/* Synarava Product page — editorial copy (not Shopify description). */}
      <div className="grid gap-y-6" hidden={activeSection !== "details"}>
        <AdminLongTextField
          label="Short description"
          owner="Synarava"
          dialogLabel="Short description"
          value={coreDraft.shortDescription}
          onChange={(value) => updateCore("shortDescription", value)}
          rows={8}
        />
        <AdminTextField
          label="Material line"
          owner="Synarava"
          value={coreDraft.materialLine}
          onChange={(event) => updateCore("materialLine", event.target.value)}
        />
        <div>
          <p className="adm-label-row">
            <span className="adm-section-tag">[ PRODUCT SYMBOLISM ]</span>
            <AdminHelp>If empty, the symbolism section stays hidden on the product page.</AdminHelp>
          </p>
        </div>
        <div className="grid items-start gap-x-4 gap-y-6 md:grid-cols-2">
          <AdminTextField
            value={coreDraft.symbolismLabel}
            onChange={(event) => updateCore("symbolismLabel", event.target.value)}
            placeholder="Symbolic Language"
          />
          <AdminTextField
            value={coreDraft.symbolismTitle}
            onChange={(event) => updateCore("symbolismTitle", event.target.value)}
            placeholder="Wood, Lava, Embroidery"
          />
        </div>
        <AdminLongTextField label="Symbolism body" dialogLabel="Symbolism body" value={coreDraft.symbolismBody} onChange={(value) => updateCore("symbolismBody", value)} />
        <AdminLongTextField label="Symbolism continuation" dialogLabel="Symbolism continuation" value={coreDraft.symbolismBody2} onChange={(value) => updateCore("symbolismBody2", value)} rows={8} />
      </div>

      {/* Cover is managed in Product gallery (Media). Keep form mirrors for save. */}
      <div hidden>
        <input type="hidden" name="existingImageUrl" value={draft.imageUrl} />
        <input type="hidden" name="removeImage" value="0" />
      </div>

      {activeTranslation ? (
        <div className="border-t border-[var(--adm-border)] pt-4" hidden={activeSection !== "essentials"}>
          {/* No `name` here — hidden mirrors below carry every locale's real "on"/"" value. */}
          <AdminCheckboxControl
            checked={reviewedByLocale[activeLocale] ?? false}
            onChange={(event) => setReviewedByLocale((prev) => ({ ...prev, [activeLocale]: event.target.checked }))}
            label={`${activeLabel} translation reviewed`}
          />
        </div>
      ) : null}
      <div hidden>
        {translationLocales.map(({ code }) => (
          <input
            key={code}
            type="hidden"
            readOnly
            name={adminLocaleFieldName(code, "reviewed", SOURCE_LOCALE)}
            value={reviewedByLocale[code] ? "on" : ""}
          />
        ))}
      </div>

      {/* Synarava-only — Product page. */}
      <div className="max-w-md" hidden={activeSection !== "details"}>
        <AdminTextField
          label="Series label"
          owner="Synarava"
          name="seriesLabel"
          defaultValue={draft.seriesLabel}
          help={(
            <AdminHelp label="Series label guidance">
              Synarava-only merchandising line for shop listing/search — not a Shopify product field.
            </AdminHelp>
          )}
        />
      </div>

      {/* Inventory + shipping — Shopify Inventory / Shipping cards (primary variant). */}
      <div hidden={activeSection !== "inventory"}>
        <ProductInventoryFields
          draft={{ sku: draft.sku, stockOnHand: draft.stockOnHand }}
          variantExists={variantExists}
          facts={inventoryFacts ?? {
            barcode: null,
            tracked: null,
            inventoryPolicy: null,
            requiresShipping: null,
            weightGrams: null,
            countryCodeOfOrigin: null,
            harmonizedSystemCode: null,
            locations: [],
          }}
          fieldErrors={fieldErrors}
          validation={validation}
        />
      </div>

      <div className="grid gap-5" hidden={activeSection !== "price"}>
        <ProductPriceFields
          draft={{
            price: draft.price,
            compareAt: draft.compareAt,
            taxable: draft.taxable,
            cost: draft.cost,
          }}
          fieldErrors={fieldErrors}
          validation={validation}
        />
      </div>

      {/* Taxonomy + publish — Shopify Product organization */}
      <div className="grid gap-5" hidden={activeSection !== "essentials"}>
        <div className="grid items-start gap-x-4 gap-y-6 md:grid-cols-2">
          <ShopifyCategoryField
            controlId="field-taxonomy-category-input"
            initialId={draft.shopifyCategoryId}
            initialName={draft.shopifyCategoryName}
            invalid={categoryIssues.length > 0}
            selectedAttributeValues={selectedShopifyCategoryAttributes}
            onSelectedIdChange={(id) => updateTaxonomySatisfaction({ hasCategory: Boolean(id.trim()) })}
          >
            <AdminFieldShell
              id="field-taxonomy-category"
              component="ShopifyCategoryFieldShell"
              controlId="field-taxonomy-category-input"
              label="Product category"
              owner="Shopify"
              help={(
                <AdminHelp label="Product category guidance">
                  Search Shopify&rsquo;s Standard Product Taxonomy (for example &ldquo;hair&rdquo; or
                  &ldquo;rings&rdquo;) and click a result. Free text like &ldquo;Uncategorized&rdquo; is not a
                  category — the Shopify ID is what powers site filters. Collections are a separate
                  merchandising group below.
                </AdminHelp>
              )}
              issue={<AdminFieldIssue issues={categoryIssues} />}
            >
              <ShopifyCategoryControl />
            </AdminFieldShell>
            <ShopifyCategoryAttributes />
          </ShopifyCategoryField>
          <AdminSelectField
            unitId="field-taxonomy-collection"
            id="field-taxonomy-collection-select"
            label="Collection"
            owner="Synarava"
            name="collectionSlug"
            defaultValue={draft.collectionSlug}
            invalid={collectionIssues.length > 0 || Boolean(fieldErrors.collectionSlug)}
            error={fieldErrors.collectionSlug}
            issue={<AdminFieldIssue issues={collectionIssues} />}
            help={(
              <AdminHelp label="Collection guidance">
                Draft collections stay in this list (marked Draft) so you can prep membership
                before the collection goes live. A product cannot be Published or Unlisted while
                its marketing collection is still Draft — publish the collection first. Shopify
                pull never fails on a draft collection; Problems flags a live product stuck on an
                unpublished collection.
              </AdminHelp>
            )}
            onChange={(event) => updateTaxonomySatisfaction({ hasCollection: Boolean(event.target.value.trim()) })}
          >
            <option value="">No collection</option>
            {filterCollectionsForProductSelect(collections, draft.collectionSlug).map((collection) => (
              <option key={collection.id} value={collection.slug}>
                {collectionSelectOptionLabel(collection)}
              </option>
            ))}
          </AdminSelectField>
        </div>

        <AdminSelectField
          label="Site state"
          owner="Shopify"
          name="workflowState"
          defaultValue={draft.workflowState}
          className="md:max-w-xs"
        >
          <option value="DRAFT">Draft — hidden</option>
          <option value="PUBLISHED">Published — visible</option>
          <option value="UNLISTED">Unlisted — direct link only</option>
        </AdminSelectField>
      </div>
    </>
  );
}
