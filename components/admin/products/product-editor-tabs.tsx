"use client";

import type { ReactNode } from "react";
import {
  FileText,
  Gem,
  Images,
  PackageSearch,
  Shapes,
  Store,
  type LucideIcon,
} from "lucide-react";

import { AdminIssueInlineWarning } from "@/components/admin/issues/admin-issues-cms";
import type { AdminIssueSummary } from "@/components/admin/shared/admin-issue-types";
import {
  AdminSectionTabs,
  type AdminSectionTabGroup,
  type AdminSectionTabItem,
  type AdminSectionTabTone,
} from "@/components/admin/shared/admin-section-tabs";

export type ProductEditorSection =
  | "essentials"
  | "catalog"
  | "content"
  | "media"
  | "details"
  | "shopify";

/** Tab strip clusters — Shopify commerce skeleton vs Synarava-only sections. */
export type ProductEditorTabGroupId = "shopify" | "synarava";

type ProductEditorTab = {
  id: ProductEditorSection;
  label: string;
  shortLabel: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Which strip cluster owns this tab. */
  group: ProductEditorTabGroupId;
};

/**
 * Product editor sections.
 *
 * Shopify group = commerce skeleton pulled/pushed from Shopify (more tabs will
 * land here as we mirror Shopify’s product admin field-by-field).
 * Synarava group = editorial sections that exist only in our CMS.
 */
const PRODUCT_EDITOR_TAB_GROUPS: readonly AdminSectionTabGroup[] = [
  { id: "shopify", label: "Shopify" },
  { id: "synarava", label: "Synarava" },
];

const PRODUCT_EDITOR_TABS: ProductEditorTab[] = [
  {
    id: "essentials",
    label: "Essentials",
    shortLabel: "Sellable product",
    title: "Start with the sellable product",
    description:
      "Set the product name, handle, SKU, price, inventory, vendor, and type. These are the core values that identify what customers can buy.",
    icon: PackageSearch,
    group: "shopify",
  },
  {
    id: "catalog",
    label: "Catalog",
    shortLabel: "Placement & parameters",
    title: "Place it in the catalog",
    description:
      "Choose Shopify category, collection, and tags. Edit product parameters here (Save + Push to Shopify). Last Pull shows what Shopify currently has.",
    icon: Shapes,
    group: "shopify",
  },
  {
    id: "content",
    label: "Content",
    shortLabel: "Copy & search",
    title: "Shape the product story",
    description:
      "Write the customer-facing description, translations, symbolism, and search copy. Empty translations safely fall back to English.",
    icon: FileText,
    group: "shopify",
  },
  {
    id: "media",
    label: "Media",
    shortLabel: "Gallery & cover",
    title: "Build the product gallery",
    description:
      "Add and order the images customers will browse. The first image becomes the catalog cover and is sent to Shopify first. Gallery changes save immediately.",
    icon: Images,
    group: "shopify",
  },
  {
    id: "shopify",
    label: "Sync",
    shortLabel: "Push, pull & snapshot",
    title: "Review the commerce connection",
    description:
      "Compare the saved Synarava record with Shopify, push or pull intentional changes, and inspect the last stored commerce snapshot.",
    icon: Store,
    group: "shopify",
  },
  {
    id: "details",
    label: "Product page",
    shortLabel: "Materials & craft",
    title: "Explain what makes it special",
    description:
      "Synarava-only editorial sections: materials story, process, and lookbook. These enrich the product page without replacing Shopify commerce data.",
    icon: Gem,
    group: "synarava",
  },
];

function ProductSectionGraphic({ section: _section }: { section: ProductEditorSection }) {
  return (
    <svg
      className="h-full w-full"
      viewBox="0 0 600 300"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-labelledby="product-section-graphic-title product-section-graphic-desc"
    >
      <title id="product-section-graphic-title">Abstract catalog hierarchy</title>
      <desc id="product-section-graphic-desc">
        Two upper cards connect to one centered lower card above a shallow arc, drawn with restrained cubist geometry.
      </desc>

      <g fill="none" stroke="#201F1B" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M174 124 L176 143 L296 145" />
        <path d="M426 123 L423 142 L304 145" />
        <path d="M300 145 L298 166" />
      </g>

      <g stroke="#201F1B" strokeWidth="6" strokeLinejoin="round">
        <path fill="#F4EEDF" d="M94 43 L242 38 L248 118 L101 124 Z" />
        <path fill="#B6A895" d="M94 43 L151 40 L139 121 L101 124 Z" />
        <path fill="#D0A846" d="M151 40 L242 38 L215 77 L139 121 Z" />
        <path fill="#F4EEDF" d="M215 77 L248 118 L139 121 Z" />
        <path fill="none" d="M151 40 L139 121 M215 77 L248 118" strokeWidth="4" />
      </g>

      <g stroke="#201F1B" strokeWidth="6" strokeLinejoin="round">
        <path fill="#F4EEDF" d="M356 42 L503 47 L496 123 L350 118 Z" />
        <path fill="#D0A846" d="M356 42 L430 45 L446 87 L350 118 Z" />
        <path fill="#B6A895" d="M430 45 L503 47 L496 123 L446 87 Z" />
        <path fill="#F4EEDF" d="M350 118 L446 87 L496 123 Z" />
        <path fill="none" d="M430 45 L446 87 M350 118 L446 87" strokeWidth="4" />
      </g>

      <g stroke="#201F1B" strokeWidth="6" strokeLinejoin="round">
        <path fill="#F4EEDF" d="M230 169 L370 164 L377 239 L224 243 Z" />
        <path fill="#B6A895" d="M230 169 L294 167 L273 241 L224 243 Z" />
        <path fill="#D0A846" d="M294 167 L370 164 L343 207 L273 241 Z" />
        <path fill="#F4EEDF" d="M343 207 L377 239 L273 241 Z" />
        <path fill="none" d="M294 167 L273 241 M343 207 L377 239" strokeWidth="4" />
      </g>

      <path
        d="M78 272 C151 248 225 251 299 264 C372 277 449 278 522 257"
        fill="none"
        stroke="#201F1B"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M112 266 C175 254 235 257 299 268"
        fill="none"
        stroke="#B6A895"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function resolveTabTone(
  id: ProductEditorSection,
  issueSet: ReadonlySet<ProductEditorSection>,
  conflictSet: ReadonlySet<ProductEditorSection>,
): AdminSectionTabTone {
  if (issueSet.has(id)) return "issue";
  if (conflictSet.has(id)) return "conflict";
  return "default";
}

export function ProductEditorTabs({
  active,
  onChange,
  includeShopify = true,
  dirtySections,
  issueSections,
  conflictSections,
  sectionIssues,
  onIssueActivate,
  embedded = false,
  aside = null,
  children = null,
}: {
  active: ProductEditorSection;
  onChange: (section: ProductEditorSection) => void;
  includeShopify?: boolean;
  /** Sections with unsaved edits — amber dirty dot. */
  dirtySections?: ReadonlySet<ProductEditorSection> | readonly ProductEditorSection[];
  /** Sections with open QA issues — issue tone. */
  issueSections?: ReadonlySet<ProductEditorSection> | readonly ProductEditorSection[];
  /** Sections with Shopify sync conflicts — conflict tone (issue wins if both). */
  conflictSections?: ReadonlySet<ProductEditorSection> | readonly ProductEditorSection[];
  /** Open issues owned by the active section — listed under the description. */
  sectionIssues?: AdminIssueSummary[];
  onIssueActivate?: (issue: AdminIssueSummary) => void;
  /** Inside the locale workspace shell — no nested card radii. */
  embedded?: boolean;
  /** Header actions for the active section (e.g. locale sync controls). */
  aside?: React.ReactNode;
  /**
   * Active section body (tabpanel fields). Must live here — not as a sibling —
   * so sticky tabs/title share one containing block with the scrollable content.
   */
  children?: ReactNode;
}) {
  const tabs = includeShopify
    ? PRODUCT_EDITOR_TABS
    : PRODUCT_EDITOR_TABS.filter((tab) => tab.id !== "shopify");
  const activeTab = tabs.find((tab) => tab.id === active) ?? tabs[0];
  const dirtySet = dirtySections instanceof Set
    ? dirtySections
    : new Set(dirtySections ?? []);
  const issueSet = issueSections instanceof Set
    ? issueSections
    : new Set(issueSections ?? []);
  const conflictSet = conflictSections instanceof Set
    ? conflictSections
    : new Set(conflictSections ?? []);
  const hasSectionIssues = Boolean(sectionIssues && sectionIssues.length > 0);

  const items: AdminSectionTabItem[] = tabs.map((tab) => ({
    id: tab.id,
    label: tab.label,
    detail: tab.shortLabel,
    icon: tab.icon,
    group: tab.group,
    dirty: dirtySet.has(tab.id),
    tone: resolveTabTone(tab.id, issueSet, conflictSet),
  }));

  const visibleGroups = PRODUCT_EDITOR_TAB_GROUPS.filter((group) =>
    items.some((item) => item.group === group.id),
  );

  return (
    <div data-component="ProductEditorTabs">
      <AdminSectionTabs
        items={items}
        groups={visibleGroups}
        active={activeTab.id}
        onChange={(id) => onChange(id as ProductEditorSection)}
        aria-label="Product editor sections"
        embedded={embedded}
        idPrefix="product-editor-tab"
      >
        <header
          aria-live="polite"
          className={
            embedded
              ? "adm-product-section-header border-b"
              : "adm-band flex flex-wrap items-center justify-between gap-3 border-b"
          }
          style={{ borderColor: "color-mix(in srgb, var(--adm-cool) 18%, var(--adm-border))" }}
        >
          <h2 className="min-w-0 text-xl font-semibold tracking-[-0.02em] text-[var(--adm-ink)]">
            {activeTab.title}
          </h2>
          {aside != null ? (
            <div className="flex shrink-0 items-center justify-end gap-1.5">{aside}</div>
          ) : null}
        </header>

        <section className="adm-section-tabs__intro adm-inset-x">
          <p className="max-w-[68ch] text-sm leading-6 text-[var(--adm-muted)]">
            {activeTab.description}
          </p>
          <div className="mx-auto h-28 w-full max-w-52 text-[var(--adm-ink)] md:mx-0 md:justify-self-end">
            <ProductSectionGraphic section={activeTab.id} />
          </div>
        </section>

        {hasSectionIssues ? (
          <div
            className="adm-inset-x py-[var(--adm-band-pad-y)]"
            style={{ borderTop: "1px solid color-mix(in srgb, var(--adm-cool) 16%, var(--adm-border))" }}
          >
            <AdminIssueInlineWarning
              issues={sectionIssues!}
              className="w-full"
              onIssueActivate={onIssueActivate}
            />
          </div>
        ) : null}

        {children}
      </AdminSectionTabs>
    </div>
  );
}
