"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";

import { cn } from "@/lib/ui";

/** Apple sheet radius band (~12–14px). */
const DEFAULT_RADIUS = "0.875rem";

export type AdminPanelRootProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Corner radius. Default `0.875rem` (~14px, Apple sheet band). */
  radius?: string;
  /**
   * Height of sticky chrome ABOVE this panel (CSS length or `var(...)`).
   * Sticky headers inside use `top: calc(stickyAbove - radius)` so the header
   * occupies the panel’s rounded top instead of sitting below the crescents.
   */
  stickyAbove?: string;
  id?: string;
  /** Optional marker for product locale shell / tests. */
  "data-component"?: string;
  "data-locale"?: string;
};

/**
 * Rounded admin shell. Compound: `AdminPanel.Root` / `.Header` / `.Body`.
 * Keep overflow visible — clipping the root would trap sticky to the panel.
 *
 * Sticky headers use the synarava-cms band rhythm (`.adm-band`) and, when
 * sticky, `.adm-band--sticky-radius` so optical pad-y survives `top − radius`.
 */
/**
 * Embedded section tabs stick with the product offset
 * (workspace header + locale band). A panel that has no workspace header
 * above it must publish `0px` for that header, or the tabs freeze too low
 * and the first field shows in the gap.
 */
function usePanelStickyBands(rootRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    function sync() {
      const node = rootRef.current;
      if (!node) return;
      const workspace = node.parentElement?.querySelector(
        ":scope > .adm-editor-workspace-header, :scope > .adm-product-workspace-header",
      );
      if (!workspace) {
        node.style.setProperty("--adm-product-workspace-sticky-height", "0px");
      }
      const locale = node.querySelector<HTMLElement>('[data-sticky-band="locale"]');
      const localeHeight = locale ? Math.ceil(locale.getBoundingClientRect().height) : 0;
      if (localeHeight > 0) {
        node.style.setProperty("--adm-locale-workspace-sticky-height", `${localeHeight}px`);
      }
      const tabs = node.querySelector<HTMLElement>(".adm-product-section-tabs");
      const tabsHeight = tabs ? Math.ceil(tabs.getBoundingClientRect().height) : 0;
      if (tabsHeight > 0) {
        node.style.setProperty("--adm-product-section-tabs-sticky-height", `${tabsHeight}px`);
      }
    }

    sync();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(sync);
    observer.observe(root);
    const locale = root.querySelector('[data-sticky-band="locale"]');
    if (locale) observer.observe(locale);
    const tabs = root.querySelector(".adm-product-section-tabs");
    if (tabs) observer.observe(tabs);
    return () => observer.disconnect();
  }, [rootRef]);
}

export function AdminPanelRoot({
  children,
  className,
  style,
  radius = DEFAULT_RADIUS,
  stickyAbove = "0px",
  id,
  "data-component": dataComponent = "AdminPanel",
  "data-locale": dataLocale,
}: AdminPanelRootProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  usePanelStickyBands(rootRef);

  return (
    <div
      ref={rootRef}
      id={id}
      data-component={dataComponent}
      data-locale={dataLocale}
      className={cn("adm-panel", className)}
      style={{
        ...style,
        ["--adm-panel-radius" as string]: radius,
        ["--adm-panel-sticky-above" as string]: stickyAbove,
      }}
    >
      {children}
    </div>
  );
}

export type AdminPanelHeaderProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Stick under `stickyAbove`, lifted by panel radius. */
  sticky?: boolean;
  /** Optional band id for ResizeObserver sticky stacks (e.g. `locale`). */
  stickyBand?: string;
};

export function AdminPanelHeader({
  children,
  className,
  style,
  sticky = false,
  stickyBand,
}: AdminPanelHeaderProps) {
  return (
    <div
      data-component="AdminPanel.Header"
      data-sticky={sticky ? "true" : "false"}
      data-sticky-band={stickyBand}
      className={cn(
        "adm-panel__header",
        "adm-band",
        sticky ? "adm-panel__header--sticky adm-band--sticky-radius" : null,
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}

export type AdminPanelBodyProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function AdminPanelBody({ children, className, style }: AdminPanelBodyProps) {
  return (
    <div data-component="AdminPanel.Body" className={cn("adm-panel__body", className)} style={style}>
      {children}
    </div>
  );
}

export const AdminPanel = {
  Root: AdminPanelRoot,
  Header: AdminPanelHeader,
  Body: AdminPanelBody,
};
