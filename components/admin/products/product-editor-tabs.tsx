"use client";

import { useState, useId, type ReactNode } from "react";
import { motion, useReducedMotion, type Transition } from "motion/react";
import {
  CircleDollarSign,
  ClipboardList,
  Gem,
  Images,
  Package,
  PackageSearch,
  Store,
  Tags,
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
  | "price"
  | "inventory"
  | "metafields"
  | "media"
  | "details"
  | "passport"
  | "shopify";

/** Tab strip clusters — Shopify commerce skeleton vs Synarava-only sections. */
export type ProductEditorTabGroupId = "shopify" | "synarava";

type ProductEditorTab = {
  id: ProductEditorSection;
  label: string;
  /** Chip in the strip. Full `label` stays in the accessible name. */
  stripLabel: string;
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
  { id: "shopify", label: "Shopify", compactLabel: "Shop" },
  { id: "synarava", label: "Synarava", compactLabel: "Syn" },
];

const PRODUCT_EDITOR_TABS: ProductEditorTab[] = [
  {
    id: "essentials",
    label: "Product",
    stripLabel: "Product",
    shortLabel: "Title & organization",
    title: "Product identity",
    description:
      "Title, handle, vendor, product type, tags, description, SEO, category, collection, and publish state — Shopify product header and organization. Inventory and shipping live on Inventory; custom metafields on Metafields; jewelry passport on Synarava → Passport.",
    icon: PackageSearch,
    group: "shopify",
  },
  {
    id: "price",
    label: "Price",
    stripLabel: "Price",
    shortLabel: "Sell & tax",
    title: "Set the selling price",
    description:
      "Price, compare-at, tax, and cost mirror Shopify’s Price card on the variant. Profit and margin are calculated locally from price and cost.",
    icon: CircleDollarSign,
    group: "shopify",
  },
  {
    id: "inventory",
    label: "Inventory",
    stripLabel: "Stock",
    shortLabel: "Stock & shipping",
    title: "Inventory and shipping",
    description:
      "Primary-variant SKU and available quantity (Save + Push). Location breakdown, barcode, tracking, sell-when-out-of-stock, weight, origin, and HS code come from the last Pull — edit those in Shopify Admin for now. Variants stay on Sync until a Variants tab exists.",
    icon: Package,
    group: "shopify",
  },
  {
    id: "metafields",
    label: "Metafields",
    stripLabel: "Fields",
    shortLabel: "Custom definitions",
    title: "Product metafields",
    description:
      "Merchant-owned Shopify metafields (same as Shopify Admin → Metafields). Add definitions shop-wide and edit this product’s values. Jewelry passport fields live under Synarava → Passport.",
    icon: Tags,
    group: "shopify",
  },
  {
    id: "media",
    label: "Media",
    stripLabel: "Media",
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
    stripLabel: "Sync",
    shortLabel: "Push, pull & snapshot",
    title: "Review the commerce connection",
    description:
      "Compare the saved Synarava record with Shopify, push or pull intentional changes, and inspect the last stored commerce snapshot.",
    icon: Store,
    group: "shopify",
  },
  {
    id: "passport",
    label: "Passport",
    stripLabel: "Pass",
    shortLabel: "Jewelry specs",
    title: "Product passport",
    description:
      "Synarava jewelry parameters (fit, materials, care, compliance). Save locally; Push mirrors them as synarava.* metafields. Not Shopify Admin collapsible rows.",
    icon: ClipboardList,
    group: "synarava",
  },
  {
    id: "details",
    label: "Product page",
    stripLabel: "Page",
    shortLabel: "Story & craft",
    title: "Synarava product page",
    description:
      "Synarava-only editorial: short blurb, material line, symbolism, materials story, process, and lookbook. Not pushed as Shopify description.",
    icon: Gem,
    group: "synarava",
  },
];

const MARK_CREAM = "#F7F1E6";
const MARK_TAUPE = "#C9B8A4";
const MARK_GOLD = "#D4A853";

function MarkGround() {
  return <ellipse cx="100" cy="102" rx="54" ry="5.5" fill="currentColor" opacity="0.09" />;
}

function MarkPlate({
  x,
  y,
  width,
  height,
  radius = 14,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
}) {
  return (
    <>
      <rect x={x + 7} y={y + 7} width={width} height={height} rx={radius} fill={MARK_TAUPE} />
      <rect x={x} y={y} width={width} height={height} rx={radius} fill={MARK_CREAM} />
    </>
  );
}

const SECTION_MARKS: Record<ProductEditorSection, { title: string; description: string; art: ReactNode }> = {
  essentials: {
    title: "Product card",
    description: "A cream product card with a gold setting and two short lines.",
    art: (
      <>
        <MarkPlate x={64} y={24} width={72} height={58} radius={16} />
        <circle cx="100" cy="44" r="9" fill={MARK_GOLD} />
        <circle cx="100" cy="44" r="4" fill={MARK_CREAM} />
        <rect x="82" y="60" width="36" height="4" rx="2" fill="currentColor" opacity="0.32" />
        <rect x="88" y="68" width="24" height="3" rx="1.5" fill="currentColor" opacity="0.18" />
      </>
    ),
  },
  price: {
    title: "Price coin",
    description: "A gold-ringed coin in front of a small receipt.",
    art: (
      <>
        <MarkPlate x={108} y={26} width={34} height={48} radius={10} />
        <rect x="116" y="38" width="18" height="3" rx="1.5" fill="currentColor" opacity="0.22" />
        <rect x="116" y="46" width="14" height="3" rx="1.5" fill="currentColor" opacity="0.14" />
        <circle cx="84" cy="66" r="24" fill={MARK_TAUPE} />
        <circle cx="76" cy="58" r="24" fill={MARK_CREAM} />
        <circle cx="76" cy="58" r="15" fill="none" stroke={MARK_GOLD} strokeWidth="3.5" />
      </>
    ),
  },
  inventory: {
    title: "Stacked parcels",
    description: "Two rounded parcels, the front one closed with a gold band.",
    art: (
      <>
        <MarkPlate x={102} y={40} width={54} height={40} radius={12} />
        <MarkPlate x={40} y={30} width={60} height={46} radius={12} />
        <rect x="52" y="30" width="36" height="9" rx="4" fill={MARK_GOLD} />
      </>
    ),
  },
  metafields: {
    title: "Field tags",
    description: "Three rounded tags, the front one cream with a punch hole.",
    art: (
      <>
        <rect x="62" y="62" width="84" height="22" rx="11" fill={MARK_TAUPE} />
        <rect x="54" y="44" width="84" height="22" rx="11" fill={MARK_GOLD} />
        <rect x="46" y="26" width="88" height="24" rx="12" fill={MARK_CREAM} />
        <circle cx="64" cy="38" r="4.5" fill="currentColor" opacity="0.22" />
      </>
    ),
  },
  media: {
    title: "Photo frames",
    description: "Two overlapping frames, the larger one holding a gold sun and a hill.",
    art: (
      <>
        <MarkPlate x={104} y={34} width={50} height={42} radius={12} />
        <MarkPlate x={40} y={24} width={66} height={52} radius={12} />
        <circle cx="58" cy="40" r="6" fill={MARK_GOLD} />
        <path d="M50 68 L64 54 L76 64 L90 52 L98 68 Z" fill={MARK_TAUPE} />
      </>
    ),
  },
  shopify: {
    title: "Sync link",
    description: "Two rounded tiles joined by a curve and gold endpoints.",
    art: (
      <>
        <MarkPlate x={30} y={32} width={46} height={46} radius={14} />
        <path d="M42 48 h22" stroke={MARK_GOLD} strokeWidth="3" strokeLinecap="round" />
        <path d="M42 58 h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.2" />
        <MarkPlate x={124} y={32} width={46} height={46} radius={14} />
        <rect x="136" y="46" width="22" height="16" rx="3" fill={MARK_TAUPE} />
        <path
          d="M76 56 C92 42 108 74 124 54"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.35"
        />
        <circle cx="76" cy="56" r="3.5" fill={MARK_GOLD} />
        <circle cx="124" cy="54" r="3.5" fill={MARK_GOLD} />
      </>
    ),
  },
  passport: {
    title: "Passport sheet",
    description: "A cream sheet with a gold corner and a round seal.",
    art: (
      <>
        <MarkPlate x={68} y={16} width={62} height={74} radius={12} />
        <path d="M106 16 h24 v16 a10 10 0 0 1 -10 10 h-14 z" fill={MARK_GOLD} />
        <circle cx="99" cy="52" r="10" fill="none" stroke={MARK_GOLD} strokeWidth="2.5" />
        <rect x="84" y="70" width="30" height="3" rx="1.5" fill="currentColor" opacity="0.28" />
        <rect x="88" y="78" width="22" height="3" rx="1.5" fill="currentColor" opacity="0.16" />
      </>
    ),
  },
  details: {
    title: "Open pages",
    description: "Two facing pages, the right one marked with a gold stone.",
    art: (
      <>
        <MarkPlate x={108} y={22} width={52} height={66} radius={10} />
        <MarkPlate x={40} y={22} width={52} height={66} radius={10} />
        <rect x="52" y="38" width="28" height="3.5" rx="1.75" fill="currentColor" opacity="0.28" />
        <rect x="52" y="48" width="20" height="3" rx="1.5" fill="currentColor" opacity="0.16" />
        <circle cx="134" cy="46" r="8" fill={MARK_GOLD} />
        <circle cx="134" cy="46" r="3.5" fill={MARK_CREAM} />
      </>
    ),
  },
};

function ProductSectionGraphic({ section }: { section: ProductEditorSection }) {
  const titleId = useId();
  const descId = useId();
  const mark = SECTION_MARKS[section];

  return (
    <svg
      className="h-full w-full"
      viewBox="0 0 200 112"
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
    >
      <title id={titleId}>{mark.title}</title>
      <desc id={descId}>{mark.description}</desc>
      <MarkGround />
      {mark.art}
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

/** Critically damped settle — Apple “move” response, no overshoot. */
const TAB_OPEN: Transition = { type: "spring", bounce: 0, duration: 0.4 };
const TAB_FADE: Transition = { duration: 0.16, ease: [0.23, 1, 0.32, 1] };

function useSectionTravel(sectionId: ProductEditorSection, order: readonly ProductEditorSection[]) {
  const [travel, setTravel] = useState({ id: sectionId, direction: 0, opened: false });
  if (travel.id !== sectionId) {
    const prevIndex = order.indexOf(travel.id);
    const nextIndex = order.indexOf(sectionId);
    setTravel({
      id: sectionId,
      direction: Math.sign(nextIndex - prevIndex) || 1,
      opened: true,
    });
  }
  return travel;
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
    : PRODUCT_EDITOR_TABS.filter((tab) => tab.id !== "shopify" && tab.id !== "metafields");
  const activeTab = tabs.find((tab) => tab.id === active) ?? tabs[0];
  const travel = useSectionTravel(
    activeTab.id,
    tabs.map((tab) => tab.id),
  );
  const reduceMotion = useReducedMotion();
  const openTransition = reduceMotion ? TAB_FADE : TAB_OPEN;
  const introFrom = !travel.opened
    ? false
    : reduceMotion
      ? { opacity: 0 }
      : { opacity: 0, x: travel.direction * 18, y: 8 };
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
    stripLabel: tab.stripLabel,
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
          <motion.h2
            key={activeTab.id}
            className="min-w-0 text-xl font-semibold tracking-[-0.02em] text-[var(--adm-ink)]"
            initial={travel.opened ? { opacity: 0, y: reduceMotion ? 0 : 6 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={openTransition}
          >
            {activeTab.title}
          </motion.h2>
          {aside != null ? (
            <div className="flex shrink-0 items-center justify-end gap-1.5">{aside}</div>
          ) : null}
        </header>

        <motion.section
          key={activeTab.id}
          className="adm-section-tabs__intro adm-inset-x"
          initial={introFrom}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={openTransition}
        >
          <p className="max-w-[68ch] text-sm leading-6 text-[var(--adm-muted)]">
            {activeTab.description}
          </p>
          <motion.div
            className="mx-auto h-28 w-full max-w-52 text-[var(--adm-ink)] md:mx-0 md:justify-self-end"
            initial={travel.opened && !reduceMotion ? { opacity: 0, scale: 0.94 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={openTransition}
            style={{ transformOrigin: "50% 60%" }}
          >
            <ProductSectionGraphic section={activeTab.id} />
          </motion.div>
        </motion.section>

        {/*
          Do not key this wrapper by section. ProductFormFields (and siblings)
          must stay mounted across tab changes so controlled create/edit drafts
          survive — a section key remounts children and wipes unsaved values
          (and flashes opacity:0 over the whole panel in tests).
        */}
        <div>
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
        </div>
      </AdminSectionTabs>
    </div>
  );
}
