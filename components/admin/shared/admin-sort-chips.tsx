"use client";

import type { ReactNode } from "react";

import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/ui";

export type AdminSortChipOption<T extends string = string> = {
  value: T;
  label: string;
  /** Compact label shown on the chip; defaults to `label`. */
  shortLabel?: string;
  tooltip?: ReactNode;
  /** Visual accent for attention sorts (problems, conflicts). */
  tone?: "default" | "danger" | "conflict";
  /** Hide until a precondition is met (e.g. collection selected). */
  hidden?: boolean;
};

export type AdminSortChipsProps<T extends string = string> = {
  label?: string;
  value: T;
  options: readonly AdminSortChipOption<T>[];
  onChange: (value: T) => void;
  className?: string;
};

/**
 * Compact sort control: one active chip at a time, tooltips for clarity.
 * Prefer over a long `<select>` when the option set is small and scannable.
 */
export function AdminSortChips<T extends string>({
  label = "Sort",
  value,
  options,
  onChange,
  className,
}: AdminSortChipsProps<T>) {
  const visible = options.filter((option) => !option.hidden);

  return (
    <div
      data-component="AdminSortChips"
      className={cn("flex min-w-0 flex-wrap items-center gap-1.5", className)}
      role="group"
      aria-label={label}
    >
      <span
        className="shrink-0 text-[0.62rem] font-bold uppercase tracking-[0.1em]"
        style={{ color: "var(--adm-subtle)" }}
      >
        {label}
      </span>
      {visible.map((option) => {
        const active = option.value === value;
        const chipLabel = option.shortLabel ?? option.label;
        const tone = option.tone ?? "default";
        const chip = (
          <button
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex min-h-8 items-center rounded-md border px-2 py-1 text-[0.68rem] font-semibold transition-colors",
              active ? "border-transparent text-[var(--adm-panel)]" : "bg-transparent",
            )}
            style={
              active
                ? {
                    background:
                      tone === "danger"
                        ? "var(--adm-danger)"
                        : tone === "conflict"
                          ? "var(--adm-conflict)"
                          : "var(--adm-accent)",
                  }
                : {
                    borderColor:
                      tone === "danger"
                        ? "color-mix(in srgb, var(--adm-danger) 45%, var(--adm-border))"
                        : tone === "conflict"
                          ? "color-mix(in srgb, var(--adm-conflict) 45%, var(--adm-border))"
                          : "var(--adm-border)",
                    color:
                      tone === "danger"
                        ? "var(--adm-danger)"
                        : tone === "conflict"
                          ? "var(--adm-conflict)"
                          : "var(--adm-ink)",
                  }
            }
          >
            {chipLabel}
          </button>
        );

        return (
          <Tooltip key={option.value} content={option.tooltip ?? option.label} delay={160} maxWidth={260}>
            {chip}
          </Tooltip>
        );
      })}
    </div>
  );
}
