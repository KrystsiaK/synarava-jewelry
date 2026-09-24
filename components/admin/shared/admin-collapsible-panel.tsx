"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/ui";

export type AdminCollapsiblePanelProps = {
  title: ReactNode;
  children: ReactNode;
  /** Start expanded. Default collapsed. */
  defaultOpen?: boolean;
  className?: string;
  /** Extra class on the body region. */
  bodyClassName?: string;
  id?: string;
};

/**
 * Shared admin collapsible panel.
 * Button header (avoids native details marker) + rotating chevron + animated body.
 */
export function AdminCollapsiblePanel({
  title,
  children,
  defaultOpen = false,
  className,
  bodyClassName,
  id,
}: AdminCollapsiblePanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const reactId = useId();
  const headerId = `${reactId}-header`;
  const panelId = `${reactId}-panel`;

  return (
    <div
      id={id}
      data-component="AdminCollapsiblePanel"
      data-open={open ? "true" : "false"}
      className={cn("adm-collapse", className)}
    >
      <button
        type="button"
        id={headerId}
        className="adm-collapse__summary"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="adm-collapse__title">{title}</span>
        <ChevronDown className="adm-collapse__chevron" aria-hidden="true" strokeWidth={2} />
      </button>

      {/* Single separator — not border-bottom + color edge (that reads as two lines). */}
      <div className="adm-collapse__rule" aria-hidden="true" />

      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        className="adm-collapse__panel"
        inert={open ? undefined : true}
      >
        <div className="adm-collapse__clip">
          <div className={cn("adm-collapse__body", bodyClassName)}>{children}</div>
        </div>
      </div>
    </div>
  );
}
