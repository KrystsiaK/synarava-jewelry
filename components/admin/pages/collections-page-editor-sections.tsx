"use client";

import type { Dispatch, SetStateAction } from "react";

import {
  AdminCollapsiblePanel,
  AdminHelp,
  AdminHrefField,
  AdminOrderedList,
  AdminRichTextField,
  AdminSelectField,
  AdminTextField,
} from "@/components/synarava-cms";
import type { HomeArchiveCollectionOption } from "@/components/admin/pages/home-page-editor-sections";

export type CollectionsPageDraftFields = {
  eyebrow: string;
  secondaryTitle: string;
  body: string;
  heroOpeningLabel: string;
  heroCountLabel: string;
  heroQualifier: string;
  calloutEyebrow: string;
  calloutHeading: string;
  ctaLabel: string;
  calloutCtaHref: string;
  secondaryBody: string;
  detailShopLabel: string;
  detailCollectionsLabel: string;
  detailScrollLabel: string;
  detailManifestoEyebrow: string;
  detailManifestoGhost: string;
  detailStoryEyebrow: string;
  detailAccentCodeLabel: string;
  detailTeaserEyebrow: string;
  detailTeaserHeading: string;
  detailTeaserShopLabel: string;
  detailCatalogEyebrow: string;
  detailCatalogHeading: string;
};

type Props = {
  draft: CollectionsPageDraftFields;
  activeLocale: string;
  updateField: <K extends keyof CollectionsPageDraftFields>(
    key: K,
    value: CollectionsPageDraftFields[K],
  ) => void;
  archiveCollectionIds: string[];
  setArchiveCollectionIds: Dispatch<SetStateAction<string[]>>;
  collectionOptions: HomeArchiveCollectionOption[];
};

export function CollectionsPageEditorSections({
  draft,
  activeLocale,
  updateField,
  archiveCollectionIds,
  setArchiveCollectionIds,
  collectionOptions,
}: Props) {
  return (
    <>
      <AdminCollapsiblePanel title="01 / Page header" defaultOpen>
        <div className="grid gap-4">
          <AdminTextField
            label="Eyebrow"
            help={<AdminHelp>Small label above the main heading (default: SYNARAVA COLLECTIONS).</AdminHelp>}
            value={draft.eyebrow}
            onChange={(event) => updateField("eyebrow", event.target.value)}
            placeholder="Synarava collections"
          />
          <AdminTextField
            label="Main heading"
            help={<AdminHelp>Primary H1 on /collections. Not the browser-tab Title above.</AdminHelp>}
            value={draft.secondaryTitle}
            onChange={(event) => updateField("secondaryTitle", event.target.value)}
            placeholder="Browse by collection"
          />
          <AdminRichTextField
            label="Introduction"
            help={<AdminHelp>Supporting paragraph under the heading.</AdminHelp>}
            value={draft.body}
            onChange={(value) => updateField("body", value)}
            placeholder="Explore Synarava through collections shaped by material, form and character."
          />
          <div className="grid gap-4 md:grid-cols-2">
            <AdminTextField
              label="Opening label"
              help={<AdminHelp>Small line on the hero image (default: Opening world).</AdminHelp>}
              value={draft.heroOpeningLabel}
              onChange={(event) => updateField("heroOpeningLabel", event.target.value)}
              placeholder="Opening world"
            />
            <AdminTextField
              label="Count label"
              help={<AdminHelp>Word after the collection count (default: collections).</AdminHelp>}
              value={draft.heroCountLabel}
              onChange={(event) => updateField("heroCountLabel", event.target.value)}
              placeholder="collections"
            />
            <AdminTextField
              label="Qualifier"
              help={<AdminHelp>Second line under the introduction (default: Material / form / character).</AdminHelp>}
              value={draft.heroQualifier}
              onChange={(event) => updateField("heroQualifier", event.target.value)}
              placeholder="Material / form / character"
            />
          </div>
        </div>
      </AdminCollapsiblePanel>

      <AdminCollapsiblePanel title="02 / Collections on this page" defaultOpen>
        <div className="grid gap-4">
          <AdminOrderedList
            label="Collections"
            help={
              <AdminHelp>
                Collections shown on /collections, in this order. Add any number, reorder
                with the arrows, or remove a row to hide that collection from the page
                without deleting it. Leave every row empty to show all published collections
                in catalog order.
              </AdminHelp>
            }
            items={archiveCollectionIds}
            onChange={setArchiveCollectionIds}
            getKey={(_, index) => `collections-index-${index}`}
            minItems={0}
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
                <option value="">Select a collection</option>
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
          <AdminTextField
            label="Collection card link label"
            help={
              <AdminHelp>
                Shared label on every collection card CTA on /collections (default: Explore
                collection). Each card keeps its own link; only the text is shared. Translate
                per language tab — empty uses that language’s storefront default.
              </AdminHelp>
            }
            value={draft.secondaryBody}
            onChange={(event) => updateField("secondaryBody", event.target.value)}
            placeholder="Explore collection"
          />
        </div>
      </AdminCollapsiblePanel>

      <AdminCollapsiblePanel title="03 / Bottom callout" defaultOpen>
        <div className="grid gap-4 md:grid-cols-2">
          <AdminTextField
            label="Callout eyebrow"
            value={draft.calloutEyebrow}
            onChange={(event) => updateField("calloutEyebrow", event.target.value)}
            placeholder="Not sure where to start?"
          />
          <AdminTextField
            label="Callout heading"
            value={draft.calloutHeading}
            onChange={(event) => updateField("calloutHeading", event.target.value)}
            placeholder="Browse everything in the shop"
          />
          <AdminTextField
            label="Button label"
            value={draft.ctaLabel}
            onChange={(event) => updateField("ctaLabel", event.target.value)}
            placeholder="Shop all products"
          />
          <AdminHrefField
            label="Button href"
            help={
              <AdminHelp>
                Locale-free path (`/shop`); `/pt/shop` is accepted and normalized. Empty falls back to /shop.
              </AdminHelp>
            }
            name="_uiCalloutCtaHref"
            locale={activeLocale}
            value={draft.calloutCtaHref}
            onValueChange={(href) => updateField("calloutCtaHref", href)}
            placeholder="/shop"
          />
        </div>
      </AdminCollapsiblePanel>

      <AdminCollapsiblePanel title="04 / Collection page buttons" defaultOpen>
        <div className="grid gap-4 md:grid-cols-2">
          <AdminTextField
            label="Shop button"
            help={<AdminHelp>Button under the description on a collection page (default: Shop products).</AdminHelp>}
            value={draft.detailShopLabel}
            onChange={(event) => updateField("detailShopLabel", event.target.value)}
            placeholder="Shop products"
          />
          <AdminTextField
            label="All collections link"
            help={<AdminHelp>Text link under the description, and again in the closing teaser (default: All collections).</AdminHelp>}
            value={draft.detailCollectionsLabel}
            onChange={(event) => updateField("detailCollectionsLabel", event.target.value)}
            placeholder="All collections"
          />
          <AdminTextField
            label="Scroll cue"
            help={<AdminHelp>Vertical label on the hero scroll indicator (default: Scroll).</AdminHelp>}
            value={draft.detailScrollLabel}
            onChange={(event) => updateField("detailScrollLabel", event.target.value)}
            placeholder="Scroll"
          />
          <AdminTextField
            label="Teaser eyebrow"
            help={<AdminHelp>Small label above the closing heading (default: Explore more).</AdminHelp>}
            value={draft.detailTeaserEyebrow}
            onChange={(event) => updateField("detailTeaserEyebrow", event.target.value)}
            placeholder="Explore more"
          />
          <AdminTextField
            label="Teaser heading"
            value={draft.detailTeaserHeading}
            onChange={(event) => updateField("detailTeaserHeading", event.target.value)}
            placeholder="Browse all collections"
          />
          <AdminTextField
            label="Teaser shop button"
            help={<AdminHelp>Primary button in the closing teaser (default: Shop all products).</AdminHelp>}
            value={draft.detailTeaserShopLabel}
            onChange={(event) => updateField("detailTeaserShopLabel", event.target.value)}
            placeholder="Shop all products"
          />
        </div>
      </AdminCollapsiblePanel>

      <AdminCollapsiblePanel title="05 / Manifesto & story chrome" defaultOpen>
        <div className="grid gap-4 md:grid-cols-2">
          <AdminTextField
            label="Manifesto eyebrow"
            help={
              <AdminHelp>
                Red section label above the manifesto quote on every collection page (default: Collection
                Manifesto). The quote itself is edited on each collection.
              </AdminHelp>
            }
            value={draft.detailManifestoEyebrow}
            onChange={(event) => updateField("detailManifestoEyebrow", event.target.value)}
            placeholder="Collection Manifesto"
          />
          <AdminTextField
            label="Manifesto watermark"
            help={
              <AdminHelp>
                Huge faint background word behind the manifesto (default: MANIFESTO). Decorative only —
                the diamond hairlines under the quote stay as fixed design chrome.
              </AdminHelp>
            }
            value={draft.detailManifestoGhost}
            onChange={(event) => updateField("detailManifestoGhost", event.target.value)}
            placeholder="MANIFESTO"
          />
          <AdminTextField
            label="Story eyebrow"
            help={
              <AdminHelp>
                Red label beside the story heading (default: Collection Story). Story heading and
                paragraph are per collection. The red rule beside this label and the grey borders around
                the block are fixed design chrome.
              </AdminHelp>
            }
            value={draft.detailStoryEyebrow}
            onChange={(event) => updateField("detailStoryEyebrow", event.target.value)}
            placeholder="Collection Story"
          />
          <AdminTextField
            label="Accent code label"
            help={
              <AdminHelp>
                Caption next to the collection accent letter on the story image (default: Accent code).
                The letter itself comes from the collection.
              </AdminHelp>
            }
            value={draft.detailAccentCodeLabel}
            onChange={(event) => updateField("detailAccentCodeLabel", event.target.value)}
            placeholder="Accent code"
          />
        </div>
      </AdminCollapsiblePanel>

      <AdminCollapsiblePanel title="06 / Products in this collection" defaultOpen>
        <div className="grid gap-4 md:grid-cols-2">
          <AdminTextField
            label="Catalog eyebrow"
            help={<AdminHelp>Word before the collection name above the product grid (default: Catalogue).</AdminHelp>}
            value={draft.detailCatalogEyebrow}
            onChange={(event) => updateField("detailCatalogEyebrow", event.target.value)}
            placeholder="Catalogue"
          />
          <AdminTextField
            label="Catalog heading"
            help={<AdminHelp>Heading of the product grid on a collection page (default: Products in this Collection).</AdminHelp>}
            value={draft.detailCatalogHeading}
            onChange={(event) => updateField("detailCatalogHeading", event.target.value)}
            placeholder="Products in this Collection"
          />
        </div>
      </AdminCollapsiblePanel>
    </>
  );
}
