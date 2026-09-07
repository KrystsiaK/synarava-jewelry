"use client";

import {
  Children,
  cloneElement,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  computeTooltipPosition,
  type TooltipAlign,
  type TooltipPlacement,
  type TooltipPosition,
} from "@/lib/ui/tooltip-position";
import { cn } from "@/lib/ui";

type TooltipTriggerProps = {
  "aria-describedby"?: string;
  onBlur?: (event: ReactFocusEvent<HTMLElement>) => void;
  onFocus?: (event: ReactFocusEvent<HTMLElement>) => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLElement>) => void;
  onPointerEnter?: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave?: (event: ReactPointerEvent<HTMLElement>) => void;
  ref?: Ref<HTMLElement>;
};

export type TooltipProps = {
  align?: TooltipAlign;
  children: ReactElement<TooltipTriggerProps>;
  className?: string;
  content: ReactNode;
  delay?: number;
  maxWidth?: number;
  side?: TooltipPlacement;
};

const OPEN_EVENT = "synarava:tooltip-open";

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

export function Tooltip({
  align = "center",
  children,
  className,
  content,
  delay = 220,
  maxWidth = 320,
  side = "auto",
}: TooltipProps) {
  const tooltipId = useId();
  const instanceId = useId();
  const triggerRef = useRef<HTMLElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const trigger = Children.only(children);

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    openTimerRef.current = null;
    closeTimerRef.current = null;
  }, []);

  const show = useCallback((immediate = false) => {
    if (content == null || content === false) return;
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    openTimerRef.current = null;
    closeTimerRef.current = null;
    const commit = () => {
      window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: instanceId }));
      setPosition(null);
      setOpen(true);
    };
    if (immediate || delay === 0) commit();
    else openTimerRef.current = setTimeout(commit, delay);
  }, [content, delay, instanceId]);

  const hide = useCallback((immediate = false) => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    openTimerRef.current = null;
    if (immediate) {
      closeTimerRef.current = null;
      setPosition(null);
      setOpen(false);
    } else {
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        setPosition(null);
        setOpen(false);
      }, 80);
    }
  }, []);

  const updatePosition = useCallback(() => {
    const reference = triggerRef.current;
    const floating = floatingRef.current;
    if (!reference || !floating) return;
    setPosition(computeTooltipPosition({
      reference: reference.getBoundingClientRect(),
      floating: floating.getBoundingClientRect(),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      preferredSide: side,
      align,
    }));
  }, [align, side]);

  const schedulePositionUpdate = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      updatePosition();
    });
  }, [updatePosition]);

  useLayoutEffect(() => {
    if (!open) return;
    const floating = floatingRef.current;
    if (!floating) return;

    let promotedToTopLayer = false;
    if (typeof floating.showPopover === "function") {
      try {
        floating.showPopover();
        promotedToTopLayer = true;
      } catch {
        // The fixed-position portal remains the fallback in older/partial implementations.
      }
    }
    updatePosition();

    return () => {
      if (!promotedToTopLayer || typeof floating.hidePopover !== "function") return;
      try {
        floating.hidePopover();
      } catch {
        // It is safe to ignore cleanup if the browser already removed it from the top layer.
      }
    };
  }, [open, updatePosition]);

  useEffect(() => {
    const closeOtherTooltip = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== instanceId) {
        setPosition(null);
        setOpen(false);
      }
    };
    window.addEventListener(OPEN_EVENT, closeOtherTooltip);
    return () => window.removeEventListener(OPEN_EVENT, closeOtherTooltip);
  }, [instanceId]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", schedulePositionUpdate);
    window.addEventListener("scroll", schedulePositionUpdate, { capture: true, passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedulePositionUpdate);
    if (triggerRef.current) observer?.observe(triggerRef.current);
    if (floatingRef.current) observer?.observe(floatingRef.current);
    return () => {
      window.removeEventListener("resize", schedulePositionUpdate);
      window.removeEventListener("scroll", schedulePositionUpdate, { capture: true });
      observer?.disconnect();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [open, schedulePositionUpdate]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const describedBy = [trigger.props["aria-describedby"], open ? tooltipId : null].filter(Boolean).join(" ") || undefined;
  // cloneElement is intentional here: a wrapper would alter flex/grid layout. React's
  // refs lint cannot currently model a callback ref passed through this slot pattern.
  /* eslint-disable react-hooks/refs */
  const triggerNode = cloneElement(trigger, {
    "aria-describedby": describedBy,
    onBlur: (event) => {
      trigger.props.onBlur?.(event);
      hide();
    },
    onFocus: (event) => {
      trigger.props.onFocus?.(event);
      show(true);
    },
    onKeyDown: (event) => {
      trigger.props.onKeyDown?.(event);
      if (event.key === "Escape") hide(true);
    },
    onPointerEnter: (event) => {
      trigger.props.onPointerEnter?.(event);
      if (event.pointerType !== "touch") show();
    },
    onPointerLeave: (event) => {
      trigger.props.onPointerLeave?.(event);
      hide();
    },
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      assignRef(trigger.props.ref, node);
    },
  });
  /* eslint-enable react-hooks/refs */
  const arrowStyle: CSSProperties = position?.arrowX != null
    ? { left: position.arrowX }
    : position?.arrowY != null
      ? { top: position.arrowY }
      : {};

  return (
    <>
      {triggerNode}
      {open && typeof document !== "undefined" ? createPortal(
        <div
          ref={floatingRef}
          id={tooltipId}
          role="tooltip"
          popover="manual"
          data-ready={position ? "true" : "false"}
          data-side={position?.side}
          className={cn("ui-tooltip", className)}
          style={{
            left: position?.left ?? 0,
            maxWidth: `min(${maxWidth}px, calc(100vw - 16px))`,
            top: position?.top ?? 0,
            visibility: position ? "visible" : "hidden",
          }}
          onPointerEnter={() => {
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
          }}
          onPointerLeave={() => hide()}
        >
          {content}
          <span className="ui-tooltip__arrow" aria-hidden="true" style={arrowStyle} />
        </div>,
        document.body,
      ) : null}
    </>
  );
}
