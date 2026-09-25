"use client";

import type { Dispatch, SetStateAction } from "react";

import {
  AdminCollapsiblePanel,
  AdminHelp,
  AdminHrefField,
  AdminLongTextField,
  AdminOrderedList,
  AdminSelectField,
  AdminTextField,
} from "@/components/synarava-cms";
import type { HomeArchiveCollectionOption } from "@/components/admin/pages/home-page-editor-sections";

export type CollectionsPageDraftFields = {
  eyebrow: string;
  secondaryTitle: string;
  body: string;
  calloutEyebrow: string;
  calloutHeading: string;
  ctaLabel: string;
  calloutCtaHref: string;
  secondaryBody: string;
};

type Props = {
  draft: CollectionsPageDraftFields;
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
          <AdminLongTextField
            label="Introduction"
            help={<AdminHelp>Supporting paragraph under the heading.</AdminHelp>}
            value={draft.body}
            onChange={(value) => updateField("body", value)}
            rows={3}
            placeholder="Explore Synarava through collections shaped by material, form and character."
          />
        </div>
      </AdminCollapsiblePanel>

      <AdminCollapsiblePanel title="02 / Collections on this page" defaultOpen>
        <AdminOrderedList
          label="Collections"
          help={
            <AdminHelp>
              Choose which published collections appear on /collections and in what order.
              Leave empty to show every published collection in catalog order. Removing a row
              only hides it from this page — the Collection record stays.
            </AdminHelp>
          }
          items={archiveCollectionIds}
          onChange={setArchiveCollectionIds}
          getKey={(_, index) => `collections-index-${index}`}
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
      </AdminCollapsiblePanel>

      <AdminCollapsiblePanel title="03 / Bottom callout" defaultOpen>
        <div className="grid gap-4">
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
                  Locale-specific path without the language prefix (for example /shop). Empty falls back to /shop.
                </AdminHelp>
              }
              name="_uiCalloutCtaHref"
              value={draft.calloutCtaHref}
              onValueChange={(href) => updateField("calloutCtaHref", href)}
              placeholder="/shop"
            />
          </div>
          <AdminTextField
            label="Collection card link label"
            help={<AdminHelp>Link text on each collection row (default: Explore collection).</AdminHelp>}
            value={draft.secondaryBody}
            onChange={(event) => updateField("secondaryBody", event.target.value)}
            placeholder="Explore collection"
          />
        </div>
      </AdminCollapsiblePanel>
    </>
  );
}
