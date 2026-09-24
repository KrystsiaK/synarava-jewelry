"use client";

import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/ui";

const DEFAULT_RADIUS = "0.75rem";

export type AdminPanelRootProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Corner radius. Default `0.75rem` (Tailwind `rounded-xl`). */
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
  return (
    <div
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
