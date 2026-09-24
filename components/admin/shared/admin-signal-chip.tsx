"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/ui";

/**
 * Signal palette. `danger` is reserved for real errors/problems —
 * incomplete work uses empty / partial / progress / ok instead.
 */
export type AdminSignalTone =
  | "ok"
  | "progress"
  | "partial"
  | "empty"
  | "warn"
  | "pending"
  | "conflict"
  | "danger"
  | "muted";

const TONE_STYLE: Record<AdminSignalTone, { color: string; border: string; bg: string }> = {
  ok: {
    color: "var(--adm-success)",
    border: "color-mix(in srgb, var(--adm-success) 42%, var(--adm-border))",
    bg: "color-mix(in srgb, var(--adm-success) 12%, transparent)",
  },
  progress: {
    color: "var(--adm-teal)",
    border: "color-mix(in srgb, var(--adm-teal) 42%, var(--adm-border))",
    bg: "var(--adm-teal-soft)",
  },
  partial: {
    color: "var(--adm-violet)",
    border: "color-mix(in srgb, var(--adm-violet) 42%, var(--adm-border))",
    bg: "var(--adm-violet-soft)",
  },
  empty: {
    color: "var(--adm-cool)",
    border: "color-mix(in srgb, var(--adm-cool) 38%, var(--adm-border))",
    bg: "var(--adm-cool-soft)",
  },
  warn: {
    color: "var(--adm-warning)",
    border: "color-mix(in srgb, var(--adm-warning) 40%, var(--adm-border))",
    bg: "color-mix(in srgb, var(--adm-warning) 10%, transparent)",
  },
  pending: {
    color: "var(--adm-accent)",
    border: "color-mix(in srgb, var(--adm-accent) 40%, var(--adm-border))",
    bg: "var(--adm-accent-soft)",
  },
  conflict: {
    color: "var(--adm-conflict)",
    border: "color-mix(in srgb, var(--adm-conflict) 45%, var(--adm-border))",
    bg: "var(--adm-conflict-soft)",
  },
  danger: {
    color: "var(--adm-danger)",
    border: "color-mix(in srgb, var(--adm-danger) 40%, var(--adm-border))",
    bg: "var(--adm-danger-soft)",
  },
  muted: {
    color: "var(--adm-muted)",
    border: "var(--adm-border)",
    bg: "transparent",
  },
};

export type AdminSignalChipProps = {
  label: string;
  tooltip: ReactNode;
  tone?: AdminSignalTone;
  icon: ReactNode;
  /** Small numeric/text badge beside the icon (e.g. readiness %). */
  value?: string | number | null;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  href?: string;
  className?: string;
};

/**
 * Dense status glyph for entity list rows (locale readiness, problems, conflicts).
 * Always exposes a real tooltip — never rely on cryptic badge text alone.
 */
export function AdminSignalChip({
  label,
  tooltip,
  tone = "muted",
  icon,
  value = null,
  onClick,
  href,
  className,
}: AdminSignalChipProps) {
  const styles = TONE_STYLE[tone];
  const sharedClass = cn(
    "inline-flex h-7 max-w-full items-center gap-1 rounded-md border px-1.5 text-[0.62rem] font-bold uppercase tracking-[0.04em]",
    onClick || href ? "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--adm-accent)]" : "cursor-default",
    className,
  );
  const sharedStyle = { color: styles.color, borderColor: styles.border, background: styles.bg };

  const inner = (
    <>
      <span className="grid size-3.5 shrink-0 place-items-center [&>svg]:size-3.5" aria-hidden="true">
        {icon}
      </span>
      {value != null && value !== "" ? <span className="truncate">{value}</span> : null}
    </>
  );

  const control = href ? (
    <a href={href} aria-label={label} className={sharedClass} style={sharedStyle}>
      {inner}
    </a>
  ) : onClick ? (
    <button type="button" aria-label={label} onClick={onClick} className={sharedClass} style={sharedStyle}>
      {inner}
    </button>
  ) : (
    <span role="status" aria-label={label} tabIndex={0} className={sharedClass} style={sharedStyle}>
      {inner}
    </span>
  );

  return (
    <span data-component="AdminSignalChip" data-tone={tone}>
      <Tooltip content={tooltip} delay={160} maxWidth={300}>
        {control}
      </Tooltip>
    </span>
  );
}
