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

export type AdminSectionTabItem = {
  id: string;
  label: string;
  /** Secondary line under the label (e.g. “Copy & search”). */
  detail?: string;
  icon?: LucideIcon;
  tone?: AdminSectionTabTone;
  /** Unsaved local edits — amber dot, independent of tone. */
  dirty?: boolean;
};

export type AdminSectionTabsProps = {
  items: AdminSectionTabItem[];
  active: string;
  onChange: (id: string) => void;
  /** Accessible name for the tablist. */
  "aria-label"?: string;
  /**
   * Grid columns at xl. Defaults to `items.length` (capped at 6).
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

/**
 * Shared admin section tabs — card strip + cool content well.
 * States: idle / hover / selected (+ hover) × default | issue | conflict.
 * Prefer this over ad-hoc product tab markup.
 */
export function AdminSectionTabs({
  items,
  active,
  onChange,
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

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % items.length;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + items.length) % items.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (nextIndex == null) return;

    event.preventDefault();
    onChange(items[nextIndex].id);
    buttonRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      data-component="AdminSectionTabs"
      data-embedded={embedded ? "true" : undefined}
      className={cn("adm-section-tabs", className)}
    >
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          "adm-section-tabs__list",
          embedded ? "adm-section-tabs__list--embedded adm-product-section-tabs" : "adm-section-tabs__list--standalone",
        )}
        style={{ ["--adm-section-tabs-cols" as string]: String(colCount) }}
      >
        {items.map((item, index) => {
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

      {children != null ? (
        <div className="adm-section-tabs__well">{children}</div>
      ) : null}
    </div>
  );
}
