"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";

import { AdaptivePopover } from "@/components/ui/adaptive-popover";
import { useTranslations } from "@/lib/i18n/context";
import { cn } from "@/lib/ui";
import type { FilterOption } from "./types";

export type FilterDropdownProps = {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  allLabel?: string;
  inactiveLabel?: string;
  disabled?: boolean;
  triggerVariant?: "default" | "toolbar";
  triggerIcon?: ReactNode;
};

export function FilterDropdown({
  label,
  options,
  value,
  onChange,
  allLabel = `All ${label.toLowerCase()}`,
  inactiveLabel,
  disabled = false,
  triggerVariant = "default",
  triggerIcon,
}: FilterDropdownProps) {
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const isActive = Boolean(value);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <div data-component="FilterDropdown" data-testid={`filter-dropdown-${label.toLowerCase()}`}>
      <AdaptivePopover
        open={open}
        onOpenChange={(nextOpen) => {
          if (!disabled) setOpen(nextOpen);
        }}
        minWidth={192}
        role="listbox"
        ariaLabel={label}
        className="border border-foreground/[0.08] bg-background/96 py-1.5 shadow-[0_8px_20px_rgba(25,21,18,0.12)] backdrop-blur-md"
        renderTrigger={(triggerProps) => (
          <button
            {...triggerProps}
            type="button"
            aria-haspopup="listbox"
            disabled={disabled}
            className={cn(
              "inline-flex cursor-pointer items-center transition-[background-color,border-color,color,transform] duration-200",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent",
              "disabled:cursor-not-allowed disabled:opacity-40",
              "active:scale-[0.97]",
              triggerVariant === "toolbar"
                ? "min-h-14 w-full justify-start gap-3 px-3 text-left hover:bg-surface/70"
                : "min-h-11 gap-2 border px-3.5 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em]",
              triggerVariant === "toolbar"
                ? isActive
                  ? "bg-couture-red/[0.045] text-couture-red"
                  : "text-foreground"
                : isActive
                  ? "border-accent bg-couture-red/[0.055] text-couture-red"
                  : "border-foreground/[0.1] bg-surface/45 text-muted hover:border-foreground/24 hover:bg-surface hover:text-foreground",
              open && !isActive && triggerVariant === "default" && "border-foreground/25 text-foreground",
            )}
          >
            {triggerVariant === "toolbar" ? (
              <>
                <span className="inline-flex size-5 shrink-0 items-center justify-center text-muted" aria-hidden="true">
                  {triggerIcon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-muted/65">
                    {label}
                  </span>
                  <span className="mt-0.5 block truncate text-[0.7rem] font-semibold uppercase tracking-[0.12em]">
                    {selectedLabel ?? inactiveLabel ?? label}
                  </span>
                </span>
              </>
            ) : (
              <span>{selectedLabel ?? inactiveLabel ?? label}</span>
            )}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-3 shrink-0 transition-transform duration-200",
                triggerVariant === "toolbar" && "text-muted/65",
                open && "rotate-180",
              )}
            />
          </button>
        )}
      >
      <button
        role="option"
        aria-selected={!isActive}
        type="button"
        onClick={() => { onChange(""); setOpen(false); }}
        className={cn(
          "flex min-h-[44px] w-full cursor-pointer items-center justify-between gap-4 px-4 py-3 text-left",
          "text-[0.74rem] font-semibold uppercase tracking-[0.14em] transition-colors hover:bg-couture-red/[0.05]",
          !isActive ? "text-foreground" : "text-muted hover:text-foreground",
        )}
      >
        <span>{allLabel}</span>
        {!isActive && <Check className="size-3 shrink-0 text-accent" />}
      </button>

      {/* Divider */}
      <div className="mx-4 my-1 h-px bg-foreground/[0.08]" />

      {options.length === 0 ? (
        <p className="px-4 py-3 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-muted/60">{t("shop.filters.noOptions")}</p>
      ) : (
        options.map((option) => (
          <button
            key={option.value}
            role="option"
            aria-selected={value === option.value}
            type="button"
            onClick={() => { onChange(option.value); setOpen(false); }}
            className={cn(
              "flex min-h-[44px] w-full cursor-pointer items-center justify-between gap-4 px-4 py-3 text-left",
              "text-[0.74rem] font-semibold uppercase tracking-[0.14em] transition-colors hover:bg-couture-red/[0.05]",
              value === option.value ? "text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            <span>{option.label}</span>
            {value === option.value && <Check className="size-3 shrink-0 text-accent" />}
          </button>
        ))
      )}
      </AdaptivePopover>
    </div>
  );
}
