"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/ui";
import type { FilterOption } from "./types";

export type FilterDropdownProps = {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  allLabel?: string;
  disabled?: boolean;
};

type PanelPos = { top: number; left: number; minWidth: number };

export function FilterDropdown({
  label,
  options,
  value,
  onChange,
  allLabel = `All ${label.toLowerCase()}`,
  disabled = false,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<PanelPos>({ top: 0, left: 0, minWidth: 160 });
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isActive = Boolean(value);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  const computePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPanelPos({
      top: rect.bottom + 4,
      left: rect.left,
      minWidth: Math.max(rect.width, 192),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    computePosition();
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { passive: true, capture: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  const handleTriggerClick = () => {
    if (disabled) return;
    setOpen((current) => {
      if (!current) {
        computePosition();
      }
      return !current;
    });
  };

  const selectedLabel = options.find((o) => o.value === value)?.label;

  const panel = (
    <div
      ref={panelRef}
      role="listbox"
      aria-label={label}
      style={{
        position: "fixed",
        top: panelPos.top,
        left: panelPos.left,
        minWidth: panelPos.minWidth,
        zIndex: 70,
      }}
      className="border border-foreground/[0.08] bg-background/96 py-1.5 shadow-[0_10px_24px_rgba(25,21,18,0.12)] backdrop-blur-md"
    >
      {/* All option */}
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
        <p className="px-4 py-3 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-muted/60">No options</p>
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
    </div>
  );

  return (
    <div data-testid={`filter-dropdown-${label.toLowerCase()}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        className={cn(
          /* base */
          "inline-flex min-h-10 cursor-pointer items-center gap-2 border px-3.5 py-2 transition-all duration-200",
          "text-[0.7rem] font-semibold uppercase tracking-[0.16em] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
          "disabled:cursor-not-allowed disabled:opacity-40",
          "active:scale-[0.97]",
          /* states */
          isActive
            ? "border-accent bg-couture-red/[0.055] text-couture-red"
            : "border-foreground/[0.1] bg-surface/45 text-muted hover:border-foreground/24 hover:bg-surface hover:text-foreground",
          open && !isActive && "border-foreground/25 text-foreground",
        )}
      >
        <span>{selectedLabel ?? label}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-3 transition-transform duration-200 shrink-0", open && "rotate-180")}
        />
      </button>

      {open && mounted && createPortal(panel, document.body)}
    </div>
  );
}
