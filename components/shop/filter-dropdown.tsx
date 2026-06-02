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

  // Portal needs client-side mount guard
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  const computePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPanelPos({
      top: rect.bottom + 6,
      left: rect.left,
      minWidth: Math.max(rect.width, 168),
    });
  }, []);

  // Recompute position when opening; close on scroll / resize
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

  // Click-outside and Escape — check both trigger AND portalled panel
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      )
        return;
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
      className="panel py-1 shadow-[0_20px_48px_rgba(0,0,0,0.18)]"
    >
      <button
        role="option"
        aria-selected={!isActive}
        type="button"
        onClick={() => { onChange(""); setOpen(false); }}
        className="flex w-full items-center justify-between gap-4 px-4 py-2.5 label-mono text-left transition-colors hover:bg-foreground/5"
      >
        <span className={cn(!isActive ? "text-foreground" : "text-muted")}>{allLabel}</span>
        {!isActive && <Check className="size-3 shrink-0 text-accent" />}
      </button>

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
            className="flex w-full items-center justify-between gap-4 px-4 py-2.5 label-mono text-left transition-colors hover:bg-foreground/5"
          >
            <span className={cn(value === option.value ? "text-foreground" : "text-muted")}>
              {option.label}
            </span>
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
          "label-caps flex items-center gap-1.5 py-2 transition-colors",
          "hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
          "disabled:cursor-not-allowed disabled:opacity-40",
          isActive ? "text-foreground" : "text-muted",
        )}
      >
        <span>{selectedLabel ?? label}</span>
        {isActive && (
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        )}
        <ChevronDown
          aria-hidden="true"
          className={cn("size-3 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && mounted && createPortal(panel, document.body)}
    </div>
  );
}
