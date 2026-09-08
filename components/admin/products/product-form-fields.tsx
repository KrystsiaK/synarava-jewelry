"use client";

import { useState } from "react";

import {
  AdminFieldError,
  type AdminFormValidation,
} from "@/components/admin/shared/admin-form-validation";
import { AdminHelp } from "@/components/admin/shared/admin-help";
import { AdminIssueInlineWarning } from "@/components/admin/issues/admin-issues-cms";
import type { AdminIssueSummary } from "@/components/admin/shared/admin-issue-types";
import { ImageFileField } from "@/components/admin/shared/image-file-field";
import { LocaleTabStrip } from "@/components/admin/shared/admin-primitives";
import { slugify } from "@/lib/text/slug";
import { ShopifyCategoryField } from "@/components/admin/products/shopify-category-field";
import { PRODUCT_CHARACTERISTICS, PRODUCT_CHARACTERISTIC_GROUPS } from "@/lib/products/characteristics";
import {
  PRODUCT_FIELD_MESSAGES,
  type ProductFieldName,
} from "@/lib/products/product-form-validation";
import { getProductEditorDetails, issuesForField } from "@/components/admin/products/product-helpers";
import type { CollectionOption, ProductDraft } from "@/components/admin/products/product-types";

export function OwnershipLabel({ children, owner }: { children: React.ReactNode; owner: "Shopify" | "Synarava" | "Shopify push" }) {
  return (
    <span className="adm-label flex items-center justify-between gap-2">
      <span>{children}</span>
      <span className={owner === "Shopify" ? "text-[var(--adm-accent)]" : "text-[var(--adm-subtle)]"}>{owner}</span>
    </span>
  );
}

export function ProductDetailFields({
  details,
  mode,
  issues = [],
  collections,
}: {
  details: ReturnType<typeof getProductEditorDetails>;
  mode: "create" | "edit";
  issues?: AdminIssueSummary[];
  collections: CollectionOption[];
}) {
  const departmentCollections = collections
    .filter((collection) => collection.isPrimaryNav)
    .sort((a, b) => a.navSortOrder - b.navSortOrder);
  return (
    <div
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
            name="materialsEyebrow"
            defaultValue={details.materialsEyebrow}
            placeholder="Section eyebrow"
            className="adm-field"
          />
          <input
            name="materialsTitle"
            defaultValue={details.materialsTitle}
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
                name={`materialTitle${index + 1}`}
                defaultValue={material.title}
                placeholder="Lava Stone"
                className="adm-field"
              />
              <textarea
                name={`materialBody${index + 1}`}
                rows={4}
                defaultValue={material.body}
                placeholder="Describe the material story."
                className="adm-field"
              />
              <input
                type="hidden"
                name={`existingMaterialImage${index + 1}`}
                value={material.image}
              />
              <ImageFileField
                name={`materialImageFile${index + 1}`}
                currentImageUrl={mode === "edit" ? material.image : ""}
                currentImageAlt={material.title || `Material ${index + 1}`}
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
            name="processEyebrow"
            defaultValue={details.process.eyebrow}
            placeholder="Process"
            className="adm-field"
          />
          <input
            name="processTitle"
            defaultValue={details.process.title}
            placeholder="Human Precision"
            className="adm-field"
          />
        </div>
        <input
          type="hidden"
          name="existingProcessMediaImage"
          value={details.process.mediaImage}
        />
        <ImageFileField
          name="processMediaImageFile"
          currentImageUrl={mode === "edit" ? details.process.mediaImage : ""}
          currentImageAlt={details.process.title || "Process media"}
          currentImageLabel="Current process media"
          previewAspect="video"
          fieldId="field-details-process-mediaImage"
          removeFieldName="removeProcessMediaImage"
          removeLabel="Remove"
        />
        <AdminIssueInlineWarning issues={issuesForField(issues, "field-details-process-mediaImage")} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {details.process.stats.map((stat, index) => (
            <div
              key={`process-stat-${index}`}
              className="grid gap-3 p-3"
              style={{ border: "1px solid var(--adm-border)" }}
            >
              <p className="adm-section-tag">STAT {index + 1}</p>
              <input
                name={`processStatValue${index + 1}`}
                defaultValue={stat.value}
                placeholder="12"
                className="adm-field"
              />
              <input
                name={`processStatLabel${index + 1}`}
                defaultValue={stat.label}
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
            name="lookbookEyebrow"
            defaultValue={details.lookbookEyebrow}
            placeholder="Section eyebrow"
            className="adm-field"
          />
          <input
            name="lookbookTitle"
            defaultValue={details.lookbookTitle}
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
                name={`lookbookLabel${index + 1}`}
                defaultValue={item.label}
                placeholder="01 / The Ensemble"
                className="adm-field"
              />
              <input
                type="hidden"
                name={`existingLookbookImage${index + 1}`}
                value={item.src}
              />
              <ImageFileField
                name={`lookbookImageFile${index + 1}`}
                currentImageUrl={mode === "edit" ? item.src : ""}
                currentImageAlt={item.label || `Lookbook ${index + 1}`}
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

export function ProductFormFields({
  draft,
  collections,
  variantExists = false,
  issues = [],
  validation,
}: {
  draft: ProductDraft;
  collections: CollectionOption[];
  variantExists?: boolean;
  issues?: AdminIssueSummary[];
  validation: AdminFormValidation<ProductFieldName>;
}) {
  const { fieldErrors } = validation;
  const [nameValue, setNameValue] = useState(draft.name);
  const [slugValue, setSlugValue] = useState(draft.slug);
  const [slugLocked, setSlugLocked] = useState(Boolean(draft.slug));

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

  return (
    <>
      <div className="flex flex-col gap-2 border border-[var(--adm-border)] bg-[var(--adm-bg-soft)] p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="adm-section-tag">[ SHOPIFY COMMERCE CORE ]</p>
          <p className="mt-2 text-xs text-[var(--adm-muted)]">Every field is labelled by owner. Shopify fields form the sellable product; Synarava fields enrich it without being overwritten by catalog pulls.</p>
        </div>
        <span className="adm-badge-published w-fit">Shopify-backed</span>
      </div>

      {/* i18n groundwork */}
      <LocaleTabStrip />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
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
        <div className="grid gap-2">
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

      <div className="grid gap-4 md:grid-cols-4">
        <div className="grid gap-2">
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
        <label className="grid gap-2">
          <OwnershipLabel owner="Synarava">Series label</OwnershipLabel>
          <input name="seriesLabel" defaultValue={draft.seriesLabel} className="adm-field" />
        </label>
        <div className="grid gap-2">
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
        <label className="grid gap-2">
          <OwnershipLabel owner="Shopify">Available quantity</OwnershipLabel>
          <input name="stockOnHand" type="number" min="0" step="1" inputMode="numeric" defaultValue={draft.stockOnHand} className="adm-field" />
          <span className="text-xs text-[var(--adm-subtle)]">{variantExists ? "Primary variant inventory synced with Shopify." : "No variant record yet. Enter quantity and save to create the primary variant."}</span>
        </label>
      </div>

      <label className="grid gap-2">
        <OwnershipLabel owner="Synarava">Short description</OwnershipLabel>
        <textarea
          name="shortDescription"
          rows={3}
          defaultValue={draft.shortDescription}
          className="adm-field"
        />
      </label>

      <label className="grid gap-2">
        <OwnershipLabel owner="Shopify">Description</OwnershipLabel>
        <textarea
          name="description"
          rows={4}
          defaultValue={draft.description}
          className="adm-field"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <OwnershipLabel owner="Synarava">Material line</OwnershipLabel>
          <input name="materialLine" defaultValue={draft.materialLine} className="adm-field" />
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
            name="symbolismLabel"
            defaultValue={draft.symbolismLabel}
            placeholder="Symbolic Language"
            className="adm-field"
          />
          <input
            name="symbolismTitle"
            defaultValue={draft.symbolismTitle}
            placeholder="Wood, Lava, Embroidery"
            className="adm-field"
          />
        </div>
        <textarea
          name="symbolismBody"
          rows={4}
          defaultValue={draft.symbolismBody}
          className="adm-field"
        />
        <textarea
          name="symbolismBody2"
          rows={3}
          defaultValue={draft.symbolismBody2}
          className="adm-field"
        />
      </div>

      {/* Taxonomy + state */}
      <div className="grid gap-4 md:grid-cols-3">
        <div id="field-taxonomy-category" className="grid gap-2">
          <OwnershipLabel owner="Shopify">Product category</OwnershipLabel>
          <AdminIssueInlineWarning issues={issuesForField(issues, "field-taxonomy-category")} />
          <ShopifyCategoryField
            initialId={draft.shopifyCategoryId}
            initialName={draft.shopifyCategoryName}
          />
        </div>
        <div id="field-taxonomy-collection" className="grid gap-2">
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
        <div id="field-taxonomy-tags" className="grid gap-2">
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
