"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/ui";

export type AdminIconButtonTone = "default" | "primary" | "danger" | "warning" | "conflict";

const TONE_CLASS: Record<AdminIconButtonTone, string> = {
  default: "",
  primary: "text-[var(--adm-panel)]",
  danger: "text-[var(--adm-danger)]",
  warning: "text-[var(--adm-warning)]",
  conflict: "text-[var(--adm-conflict)]",
};

const TONE_SURFACE: Record<AdminIconButtonTone, string> = {
  default: "adm-btn-ghost",
  primary: "adm-btn-primary",
  danger: "adm-btn-ghost",
  warning: "adm-btn-ghost",
  conflict: "adm-btn-ghost",
};

export type AdminIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  tooltip?: ReactNode;
  tone?: AdminIconButtonTone;
  badge?: number | string | null;
  children: ReactNode;
};

/**
 * Compact square action control — icon + tooltip + accessible name.
 * Shared by product/page/collection entity lists.
 */
export function AdminIconButton({
  label,
  tooltip,
  tone = "default",
  badge = null,
  className,
  type = "button",
  children,
  ...props
}: AdminIconButtonProps) {
  const button = (
    <button
      type={type}
      aria-label={label}
      className={cn(
        TONE_SURFACE[tone],
        "adm-icon-btn relative",
        TONE_CLASS[tone],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );

  const withBadge = badge != null && badge !== "" ? (
    <span className="relative inline-flex shrink-0">
      {button}
      <span
        className="pointer-events-none absolute -right-1 -top-1 grid min-w-[1rem] place-items-center rounded-full px-1 text-[0.58rem] font-bold leading-4 text-[var(--adm-panel)]"
        style={{
          background:
            tone === "danger"
              ? "var(--adm-danger)"
              : tone === "conflict"
                ? "var(--adm-conflict)"
                : tone === "warning"
                  ? "var(--adm-warning)"
                  : "var(--adm-accent)",
        }}
        aria-hidden="true"
      >
        {typeof badge === "number" && badge > 99 ? "99+" : badge}
      </span>
    </span>
  ) : (
    button
  );

  return (
    <span data-component="AdminIconButton" className="inline-flex shrink-0">
      <Tooltip content={tooltip ?? label} delay={180} maxWidth={280}>
        {withBadge}
      </Tooltip>
    </span>
  );
}
