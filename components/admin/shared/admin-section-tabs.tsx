"use client";

import {
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/ui";

/** Visual attention on a section tab. Issue wins over conflict when both apply. */
export type AdminSectionTabTone = "default" | "issue" | "conflict";

/**
 * Optional cluster in the tab strip (e.g. Shopify commerce vs Synarava editorial).
 * When `groups` is set, every item should reference a `group` id.
 */
export type AdminSectionTabGroup = {
  id: string;
  /** Short strip label — “Shopify”, “Synarava”. */
  label: string;
};

export type AdminSectionTabItem = {
  id: string;
  label: string;
  /** Secondary line under the label (e.g. “Copy & search”). */
  detail?: string;
  icon?: LucideIcon;
  tone?: AdminSectionTabTone;
  /** Unsaved local edits — amber dot, independent of tone. */
  dirty?: boolean;
  /** Optional group id when `AdminSectionTabs.groups` is provided. */
  group?: string;
};

export type AdminSectionTabsProps = {
  items: AdminSectionTabItem[];
  active: string;
  onChange: (id: string) => void;
  /**
   * Visual clusters in the tab strip. Order defines left-to-right layout.
   * Items without a matching `group` render in an unlabeled leftover cluster.
   */
  groups?: readonly AdminSectionTabGroup[];
  /** Accessible name for the tablist. */
  "aria-label"?: string;
  /**
   * Grid columns at xl when ungrouped. Defaults to `items.length` (capped at 6).
   * Ignored when `groups` is set — each group sizes to its item count.
   * Below xl: 3 cols on md, 2 on small.
   */
  columns?: number;
  /** Nested inside another panel — flush sticky chrome, no outer radii. */
  embedded?: boolean;
  /** Prefix for tab button ids (`{prefix}-{id}`). Default `adm-section-tab`. */
  idPrefix?: string;
  className?: string;
  /**
   * Everything below the tab strip lives in the cool “well”
   * (title, description, fields) so the open section reads as one surface.
   */
  children?: ReactNode;
};

function toneFor(item: AdminSectionTabItem): AdminSectionTabTone {
  return item.tone === "issue" || item.tone === "conflict" ? item.tone : "default";
}

type ResolvedGroup = {
  id: string;
  label: string | null;
  items: AdminSectionTabItem[];
};

function resolveGroups(
  items: AdminSectionTabItem[],
  groups: readonly AdminSectionTabGroup[] | undefined,
): ResolvedGroup[] {
  if (!groups || groups.length === 0) {
    return [{ id: "__all", label: null, items }];
  }

  const used = new Set<string>();
  const resolved: ResolvedGroup[] = [];

  for (const group of groups) {
    const groupItems = items.filter((item) => item.group === group.id);
    for (const item of groupItems) used.add(item.id);
    if (groupItems.length === 0) continue;
    resolved.push({ id: group.id, label: group.label, items: groupItems });
  }

  const leftovers = items.filter((item) => !used.has(item.id));
  if (leftovers.length > 0) {
    resolved.push({ id: "__ungrouped", label: null, items: leftovers });
  }

  return resolved.length > 0 ? resolved : [{ id: "__all", label: null, items }];
}

/**
 * Shared admin section tabs — card strip + cool content well.
 * States: idle / hover / selected (+ hover) × default | issue | conflict.
 * Optional `groups` split the strip into labeled clusters (Shopify vs Synarava).
 * Prefer this over ad-hoc product tab markup.
 */
export function AdminSectionTabs({
  items,
  active,
  onChange,
  groups,
  "aria-label": ariaLabel = "Sections",
  columns,
  embedded = false,
  idPrefix = "adm-section-tab",
  className,
  children,
}: AdminSectionTabsProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeItem = items.find((item) => item.id === active) ?? items[0];
  const colCount = Math.min(Math.max(columns ?? items.length, 2), 6);
  const resolvedGroups = resolveGroups(items, groups);
  const grouped = Boolean(groups && groups.length > 0);
  const flatItems = resolvedGroups.flatMap((group) => group.items);
  const flatIndexById = new Map(flatItems.map((item, index) => [item.id, index]));

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, flatIndex: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (flatIndex + 1) % flatItems.length;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (flatIndex - 1 + flatItems.length) % flatItems.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = flatItems.length - 1;
    if (nextIndex == null) return;

    event.preventDefault();
    onChange(flatItems[nextIndex].id);
    buttonRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      data-component="AdminSectionTabs"
      data-embedded={embedded ? "true" : undefined}
      data-grouped={grouped ? "true" : undefined}
      className={cn("adm-section-tabs", className)}
    >
      <div
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        className={cn(
          "adm-section-tabs__list",
          grouped && "adm-section-tabs__list--grouped",
          embedded ? "adm-section-tabs__list--embedded adm-product-section-tabs" : "adm-section-tabs__list--standalone",
        )}
        style={
          grouped
            ? undefined
            : { ["--adm-section-tabs-cols" as string]: String(colCount) }
        }
      >
        {resolvedGroups.map((group) => (
          <div
            key={group.id}
            role={group.label ? "group" : undefined}
            aria-label={group.label ?? undefined}
            className="adm-section-tabs__group"
            data-group={group.id === "__all" || group.id === "__ungrouped" ? undefined : group.id}
            style={{
              ["--adm-section-tabs-group-cols" as string]: String(
                Math.min(Math.max(group.items.length, 1), 6),
              ),
            }}
          >
            {group.label ? (
              <span className="adm-section-tabs__group-label" aria-hidden="true">
                {group.label}
              </span>
            ) : null}
            <div className="adm-section-tabs__group-tabs">
              {group.items.map((item) => {
                const index = flatIndexById.get(item.id) ?? 0;
                const Icon = item.icon;
                const selected = item.id === activeItem?.id;
                const tone = toneFor(item);
                return (
                  <button
                    key={item.id}
                    ref={(element) => {
                      buttonRefs.current[index] = element;
                    }}
                    id={`${idPrefix}-${item.id}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    data-tone={tone === "default" ? undefined : tone}
                    data-dirty={item.dirty ? "true" : undefined}
                    data-issue={tone === "issue" ? "true" : undefined}
                    data-conflict={tone === "conflict" ? "true" : undefined}
                    className="adm-section-tab"
                    onClick={() => onChange(item.id)}
                    onKeyDown={(event) => handleKeyDown(event, index)}
                  >
                    {Icon ? (
                      <span className="adm-section-tab__icon" aria-hidden="true">
                        <Icon size={18} strokeWidth={1.7} />
                      </span>
                    ) : null}
                    <span className="adm-section-tab__copy">
                      <span className="adm-section-tab__label">
                        {item.label}
                        {item.dirty ? (
                          <span
                            className="adm-section-tab__dot adm-section-tab__dot--dirty"
                            title="Unsaved edits"
                            aria-label={`${item.label} has unsaved edits`}
                          />
                        ) : null}
                        {tone === "issue" ? (
                          <span
                            className="adm-section-tab__dot adm-section-tab__dot--issue"
                            title="Open problem"
                            aria-label={`${item.label} has open problems`}
                          />
                        ) : null}
                        {tone === "conflict" ? (
                          <span
                            className="adm-section-tab__dot adm-section-tab__dot--conflict"
                            title="Sync conflict"
                            aria-label={`${item.label} has sync conflicts`}
                          />
                        ) : null}
                      </span>
                      {item.detail ? (
                        <span className="adm-section-tab__detail">{item.detail}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {children != null ? (
        <div className="adm-section-tabs__well">{children}</div>
      ) : null}
    </div>
  );
}
