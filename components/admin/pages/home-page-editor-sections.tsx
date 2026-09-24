"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

import type { EditablePageContent } from "@/components/admin/pages/page-types";
import { ImageFileField } from "@/components/admin/shared/image-file-field";
import {
  AdminCheckboxField,
  AdminCollapsiblePanel,
  AdminFieldShell,
  AdminHelp,
  AdminHrefField,
  AdminLongTextField,
  AdminOrderedList,
  AdminOrderedListItemActions,
  AdminSelectField,
  AdminTextField,
  fieldClass,
  useAdminFieldIds,
} from "@/components/synarava-cms";
import {
  HOME_SECTION_CONTROLS,
  HomeSectionVisibilitySwitch,
  type HomeSectionKey,
} from "@/components/admin/pages/home-section-visibility-editor";
import {
  lexiconMaterialStorefrontCaption,
  lexiconMaterialStorefrontWarnings,
  MAX_HOME_LEXICON_MATERIALS,
  MIN_HOME_LEXICON_MATERIALS,
} from "@/lib/content/home-lexicon-section";
import { resolveHomeSectionVisibility } from "@/lib/content/home-sections";

export type HomeEditProductOption = {
  id: string;
  title: string;
  slug: string;
};

export type HomeArchiveCollectionOption = {
  id: string;
  title: string;
  slug: string;
};

export type MaterialDraft = {
  id: string;
  name: string;
  category: string;
  description: string;
  properties: string;
  image: string;
  /** UI-only — lifted so save remounts do not slam rows shut. */
  panelOpen: boolean;
};

type HomeLocaleDraft = {
  title: string;
  eyebrow: string;
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
};

export type HomePageEditorSectionsProps = {
  content: EditablePageContent;
  draft: HomeLocaleDraft;
  updateField: <K extends keyof HomeLocaleDraft>(key: K, value: HomeLocaleDraft[K]) => void;
  updateMaterial: (index: number, key: keyof MaterialDraft, value: string) => void;
  setMaterialPanelOpen: (index: number, open: boolean) => void;
  setMaterials: (materials: MaterialDraft[]) => void;
  createMaterial: () => MaterialDraft;
  editProductIds: string[];
  setEditProductIds: Dispatch<SetStateAction<string[]>>;
  finalCtaProductIds: string[];
  setFinalCtaProductIds: Dispatch<SetStateAction<string[]>>;
  productOptions: HomeEditProductOption[];
  archiveCollectionIds: string[];
  setArchiveCollectionIds: Dispatch<SetStateAction<string[]>>;
  collectionOptions: HomeArchiveCollectionOption[];
  contactEnabled: boolean;
  setContactEnabled: Dispatch<SetStateAction<boolean>>;
  contactLabelError?: string;
  contactLabelErrorId?: string;
  onContactLabelEdit?: () => void;
  contactEmailError?: string;
  contactEmailErrorId?: string;
  contactEmailFieldProps?: {
    id?: string;
    "aria-invalid"?: true | undefined;
    "aria-errormessage"?: string | undefined;
    onInput?: () => void;
  };
};

function materialHeaderTitle(material: MaterialDraft, index: number) {
  const name = material.name.trim() || "Untitled";
  const category = material.category.trim();
  return (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="adm-section-tag shrink-0">
        Material {String(index + 1).padStart(2, "0")}
      </span>
      <span className="truncate">{name}</span>
      {category ? (
        <span className="truncate text-xs font-normal" style={{ color: "var(--adm-muted)" }}>
          {category}
        </span>
      ) : null}
    </span>
  );
}

function HomeLexiconMaterialFields({
  material,
  index,
  updateMaterial,
}: {
  material: MaterialDraft;
  index: number;
  updateMaterial: (index: number, key: keyof MaterialDraft, value: string) => void;
}) {
  const warnings = lexiconMaterialStorefrontWarnings(material);
  const imageIds = useAdminFieldIds();

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <AdminTextField
          label="Name"
          value={material.name}
          onChange={(event) => updateMaterial(index, "name", event.target.value)}
          warning={warnings.name}
        />
        <AdminTextField
          label="Category"
          value={material.category}
          onChange={(event) => updateMaterial(index, "category", event.target.value)}
        />
      </div>
      <AdminLongTextField
        label="Description"
        value={material.description}
        onChange={(value) => updateMaterial(index, "description", value)}
        rows={3}
        warning={warnings.description}
      />
      <AdminTextField
        label="Properties (comma-separated, up to 3)"
        value={material.properties}
        onChange={(event) => updateMaterial(index, "properties", event.target.value)}
        placeholder="Recycled, Hypoallergenic, Handmade"
      />
      <AdminFieldShell
        label="Image"
        help={<AdminHelp>Shared across languages. Required for the specimen to appear on the site.</AdminHelp>}
        warning={warnings.image}
        warningId={imageIds.warningId}
        controlId={imageIds.controlId}
      >
        <input type="hidden" name={`material${index + 1}Image`} value={material.image} readOnly />
        <ImageFileField
          fieldId={imageIds.controlId}
          name={`material${index + 1}ImageFile`}
          className={fieldClass(undefined, warnings.image)}
          currentImageUrl={material.image || undefined}
          currentImageAlt={material.name || `Material ${index + 1}`}
          currentImageLabel="Current image"
          removeFieldName={`removeMaterial${index + 1}Image`}
          aria-invalid={Boolean(warnings.image) || undefined}
        />
      </AdminFieldShell>
    </div>
  );
}

/**
 * Home admin mirrors storefront order: Hero → Archive → Product showcase → Material → Manifesto → Final CTA.
 * One collapsible panel per section; visibility switch lives inside each panel.
 */
export function HomePageEditorSections({
  content,
  draft,
  updateField,
  updateMaterial,
  setMaterialPanelOpen,
  setMaterials,
  createMaterial,
  editProductIds,
  setEditProductIds,
  finalCtaProductIds,
  setFinalCtaProductIds,
  productOptions,
  archiveCollectionIds,
  setArchiveCollectionIds,
  collectionOptions,
  contactEnabled,
  setContactEnabled,
  contactLabelError,
  contactLabelErrorId,
  onContactLabelEdit,
  contactEmailError,
  contactEmailErrorId,
  contactEmailFieldProps,
}: HomePageEditorSectionsProps) {
  const [visibility, setVisibility] = useState(() => resolveHomeSectionVisibility(content));
  const [finalCtaUserOpen, setFinalCtaUserOpen] = useState(true);
  // Validation errors force the panel open so the bad fields stay visible.
  const finalCtaOpen = Boolean(contactEmailError || contactLabelError) || finalCtaUserOpen;

  function setSection(key: HomeSectionKey, enabled: boolean) {
    setVisibility((current) => ({ ...current, [key]: enabled }));
  }

  return (
    <div className="grid gap-4" data-component="HomePageEditorSections">
      <p className="text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
        Sections match the home page top to bottom. Edit one block at a time — turn a section off to hide it on the site without deleting its copy.
      </p>

      <AdminCollapsiblePanel title="01 / Hero" defaultOpen>
        <div className="grid gap-4">
          <HomeSectionVisibilitySwitch
            section={HOME_SECTION_CONTROLS[0]}
            checked={visibility.hero}
            onChange={(enabled) => setSection("hero", enabled)}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <AdminTextField
              label="Hero headline"
              value={draft.title}
              onChange={(event) => updateField("title", event.target.value)}
            />
            <AdminTextField
              label="Eyebrow"
              value={draft.eyebrow}
              onChange={(event) => updateField("eyebrow", event.target.value)}
            />
          </div>
          <AdminLongTextField
            label="Hero description"
            value={draft.body}
            onChange={(value) => updateField("body", value)}
            rows={5}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <AdminTextField
              label="CTA label"
              value={draft.ctaLabel}
              onChange={(event) => updateField("ctaLabel", event.target.value)}
            />
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
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <span className="adm-label">Hero image</span>
              <AdminHelp>
                Optional page-specific hero, shared across languages. Built-in pages show a neutral header when this is empty; uploaded images are converted to optimized WebP.
              </AdminHelp>
            </div>
            <ImageFileField
              name="heroImageFile"
              currentImageUrl={content.heroImage}
              currentImageAlt="Home hero"
              currentImageLabel="Current hero image"
              previewAspect="video"
              removeFieldName="removeHeroImage"
            />
          </div>
        </div>
      </AdminCollapsiblePanel>

      <AdminCollapsiblePanel title="02 / Featured collections" defaultOpen>
        <div className="grid gap-4">
          <HomeSectionVisibilitySwitch
            section={HOME_SECTION_CONTROLS[1]}
            checked={visibility.archive}
            onChange={(enabled) => setSection("archive", enabled)}
          />
          <AdminTextField
            label="Archive background label"
            help={<AdminHelp>Huge background word behind the collection cards (default: RECORDED).</AdminHelp>}
            value={draft.archiveSectionLabel}
            onChange={(event) => updateField("archiveSectionLabel", event.target.value)}
            placeholder="Recorded"
          />
          <AdminOrderedList
            label="Collections"
            help={
              <AdminHelp>
                At least one slot. Leave empty to show the newest published collection. Add more and reorder with the arrows.
              </AdminHelp>
            }
            items={archiveCollectionIds}
            onChange={setArchiveCollectionIds}
            getKey={(_, index) => `archive-collection-${index}`}
            minItems={1}
            createItem={() => ""}
            addLabel="Add collection"
            renderItem={(collectionId, { index }) => (
              <AdminSelectField
                label={`Collection ${index + 1}`}
                name="archiveCollectionIds"
                value={collectionId}
                onChange={(event) =>
                  setArchiveCollectionIds((current) =>
                    current.map((id, slot) => (slot === index ? event.target.value : id)),
                  )
                }
              >
                <option value="">Newest published (default)</option>
                {collectionOptions.map((collection) => (
                  <option
                    key={collection.id}
                    value={collection.id}
                    disabled={collection.id !== collectionId && archiveCollectionIds.includes(collection.id)}
                  >
                    {collection.title} · /{collection.slug}
                  </option>
                ))}
              </AdminSelectField>
            )}
          />
        </div>
      </AdminCollapsiblePanel>

      <AdminCollapsiblePanel title="03 / Product showcase" defaultOpen>
        <div className="grid gap-4">
          <HomeSectionVisibilitySwitch
            section={HOME_SECTION_CONTROLS[2]}
            checked={visibility.edit}
            onChange={(enabled) => setSection("edit", enabled)}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <AdminTextField
              label="Eyebrow"
              help={<AdminHelp>Small red label above the showcase headline.</AdminHelp>}
              value={draft.editSectionEyebrow}
              onChange={(event) => updateField("editSectionEyebrow", event.target.value)}
              placeholder="A few to start with"
            />
            <AdminTextField
              label="Showcase title"
              value={draft.editSectionTitle}
              onChange={(event) => updateField("editSectionTitle", event.target.value)}
              placeholder="The Edit"
            />
            <AdminTextField
              label="View all label"
              help={<AdminHelp>Link under the product grid to the shop.</AdminHelp>}
              value={draft.editSectionViewAllLabel}
              onChange={(event) => updateField("editSectionViewAllLabel", event.target.value)}
              placeholder="View all products"
            />
          </div>
          <AdminLongTextField
            label="Showcase description"
            value={draft.editSectionBody}
            onChange={(value) => updateField("editSectionBody", value)}
            rows={2}
            placeholder="Four pieces, four sides of Synarava."
          />
          <AdminOrderedList
            label="Products"
            help={<AdminHelp>Four published products, left to right on the site. Reorder with the arrows.</AdminHelp>}
            items={editProductIds}
            onChange={setEditProductIds}
            getKey={(_, index) => `edit-product-${index}`}
            minItems={4}
            maxItems={4}
            renderItem={(productId, { index }) => (
              <AdminSelectField
                label={`Product ${index + 1}`}
                name={`editProductId${index + 1}`}
                value={productId}
                onChange={(event) =>
                  setEditProductIds((current) =>
                    current.map((id, slot) => (slot === index ? event.target.value : id)),
                  )
                }
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
            )}
          />
        </div>
      </AdminCollapsiblePanel>

      <AdminCollapsiblePanel title="04 / Material lexicon" defaultOpen>
        <div className="grid gap-4">
          <HomeSectionVisibilitySwitch
            section={HOME_SECTION_CONTROLS[3]}
            checked={visibility.material}
            onChange={(enabled) => setSection("material", enabled)}
          />
          <div className="grid gap-4 md:grid-cols-2">
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
          <AdminOrderedList
            label="Materials"
            help={
              <AdminHelp>
                At least two for the scroll carousel (max {MAX_HOME_LEXICON_MATERIALS}). Name, description, and
                image are required for a specimen to appear — incomplete rows stay orange until filled. Images are
                shared across languages. Reorder with the arrows.
              </AdminHelp>
            }
            items={draft.materials}
            onChange={setMaterials}
            getKey={(material) => material.id}
            minItems={MIN_HOME_LEXICON_MATERIALS}
            maxItems={MAX_HOME_LEXICON_MATERIALS}
            createItem={createMaterial}
            addLabel="Add material"
            showItemControls={false}
            renderItem={(material, controls) => {
              const rowCaption = lexiconMaterialStorefrontCaption(material);
              return (
              <AdminCollapsiblePanel
                title={materialHeaderTitle(material, controls.index)}
                open={material.panelOpen}
                onOpenChange={(open) => setMaterialPanelOpen(controls.index, open)}
                className="adm-ordered-list__collapse"
                trailing={<AdminOrderedListItemActions controls={controls} />}
                tone={rowCaption ? "warning" : "default"}
                caption={rowCaption}
              >
                <HomeLexiconMaterialFields
                  material={material}
                  index={controls.index}
                  updateMaterial={updateMaterial}
                />
              </AdminCollapsiblePanel>
              );
            }}
          />
        </div>
      </AdminCollapsiblePanel>

      <AdminCollapsiblePanel title="05 / Manifesto" defaultOpen>
        <div className="grid gap-4">
          <HomeSectionVisibilitySwitch
            section={HOME_SECTION_CONTROLS[4]}
            checked={visibility.manifesto}
            onChange={(enabled) => setSection("manifesto", enabled)}
          />
          <AdminLongTextField
            label="Manifesto quote"
            help={<AdminHelp>Leave blank to use the site default quote.</AdminHelp>}
            value={draft.quote}
            onChange={(value) => updateField("quote", value)}
            rows={4}
          />
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
        </div>
      </AdminCollapsiblePanel>

      <AdminCollapsiblePanel
        title="06 / Final call to action"
        open={finalCtaOpen}
        onOpenChange={setFinalCtaUserOpen}
      >
        <div className="grid gap-4">
          <HomeSectionVisibilitySwitch
            section={HOME_SECTION_CONTROLS[5]}
            checked={visibility.finalCta}
            onChange={(enabled) => setSection("finalCta", enabled)}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <AdminTextField
              label="Final CTA headline"
              help={<AdminHelp>Leave blank for the site default headline.</AdminHelp>}
              value={draft.secondaryTitle}
              onChange={(event) => updateField("secondaryTitle", event.target.value)}
              placeholder="Choose the piece that remembers you."
            />
            <AdminLongTextField
              label="Final CTA introduction"
              help={<AdminHelp>Leave blank for the site default introduction.</AdminHelp>}
              value={draft.secondaryBody}
              onChange={(value) => updateField("secondaryBody", value)}
              rows={3}
              placeholder="The final choice is instinctive."
            />
            <AdminTextField
              label="Final CTA label"
              help={<AdminHelp>Leave blank for “Enter the collection”.</AdminHelp>}
              value={draft.finalCtaLabel}
              onChange={(event) => updateField("finalCtaLabel", event.target.value)}
              placeholder="Enter the collection"
            />
            <AdminHrefField
              label="Final CTA href"
              help={
                <AdminHelp>
                  Shared across languages. Empty falls back to /shop. Search by name, or type /products/ or /collections/ to drill in.
                </AdminHelp>
              }
              name="finalCtaHref"
              defaultValue={content.finalCtaHref ?? content.ctaHref ?? ""}
              placeholder="/shop"
            />
          </div>
          <AdminOrderedList
            label="Collage photos"
            help={
              <AdminHelp>
                Exactly four product images for the cubist collage on the storefront. Reorder with the arrows. Empty slots fall back to Featured collections imagery.
              </AdminHelp>
            }
            items={finalCtaProductIds}
            onChange={setFinalCtaProductIds}
            getKey={(_, index) => `final-cta-product-${index}`}
            minItems={4}
            maxItems={4}
            renderItem={(productId, { index }) => (
              <AdminSelectField
                label={`Photo ${index + 1}`}
                name={`finalCtaProductId${index + 1}`}
                value={productId}
                onChange={(event) =>
                  setFinalCtaProductIds((current) =>
                    current.map((id, slot) => (slot === index ? event.target.value : id)),
                  )
                }
              >
                <option value="">Choose a product</option>
                {productOptions.map((product) => (
                  <option
                    key={product.id}
                    value={product.id}
                    disabled={product.id !== productId && finalCtaProductIds.includes(product.id)}
                  >
                    {product.title} · /{product.slug}
                  </option>
                ))}
              </AdminSelectField>
            )}
          />
          {/*
            Closing strip inside Final CTA (not the site footer): statement +
            mailto link rendered by FinalFooter on the storefront.
          */}
          <AdminTextField
            label="Closing statement"
            help={
              <AdminHelp>
                Short line at the bottom of this Final CTA block (not the site-wide footer). Leave blank for the storefront default.
              </AdminHelp>
            }
            value={draft.finalFooterTitle}
            onChange={(event) => updateField("finalFooterTitle", event.target.value)}
            placeholder={"Objects shaped slowly,\nkept for a lifetime."}
          />
          <AdminCheckboxField
            name="finalContactEnabled"
            value="1"
            checked={contactEnabled}
            onChange={(event) => setContactEnabled(event.target.checked)}
            label="Include contact email"
          >
            {contactEnabled ? (
              <div className="grid gap-4 md:grid-cols-2">
                <AdminTextField
                  label="Contact link label"
                  required
                  error={contactLabelError}
                  errorId={contactLabelErrorId}
                  help={
                    <AdminHelp>
                      Visible text for the mailto link. Required when contact email is enabled.
                    </AdminHelp>
                  }
                  value={draft.finalContactLabel}
                  onChange={(event) => {
                    updateField("finalContactLabel", event.target.value);
                    onContactLabelEdit?.();
                  }}
                />
                <AdminTextField
                  label="Contact email"
                  name="finalContactEmail"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  defaultValue={content.finalContactEmail ?? ""}
                  error={contactEmailError}
                  errorId={contactEmailErrorId}
                  data-validation-message="Enter a valid email address."
                  {...contactEmailFieldProps}
                  help={
                    <AdminHelp>
                      Shared across languages. Required when contact email is enabled.
                    </AdminHelp>
                  }
                />
              </div>
            ) : null}
          </AdminCheckboxField>
        </div>
      </AdminCollapsiblePanel>
    </div>
  );
}
