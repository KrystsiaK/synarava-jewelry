"use client";

import {
  AdminCollapsiblePanel,
  AdminHelp,
  AdminLongTextField,
  AdminTextField,
} from "@/components/synarava-cms";
import type { ShopPageCopyKey } from "@/lib/content/shop-page-copy";

type ShopDraft = Record<ShopPageCopyKey, string>;

type Props = {
  draft: ShopDraft;
  updateField: <K extends ShopPageCopyKey>(key: K, value: string) => void;
};

export function ShopPageEditorSections({ draft, updateField }: Props) {
  return (
    <>
      <AdminCollapsiblePanel title="New arrivals" defaultOpen>
        <div className="grid gap-4">
          <AdminTextField
            label="New arrivals heading"
            help={<AdminHelp>Heading of the New arrivals row on /shop.</AdminHelp>}
            value={draft.shopNewTitle}
            onChange={(event) => updateField("shopNewTitle", event.target.value)}
            placeholder="New arrivals"
          />
          <AdminLongTextField
            label="New arrivals description"
            help={<AdminHelp>Sentence under the New arrivals heading.</AdminHelp>}
            value={draft.shopNewDescription}
            onChange={(value) => updateField("shopNewDescription", value)}
            placeholder="The latest pieces to enter the Synarava selection."
            rows={3}
          />
          <AdminTextField
            label="View all label"
            help={<AdminHelp>Link at the end of the New arrivals and Most popular rows.</AdminHelp>}
            value={draft.shopViewAllLabel}
            onChange={(event) => updateField("shopViewAllLabel", event.target.value)}
            placeholder="View all"
          />
        </div>
      </AdminCollapsiblePanel>

      <AdminCollapsiblePanel title="Shop by product type" defaultOpen>
        <div className="grid gap-4">
          <AdminTextField
            label="Product type heading"
            help={<AdminHelp>Heading above the product-type tiles. Tile names come from each product’s type, not from this page.</AdminHelp>}
            value={draft.shopProductTypeTitle}
            onChange={(event) => updateField("shopProductTypeTitle", event.target.value)}
            placeholder="Shop by product type"
          />
          <AdminLongTextField
            label="Product type description"
            help={<AdminHelp>Sentence under the product-type heading.</AdminHelp>}
            value={draft.shopProductTypeDescription}
            onChange={(value) => updateField("shopProductTypeDescription", value)}
            placeholder="Find what you’re looking for, from jewellery to everyday accessories"
            rows={3}
          />
        </div>
      </AdminCollapsiblePanel>

      <AdminCollapsiblePanel title="Product filtering" defaultOpen>
        <div className="grid gap-4 md:grid-cols-2">
          <AdminTextField
            label="Filter eyebrow"
            help={<AdminHelp>Small label above the filter row (“Find the right product”).</AdminHelp>}
            value={draft.shopFiltersEyebrow}
            onChange={(event) => updateField("shopFiltersEyebrow", event.target.value)}
            placeholder="Find the right product"
          />
          <AdminTextField
            label="Showing label"
            help={<AdminHelp>Caption above the catalogue count.</AdminHelp>}
            value={draft.shopFiltersShowingLabel}
            onChange={(event) => updateField("shopFiltersShowingLabel", event.target.value)}
            placeholder="Showing"
          />
          <AdminLongTextField
            className="md:col-span-2"
            label="Filter description"
            help={<AdminHelp>Sentence under the filter eyebrow.</AdminHelp>}
            value={draft.shopFiltersDescription}
            onChange={(value) => updateField("shopFiltersDescription", value)}
            placeholder="Filter by category, product type or availability to narrow your selection."
            rows={3}
          />
          <AdminTextField
            label="Category label"
            value={draft.shopFilterCategoryLabel}
            onChange={(event) => updateField("shopFilterCategoryLabel", event.target.value)}
            placeholder="Category"
          />
          <AdminTextField
            label="Product type label"
            value={draft.shopFilterProductTypeLabel}
            onChange={(event) => updateField("shopFilterProductTypeLabel", event.target.value)}
            placeholder="Product type"
          />
          <AdminTextField
            label="Availability label"
            value={draft.shopFilterAvailabilityLabel}
            onChange={(event) => updateField("shopFilterAvailabilityLabel", event.target.value)}
            placeholder="Availability"
          />
          <AdminTextField
            label="More filters label"
            help={<AdminHelp>Button that opens collection, tag, material, finish, origin, and compliance filters. The open state (“Fewer filters”) stays a system translation.</AdminHelp>}
            value={draft.shopFiltersMoreLabel}
            onChange={(event) => updateField("shopFiltersMoreLabel", event.target.value)}
            placeholder="More filters"
          />
          <AdminTextField
            className="md:col-span-2"
            label="Search placeholder"
            help={<AdminHelp>Placeholder and accessible name of the product search field.</AdminHelp>}
            value={draft.shopFiltersSearchPlaceholder}
            onChange={(event) => updateField("shopFiltersSearchPlaceholder", event.target.value)}
            placeholder="Search products"
          />
        </div>
      </AdminCollapsiblePanel>

      <AdminCollapsiblePanel title="Hero product count" defaultOpen>
        <AdminTextField
          label="Products available label"
          help={<AdminHelp>Words after the red count in the hero, for example “products available”. The number stays automatic. Leave blank to use this language’s singular and plural.</AdminHelp>}
          value={draft.shopAvailableCountLabel}
          onChange={(event) => updateField("shopAvailableCountLabel", event.target.value)}
          placeholder="products available"
        />
      </AdminCollapsiblePanel>
    </>
  );
}
