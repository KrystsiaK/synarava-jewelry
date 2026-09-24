"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { AdminFieldWarning } from "@/components/admin/shared/admin-form-validation";
import { cn } from "@/lib/ui";

export type AdminCollapsiblePanelTone = "default" | "warning";

export type AdminCollapsiblePanelProps = {
  title: ReactNode;
  children: ReactNode;
  /** Start expanded when uncontrolled. Default collapsed. */
  defaultOpen?: boolean;
  /** Controlled open state — survives parent remounts when lifted. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Extra controls in the header before the chevron (clicks do not toggle). */
  trailing?: ReactNode;
  /** Soft orange chrome for incomplete / non-blocking issues. */
  tone?: AdminCollapsiblePanelTone;
  /**
   * Soft notice under the panel — same `AdminFieldWarning` band as text/select fields.
   * Stays visible when collapsed.
   */
  caption?: string;
  className?: string;
  /** Extra class on the body region. */
  bodyClassName?: string;
  id?: string;
};

/**
 * Shared admin collapsible panel.
 * Button header (avoids native details marker) + rotating chevron + animated body.
 * Closed panels stay in FormData (no `inert`) so collapsed fields still save.
 * Treats the panel as a large control: optional warning uses the shared field message band.
 */
export function AdminCollapsiblePanel({
  title,
  children,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  trailing,
  tone = "default",
  caption,
  className,
  bodyClassName,
  id,
}: AdminCollapsiblePanelProps) {
  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = isControlled ? openProp : uncontrolledOpen;
  const reactId = useId();
  const headerId = `${reactId}-header`;
  const panelId = `${reactId}-panel`;
  const captionId = `${reactId}-caption`;

  function toggle() {
    const next = !open;
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  return (
    <div
      id={id}
      data-component="AdminCollapsiblePanel"
      data-open={open ? "true" : "false"}
      data-tone={tone}
      className={cn("adm-field-unit adm-collapse-root", className)}
    >
      <div
        className={cn("adm-collapse", tone === "warning" && "adm-collapse--warning")}
        data-open={open ? "true" : "false"}
      >
        <div className="adm-collapse__header">
          <button
            type="button"
            id={headerId}
            className="adm-collapse__summary"
            aria-expanded={open}
            aria-controls={panelId}
            aria-describedby={caption ? captionId : undefined}
            onClick={toggle}
          >
            <span className="adm-collapse__title">{title}</span>
            {trailing ? null : (
              <ChevronDown className="adm-collapse__chevron" aria-hidden="true" strokeWidth={2} />
            )}
          </button>
          {trailing ? (
            <>
              <div className="adm-collapse__trailing">{trailing}</div>
              <button
                type="button"
                className="adm-collapse__toggle"
                aria-expanded={open}
                aria-controls={panelId}
                aria-label={open ? "Collapse section" : "Expand section"}
                onClick={toggle}
              >
                <ChevronDown className="adm-collapse__chevron" aria-hidden="true" strokeWidth={2} />
              </button>
            </>
          ) : null}
        </div>

        {/* Single separator — not border-bottom + color edge (that reads as two lines). */}
        <div className="adm-collapse__rule" aria-hidden="true" />

        <div
          id={panelId}
          role="region"
          aria-labelledby={headerId}
          className="adm-collapse__panel"
          aria-hidden={open ? undefined : true}
        >
          <div className="adm-collapse__clip">
            <div className={cn("adm-collapse__body", bodyClassName)}>{children}</div>
          </div>
        </div>
      </div>

      <AdminFieldWarning id={captionId} message={caption} />
    </div>
  );
}
