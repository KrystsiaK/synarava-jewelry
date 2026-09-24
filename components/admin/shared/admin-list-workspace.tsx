"use client";

import type { ReactNode } from "react";

import { AdminCollapsiblePanel } from "@/components/admin/shared/admin-collapsible-panel";
import { AdminPanel } from "@/components/admin/shared/admin-panel";
import { cn } from "@/lib/ui";

export type AdminListWorkspaceRootProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  /** Height of sticky chrome ABOVE this workspace. Default `0px`. */
  stickyAbove?: string;
};

/**
 * Catalog / pages / collections list shell.
 * Sticky title band (full-width ruled edge) via AdminPanel; optional collapsible
 * filter chain; body holds the entity table.
 *
 * Compound: `AdminListWorkspace.Root` / `.Header` / `.Filters` / `.Body`.
 */
export function AdminListWorkspaceRoot({
  children,
  className,
  id,
  stickyAbove = "0px",
}: AdminListWorkspaceRootProps) {
  return (
    <AdminPanel.Root
      id={id}
      data-component="AdminListWorkspace"
      stickyAbove={stickyAbove}
      className={className}
    >
      {children}
    </AdminPanel.Root>
  );
}

export type AdminListWorkspaceHeaderProps = {
  /** Small bracket tag, e.g. `[ CURRENT CATALOG ]`. */
  tag: ReactNode;
  title: ReactNode;
  /** Secondary line under the title (counts, hints). */
  meta?: ReactNode;
  /** Primary actions (New product, etc.). */
  actions?: ReactNode;
  /**
   * Extra sticky chrome under the title row — typically
   * `AdminListWorkspace.Filters` (search + selects + sort inside the collapse).
   */
  children?: ReactNode;
  className?: string;
};

export function AdminListWorkspaceHeader({
  tag,
  title,
  meta,
  actions,
  children,
  className,
}: AdminListWorkspaceHeaderProps) {
  return (
    <AdminPanel.Header
      sticky
      stickyBand="list-workspace"
      className={cn("adm-panel__header--ruled", className)}
    >
      <div className="adm-list-workspace__chrome">
        <div className="adm-list-workspace__title-row">
          <div className="min-w-0">
            <p className="adm-section-tag">{tag}</p>
            <h2 className="adm-title-sm mt-2">{title}</h2>
            {meta ? (
              <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>
                {meta}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
        {children}
      </div>
    </AdminPanel.Header>
  );
}

export type AdminListWorkspaceFiltersProps = {
  /** Label when the chain is open (and when collapsed with no summary). */
  title?: ReactNode;
  /**
   * Shown beside the title when collapsed (and always in the trigger when set),
   * e.g. active filter chips: `Search · Draft · Rings`.
   */
  summary?: ReactNode;
  children: ReactNode;
  /** Start expanded. Default open so first paint matches the old always-visible bar. */
  defaultOpen?: boolean;
  className?: string;
  bodyClassName?: string;
  id?: string;
};

export function AdminListWorkspaceFilters({
  title = "Filters & sort",
  summary,
  children,
  defaultOpen = true,
  className,
  bodyClassName,
  id,
}: AdminListWorkspaceFiltersProps) {
  const trigger = summary ? (
    <span className="adm-list-workspace__filter-title">
      <span>{title}</span>
      <span className="adm-list-workspace__filter-summary">{summary}</span>
    </span>
  ) : (
    title
  );

  return (
    <AdminCollapsiblePanel
      id={id}
      title={trigger}
      defaultOpen={defaultOpen}
      className={cn("adm-list-workspace__filters", className)}
      bodyClassName={cn("adm-list-workspace__filters-body", bodyClassName)}
    >
      {children}
    </AdminCollapsiblePanel>
  );
}

export type AdminListWorkspaceBodyProps = {
  children: ReactNode;
  className?: string;
};

export function AdminListWorkspaceBody({ children, className }: AdminListWorkspaceBodyProps) {
  return (
    <AdminPanel.Body className={cn("adm-list-workspace__body", className)}>
      {children}
    </AdminPanel.Body>
  );
}

export const AdminListWorkspace = {
  Root: AdminListWorkspaceRoot,
  Header: AdminListWorkspaceHeader,
  Filters: AdminListWorkspaceFilters,
  Body: AdminListWorkspaceBody,
};
