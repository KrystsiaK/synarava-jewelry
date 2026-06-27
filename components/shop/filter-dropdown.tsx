"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    if (!open) return;
    computePosition();
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
        zIndex: 9999,
      }}
      className="border border-stroke bg-panel/95 backdrop-blur-sm shadow-[0_16px_40px_rgba(0,0,0,0.14)] py-1.5"
    >
      {/* All option */}
      <button
        role="option"
        aria-selected={!isActive}
        type="button"
        onClick={() => { onChange(""); setOpen(false); }}
        className={cn(
          "flex w-full items-center justify-between gap-4 px-4 py-3 label-mono text-left transition-colors cursor-pointer",
          "min-h-[44px] hover:bg-accent/[0.06]",
          !isActive ? "text-foreground" : "text-muted hover:text-foreground",
        )}
      >
        <span>{allLabel}</span>
        {!isActive && <Check className="size-3 shrink-0 text-accent" />}
      </button>

      {/* Divider */}
      <div className="mx-4 my-1 h-px bg-stroke" />

      {options.length === 0 ? (
        <p className="px-4 py-3 label-mono text-muted/60">No options</p>
      ) : (
        options.map((option) => (
          <button
            key={option.value}
            role="option"
            aria-selected={value === option.value}
            type="button"
            onClick={() => { onChange(option.value); setOpen(false); }}
            className={cn(
              "flex w-full items-center justify-between gap-4 px-4 py-3 label-mono text-left transition-colors cursor-pointer",
              "min-h-[44px] hover:bg-accent/[0.06]",
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
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        className={cn(
          /* base */
          "inline-flex items-center gap-2 px-4 py-2 border transition-all duration-200 cursor-pointer",
          "label-caps focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
          "disabled:cursor-not-allowed disabled:opacity-40",
          "active:scale-[0.97]",
          /* states */
          isActive
            ? "border-accent bg-accent/[0.06] text-accent"
            : "border-stroke text-muted hover:border-foreground/25 hover:text-foreground",
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