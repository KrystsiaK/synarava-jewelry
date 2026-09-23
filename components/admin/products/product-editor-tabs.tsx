"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
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

export type ProductEditorSection =
  | "essentials"
  | "catalog"
  | "content"
  | "media"
  | "details"
  | "shopify";

type ProductEditorTab = {
  id: ProductEditorSection;
  label: string;
  shortLabel: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

const PRODUCT_EDITOR_TABS: ProductEditorTab[] = [
  {
    id: "essentials",
    label: "Essentials",
    shortLabel: "Sellable product",
    title: "Start with the sellable product",
    description:
      "Set the product name, handle, SKU, price, inventory, vendor, and type. These are the core values that identify what customers can buy.",
    icon: PackageSearch,
  },
  {
    id: "catalog",
    label: "Catalog",
    shortLabel: "Placement & filters",
    title: "Place it in the catalog",
    description:
      "Choose the Shopify category, Synarava collection, department, tags, and product characteristics. These settings power navigation, filters, and product discovery.",
    icon: Shapes,
  },
  {
    id: "content",
    label: "Content",
    shortLabel: "Copy & search",
    title: "Shape the product story",
    description:
      "Write the customer-facing description, translations, symbolism, and search copy. Empty translations safely fall back to English.",
    icon: FileText,
  },
  {
    id: "media",
    label: "Media",
    shortLabel: "Gallery & cover",
    title: "Build the product gallery",
    description:
      "Add and order the images customers will browse. The first image becomes the catalog cover and is sent to Shopify first. Gallery changes save immediately.",
    icon: Images,
  },
  {
    id: "details",
    label: "Product page",
    shortLabel: "Materials & craft",
    title: "Explain what makes it special",
    description:
      "Add dimensions, materials, process, and lookbook content. These details enrich the Synarava product page without replacing Shopify commerce data.",
    icon: Gem,
  },
  {
    id: "shopify",
    label: "Shopify",
    shortLabel: "Sync & source data",
    title: "Review the commerce connection",
    description:
      "Compare the saved Synarava record with Shopify, push or pull intentional changes, and inspect the last stored commerce snapshot.",
    icon: Store,
  },
];

function ProductSectionGraphic({ section }: { section: ProductEditorSection }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
  };

  return (
    <svg
      aria-hidden="true"
      className="h-full w-full"
      viewBox="0 0 220 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18 96C58 109 164 110 204 94" stroke="var(--adm-border-strong)" strokeWidth="1.5" />
      {section === "essentials" ? (
        <>
          <path d="M58 25h78l29 29-66 49-63-50 22-28Z" fill="var(--adm-accent-soft)" stroke="var(--adm-accent)" strokeWidth="2" />
          <path d="M84 42h31M73 57h51M88 72h30" {...common} />
          <circle cx="145" cy="49" r="7" fill="var(--adm-panel)" stroke="var(--adm-accent)" strokeWidth="2" />
          <path d="m152 78 14-13 17 18-14 13-17-18Z" fill="var(--adm-panel-elevated)" stroke="var(--adm-ink)" strokeWidth="2" />
          <path d="m160 81 5 5 11-11" {...common} />
        </>
      ) : null}
      {section === "content" ? (
        <>
          <path d="M55 18h91l22 22v64H55V18Z" fill="var(--adm-panel-elevated)" stroke="var(--adm-ink)" strokeWidth="2" />
          <path d="M146 18v23h22" {...common} />
          <path d="M76 48h53M76 62h70M76 76h47" stroke="var(--adm-muted)" strokeWidth="3" strokeLinecap="round" />
          <path d="m153 67 5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2 5-10Z" fill="var(--adm-accent-soft)" stroke="var(--adm-accent)" strokeWidth="2" strokeLinejoin="round" />
        </>
      ) : null}
      {section === "catalog" ? (
        <>
          <rect x="45" y="24" width="55" height="37" rx="6" fill="var(--adm-panel-elevated)" stroke="var(--adm-ink)" strokeWidth="2" />
          <rect x="121" y="24" width="55" height="37" rx="6" fill="var(--adm-accent-soft)" stroke="var(--adm-accent)" strokeWidth="2" />
          <rect x="83" y="76" width="55" height="29" rx="6" fill="var(--adm-panel)" stroke="var(--adm-ink)" strokeWidth="2" />
          <path d="M73 61v7h76v-7M111 68v8" stroke="var(--adm-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M60 39h25M136 39h25M97 90h27" stroke="var(--adm-border-strong)" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : null}
      {section === "media" ? (
        <>
          <rect x="42" y="27" width="103" height="70" rx="8" fill="var(--adm-panel-elevated)" stroke="var(--adm-ink)" strokeWidth="2" />
          <rect x="73" y="16" width="105" height="72" rx="8" fill="var(--adm-panel)" stroke="var(--adm-accent)" strokeWidth="2" />
          <circle cx="99" cy="41" r="8" fill="var(--adm-accent-soft)" stroke="var(--adm-accent)" strokeWidth="2" />
          <path d="m82 76 25-22 17 15 13-10 28 17H82Z" fill="var(--adm-accent-soft)" stroke="var(--adm-ink)" strokeWidth="2" strokeLinejoin="round" />
          <path d="M57 107h108" stroke="var(--adm-border-strong)" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : null}
      {section === "details" ? (
        <>
          <path d="M109 17 145 43l-14 43H87L73 43l36-26Z" fill="var(--adm-accent-soft)" stroke="var(--adm-accent)" strokeWidth="2" strokeLinejoin="round" />
          <path d="m73 43 36 43 36-43M87 86l22-69 22 69M73 43h72" {...common} />
          <path d="M45 93h128" stroke="var(--adm-ink)" strokeWidth="2" strokeLinecap="round" />
          {[53, 67, 81, 95, 109, 123, 137, 151, 165].map((x, index) => (
            <path key={x} d={`M${x} 93v${index % 2 === 0 ? 9 : 5}`} stroke="var(--adm-muted)" strokeWidth="2" />
          ))}
        </>
      ) : null}
      {section === "shopify" ? (
        <>
          <path d="M58 46h59v50H58V46Z" fill="var(--adm-panel-elevated)" stroke="var(--adm-ink)" strokeWidth="2" />
          <path d="M71 46c0-14 7-24 17-24s17 10 17 24" {...common} />
          <path d="M140 36h34v34h-34z" fill="var(--adm-accent-soft)" stroke="var(--adm-accent)" strokeWidth="2" />
          <path d="m149 53 6 6 11-13" {...common} />
          <path d="M124 57h12m-6-6 6 6-6 6M137 84h-12m6-6-6 6 6 6" stroke="var(--adm-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
    </svg>
  );
}

export function ProductEditorTabs({
  active,
  onChange,
  includeShopify = true,
  dirtySections,
  issueSections,
  sectionIssues,
  onIssueActivate,
  embedded = false,
  aside = null,
}: {
  active: ProductEditorSection;
  onChange: (section: ProductEditorSection) => void;
  includeShopify?: boolean;
  /** Sections with unsaved edits — shows a dirty marker on that tab. */
  dirtySections?: ReadonlySet<ProductEditorSection> | readonly ProductEditorSection[];
  /** Sections with open QA issues — tints that tab. */
  issueSections?: ReadonlySet<ProductEditorSection> | readonly ProductEditorSection[];
  /** Open issues owned by the active section — listed under the description. */
  sectionIssues?: AdminIssueSummary[];
  onIssueActivate?: (issue: AdminIssueSummary) => void;
  /** Inside the locale workspace shell — no nested card radii. */
  embedded?: boolean;
  /** Header actions for the active section (e.g. locale sync controls). */
  aside?: React.ReactNode;
}) {
  const tabs = includeShopify
    ? PRODUCT_EDITOR_TABS
    : PRODUCT_EDITOR_TABS.filter((tab) => tab.id !== "shopify");
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeTab = tabs.find((tab) => tab.id === active) ?? tabs[0];
  const dirtySet = dirtySections instanceof Set
    ? dirtySections
    : new Set(dirtySections ?? []);
  const issueSet = issueSections instanceof Set
    ? issueSections
    : new Set(issueSections ?? []);
  const hasSectionIssues = Boolean(sectionIssues && sectionIssues.length > 0);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex == null) return;

    event.preventDefault();
    onChange(tabs[nextIndex].id);
    buttonRefs.current[nextIndex]?.focus();
  }

  return (
    <div data-component="ProductEditorTabs" className="grid gap-0" data-embedded={embedded ? "true" : undefined}>
      <div
        role="tablist"
        aria-label="Product editor sections"
        className={[
          "grid grid-cols-2 gap-px bg-[var(--locale-tone-border,var(--adm-border))] md:grid-cols-3",
          includeShopify ? "xl:grid-cols-6" : "xl:grid-cols-5",
          embedded
            ? "adm-product-section-tabs border-0"
            : "overflow-hidden rounded-t-lg border border-b-0 border-[var(--adm-border)]",
        ].join(" ")}
      >
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const selected = tab.id === activeTab.id;
          const hasIssue = issueSet.has(tab.id);
          return (
            <button
              key={tab.id}
              ref={(element) => { buttonRefs.current[index] = element; }}
              id={`product-editor-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              data-dirty={dirtySet.has(tab.id) ? "true" : undefined}
              data-issue={hasIssue ? "true" : undefined}
              className={[
                "group flex min-h-16 items-center gap-3 px-3 py-3 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--adm-accent)]",
                hasIssue
                  ? "bg-[color-mix(in_srgb,var(--adm-danger)_10%,var(--adm-panel))] hover:bg-[color-mix(in_srgb,var(--adm-danger)_14%,var(--adm-panel))] aria-selected:bg-[color-mix(in_srgb,var(--adm-danger)_16%,var(--adm-panel))]"
                  : "bg-[var(--adm-panel)] hover:bg-[var(--adm-panel-elevated)] aria-selected:bg-[color-mix(in_srgb,var(--locale-tone-accent,var(--adm-accent))_14%,var(--adm-panel))]",
              ].join(" ")}
            >
              <span
                className={[
                  "grid size-9 shrink-0 place-items-center rounded-md border transition-colors group-aria-selected:bg-[var(--adm-panel)]",
                  hasIssue
                    ? "border-[color-mix(in_srgb,var(--adm-danger)_45%,var(--adm-border))] text-[var(--adm-danger)] group-aria-selected:border-[var(--adm-danger)] group-aria-selected:text-[var(--adm-danger)]"
                    : "text-[var(--adm-muted)] group-aria-selected:border-[var(--locale-tone-accent,var(--adm-border-strong))] group-aria-selected:text-[var(--locale-tone-accent,var(--adm-accent))]",
                ].join(" ")}
                style={hasIssue ? undefined : { borderColor: "var(--adm-border)" }}
                aria-hidden="true"
              >
                <Icon size={18} strokeWidth={1.7} />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--adm-ink)]">
                  {tab.label}
                  {dirtySet.has(tab.id) ? (
                    <span
                      className="inline-block size-1.5 shrink-0 rounded-full bg-[var(--adm-warning)]"
                      title="Unsaved edits"
                      aria-label={`${tab.label} has unsaved edits`}
                    />
                  ) : null}
                  {hasIssue ? (
                    <span
                      className="inline-block size-1.5 shrink-0 rounded-full bg-[var(--adm-danger)]"
                      title="Open problem"
                      aria-label={`${tab.label} has open problems`}
                    />
                  ) : null}
                </span>
                <span className="mt-0.5 block truncate text-[0.68rem] text-[var(--adm-muted)]">{tab.shortLabel}</span>
              </span>
            </button>
          );
        })}
      </div>

      <header
        aria-live="polite"
        className={[
          "flex flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-6",
          embedded
            ? "adm-product-section-header border-t border-[var(--locale-tone-border,var(--adm-border))] bg-transparent"
            : "border border-t-0 border-[var(--adm-border)] bg-[var(--adm-bg-soft)]",
        ].join(" ")}
      >
        <h2 className="min-w-0 text-xl font-semibold tracking-[-0.02em] text-[var(--adm-ink)]">
          {activeTab.title}
        </h2>
        {aside != null ? (
          <div className="flex shrink-0 items-center justify-end gap-1.5">{aside}</div>
        ) : null}
      </header>

      <section
        className={[
          "grid items-center gap-5 px-5 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:px-6",
          embedded
            ? "border-t border-[var(--locale-tone-border,var(--adm-border))] bg-transparent"
            : "border border-t-0 border-[var(--adm-border)] bg-[var(--adm-bg-soft)]",
        ].join(" ")}
      >
        <p className="max-w-[68ch] text-sm leading-6 text-[var(--adm-muted)]">
          {activeTab.description}
        </p>
        <div className="mx-auto h-28 w-full max-w-52 text-[var(--adm-ink)] md:mx-0 md:justify-self-end">
          <ProductSectionGraphic section={activeTab.id} />
        </div>
      </section>

      {hasSectionIssues ? (
        <div
          className={[
            "px-5 py-4 md:px-6",
            embedded
              ? "border-t border-[var(--locale-tone-border,var(--adm-border))]"
              : "border border-t-0 border-[var(--adm-border)] bg-[var(--adm-bg-soft)]",
            !embedded ? "rounded-b-lg" : "",
          ].join(" ")}
        >
          <AdminIssueInlineWarning
            issues={sectionIssues!}
            className="w-full"
            onIssueActivate={onIssueActivate}
          />
        </div>
      ) : !embedded ? (
        <div className="rounded-b-lg border border-t-0 border-[var(--adm-border)]" aria-hidden="true" />
      ) : null}
    </div>
  );
}
