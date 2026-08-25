"use client";

import { createPortal } from "react-dom";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode, Ref } from "react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/ui";

type PopoverSide = "top" | "bottom";
type PopoverPlacement = PopoverSide | "auto";
type PopoverAlign = "start" | "end";

type PopoverPosition = {
  left: number;
  maxHeight: number;
  side: PopoverSide;
  top: number;
  width?: number;
};

export type AdaptivePopoverTriggerProps = {
  "aria-controls": string | undefined;
  "aria-expanded": boolean;
  onClick: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  ref: Ref<HTMLButtonElement>;
};

export type AdaptivePopoverProps = {
  align?: PopoverAlign;
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
  gap?: number;
  matchTriggerWidth?: boolean;
  maxHeight?: number;
  minWidth?: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  placement?: PopoverPlacement;
  renderTrigger: (props: AdaptivePopoverTriggerProps) => ReactNode;
  role?: "listbox" | "menu";
  viewportPadding?: number;
};

export function AdaptivePopover({
  align = "start",
  ariaLabel,
  children,
  className,
  gap = 4,
  matchTriggerWidth = false,
  maxHeight = 288,
  minWidth = 192,
  onOpenChange,
  open,
  placement = "auto",
  renderTrigger,
  role,
  viewportPadding = 8,
}: AdaptivePopoverProps) {
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const focusIntentRef = useRef<"first" | "last" | null>(null);
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const triggerRect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const availableWidth = Math.max(0, viewportWidth - viewportPadding * 2);
    const panelWidth = Math.min(
      availableWidth,
      matchTriggerWidth
        ? triggerRect.width
        : Math.max(minWidth, panel.getBoundingClientRect().width),
    );
    const contentHeight = Math.min(maxHeight, panel.scrollHeight || maxHeight);
    const spaceBelow = Math.max(0, viewportHeight - viewportPadding - triggerRect.bottom - gap);
    const spaceAbove = Math.max(0, triggerRect.top - viewportPadding - gap);
    const side: PopoverSide = placement === "auto"
      ? spaceBelow >= contentHeight || spaceBelow >= spaceAbove ? "bottom" : "top"
      : placement;
    const availableHeight = side === "bottom" ? spaceBelow : spaceAbove;
    const renderedHeight = Math.min(contentHeight, availableHeight);
    const idealLeft = align === "start"
      ? triggerRect.left
      : triggerRect.right - panelWidth;
    const left = Math.min(
      Math.max(viewportPadding, idealLeft),
      Math.max(viewportPadding, viewportWidth - viewportPadding - panelWidth),
    );
    const top = side === "bottom"
      ? triggerRect.bottom + gap
      : triggerRect.top - gap - renderedHeight;

    setPosition({
      left,
      maxHeight: Math.max(0, availableHeight),
      side,
      top: Math.max(viewportPadding, top),
      width: matchTriggerWidth ? panelWidth : undefined,
    });
  }, [align, gap, matchTriggerWidth, maxHeight, minWidth, placement, viewportPadding]);

  const schedulePositionUpdate = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      updatePosition();
    });
  }, [updatePosition]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onOpenChange(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onOpenChange(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", schedulePositionUpdate);
    window.addEventListener("scroll", schedulePositionUpdate, { passive: true, capture: true });

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(schedulePositionUpdate);
    if (triggerRef.current) resizeObserver?.observe(triggerRef.current);
    if (panelRef.current) resizeObserver?.observe(panelRef.current);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", schedulePositionUpdate);
      window.removeEventListener("scroll", schedulePositionUpdate, { capture: true });
      resizeObserver?.disconnect();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [onOpenChange, open, schedulePositionUpdate]);

  useEffect(() => {
    if (!open || !position || !focusIntentRef.current) return;
    const items = getFocusableItems(panelRef.current);
    const target = focusIntentRef.current === "last" ? items.at(-1) : items[0];
    focusIntentRef.current = null;
    target?.focus();
  }, [open, position]);

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    focusIntentRef.current = event.key === "ArrowUp" ? "last" : "first";
    onOpenChange(true);
  };

  const handlePanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = getFocusableItems(panelRef.current);
    if (items.length === 0) return;
    event.preventDefault();
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown"
          ? (currentIndex + 1 + items.length) % items.length
          : (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  const panelStyle: CSSProperties = {
    left: position?.left ?? 0,
    maxHeight: position?.maxHeight ?? maxHeight,
    minWidth: Math.min(minWidth, Math.max(0, typeof window === "undefined" ? minWidth : window.innerWidth - viewportPadding * 2)),
    position: "fixed",
    top: position?.top ?? 0,
    visibility: position ? "visible" : "hidden",
    width: position?.width,
    zIndex: 70,
  };

  return (
    <>
      {renderTrigger({
        "aria-controls": open ? panelId : undefined,
        "aria-expanded": open,
        onClick: () => onOpenChange(!open),
        onKeyDown: handleTriggerKeyDown,
        ref: triggerRef,
      })}
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role={role}
              aria-label={ariaLabel}
              data-side={position?.side}
              onKeyDown={handlePanelKeyDown}
              style={panelStyle}
              className={cn("overflow-y-auto overscroll-contain", className)}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function getFocusableItems(panel: HTMLDivElement | null) {
  if (!panel) return [];
  return Array.from(
    panel.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ),
  );
}
