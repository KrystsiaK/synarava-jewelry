"use client";

import {
  Children,
  cloneElement,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
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
  onClick?: (event: ReactMouseEvent<HTMLElement>) => void;
  onFocus?: (event: ReactFocusEvent<HTMLElement>) => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLElement>) => void;
  onPointerCancel?: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerEnter?: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave?: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLElement>) => void;
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
/** Fired by ephemeral toasts so Save-button tooltips do not become primary feedback. */
const TOAST_EVENT = "synarava:ephemeral-toast";
/** After one help tag, the next opens at once — scanning a row should not re-wait. */
const WARM_MS = 480;
/** Suppress focus-open after a toast (confirm-modal restores focus onto Save). */
const TOAST_FOCUS_SUPPRESS_MS = 900;
let warmUntil = 0;
let suppressFocusUntil = 0;

function noteWarm() {
  warmUntil = Date.now() + WARM_MS;
}

function isWarm() {
  return Date.now() < warmUntil;
}

function isFocusSuppressedAfterToast() {
  return Date.now() < suppressFocusUntil;
}

export function resetTooltipWarmth() {
  warmUntil = 0;
  suppressFocusUntil = 0;
}

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
  const touchArmedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const openRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
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
      if (touchArmedRef.current) suppressClickRef.current = true;
      window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: instanceId }));
      setPortalTarget(
        triggerRef.current?.closest<HTMLElement>(".admin-terminal, .admin-modal-root") ?? document.body,
      );
      setPosition(null);
      openRef.current = true;
      setOpen(true);
      noteWarm();
    };
    if (immediate || delay === 0 || isWarm()) commit();
    else openTimerRef.current = setTimeout(commit, delay);
  }, [content, delay, instanceId]);

  const hide = useCallback((immediate = false) => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    openTimerRef.current = null;
    if (immediate) {
      closeTimerRef.current = null;
      openRef.current = false;
      setPosition(null);
      setOpen(false);
      noteWarm();
    } else {
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        openRef.current = false;
        setPosition(null);
        setOpen(false);
        noteWarm();
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
        openRef.current = false;
        setPosition(null);
        setOpen(false);
      }
    };
    const closeForToast = () => {
      clearTimers();
      suppressFocusUntil = Date.now() + TOAST_FOCUS_SUPPRESS_MS;
      openRef.current = false;
      setPosition(null);
      setOpen(false);
    };
    window.addEventListener(OPEN_EVENT, closeOtherTooltip);
    window.addEventListener(TOAST_EVENT, closeForToast);
    return () => {
      window.removeEventListener(OPEN_EVENT, closeOtherTooltip);
      window.removeEventListener(TOAST_EVENT, closeForToast);
    };
  }, [clearTimers, instanceId]);

  useEffect(() => {
    if (!open) return;
    const dismissFromOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || floatingRef.current?.contains(target)) return;
      hide(true);
    };
    window.addEventListener("resize", schedulePositionUpdate);
    window.addEventListener("scroll", schedulePositionUpdate, { capture: true, passive: true });
    document.addEventListener("pointerdown", dismissFromOutside);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedulePositionUpdate);
    if (triggerRef.current) observer?.observe(triggerRef.current);
    if (floatingRef.current) observer?.observe(floatingRef.current);
    return () => {
      window.removeEventListener("resize", schedulePositionUpdate);
      window.removeEventListener("scroll", schedulePositionUpdate, { capture: true });
      document.removeEventListener("pointerdown", dismissFromOutside);
      observer?.disconnect();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [hide, open, schedulePositionUpdate]);

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
    onClick: (event) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        touchArmedRef.current = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      trigger.props.onClick?.(event);
    },
    onFocus: (event) => {
      trigger.props.onFocus?.(event);
      // Confirm-modal focus return onto Save must not open the instructional
      // tooltip as if it were the save result — toast owns that moment.
      // Event-handler clock gate (not render); module timestamp set on toast close.
      if (isFocusSuppressedAfterToast()) return;
      show(true);
    },
    onKeyDown: (event) => {
      trigger.props.onKeyDown?.(event);
      if (event.key === "Escape") hide(true);
    },
    onPointerCancel: (event) => {
      trigger.props.onPointerCancel?.(event);
      touchArmedRef.current = false;
      hide(true);
    },
    onPointerDown: (event) => {
      trigger.props.onPointerDown?.(event);
      if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
      touchArmedRef.current = true;
      show();
    },
    onPointerEnter: (event) => {
      trigger.props.onPointerEnter?.(event);
      if (event.pointerType !== "touch") show();
    },
    onPointerLeave: (event) => {
      trigger.props.onPointerLeave?.(event);
      if (event.pointerType === "touch") return;
      hide();
    },
    onPointerUp: (event) => {
      trigger.props.onPointerUp?.(event);
      if (event.pointerType !== "touch" || openRef.current) return;
      touchArmedRef.current = false;
      hide(true);
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
      {open && portalTarget ? createPortal(
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
            top: position?.top ?? 0,
            visibility: position ? "visible" : "hidden",
          }}
          onPointerEnter={() => {
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
          }}
          onPointerLeave={() => hide()}
        >
          <span className="ui-tooltip__arrow" aria-hidden="true" style={arrowStyle} />
          <div className="ui-tooltip__box" style={{ maxWidth: `min(${maxWidth}px, calc(100vw - 16px))` }}>
            {content}
          </div>
        </div>,
        portalTarget,
      ) : null}
    </>
  );
}
