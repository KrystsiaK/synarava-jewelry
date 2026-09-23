"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/ui";

type AnimatedModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  variant?: "modal" | "sheet";
  className?: string;
  portalClassName?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  zIndexClassName?: string;
  backdropZIndexClassName?: string;
};

let nextModalId = 0;
const activeModalIds = new Set<number>();

/** Clear body scroll lock + app-shell inert only when the last modal unmounts.
 *  Stacked save/restore of previousOverflow/previousInert leaves the page stuck
 *  (overflow:hidden + inert) after Link navigation closes several layers at once. */
function releaseDocumentLocksIfIdle() {
  if (activeModalIds.size > 0) return;
  document.body.style.overflow = "";
  Array.from(document.body.children).forEach((element) => {
    if (element instanceof HTMLElement && element.dataset.animatedModalRoot !== "true") {
      element.inert = false;
    }
  });
}

function transitionDuration(variable: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  const value = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim();
  if (!value) return fallback;
  if (value.endsWith("ms")) return Number.parseFloat(value);
  if (value.endsWith("s")) return Number.parseFloat(value) * 1000;
  return fallback;
}

export function AnimatedModal({
  open,
  onClose,
  children,
  variant = "modal",
  className,
  portalClassName,
  ariaLabel,
  ariaLabelledBy,
  zIndexClassName = "z-50",
  backdropZIndexClassName = "z-40",
}: AnimatedModalProps) {
  const [mounted, setMounted] = useState(open);
  const [visuallyOpen, setVisuallyOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const modalRootRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const [modalId] = useState(() => ++nextModalId);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (open) {
      // Mount first, then move to the open state on the next paint so the
      // browser has a real start frame to animate from.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
      const frame = window.requestAnimationFrame(() => setVisuallyOpen(true));
      return () => window.cancelAnimationFrame(frame);
    }

    if (!mounted) return;
    setVisuallyOpen(false);
    const closeDuration =
      variant === "sheet"
        ? transitionDuration("--panel-close-dur", 350)
        : transitionDuration("--modal-close-dur", 150);
    const timer = window.setTimeout(() => setMounted(false), closeDuration);
    return () => window.clearTimeout(timer);
  }, [mounted, open, variant]);

  useEffect(() => {
    if (!mounted) return;
    activeModalIds.add(modalId);
    // Never inert sibling modal portals — only the app shell behind the stack.
    const background = Array.from(document.body.children).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement
        && element !== modalRootRef.current
        && element.dataset.animatedModalRoot !== "true",
    );
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    background.forEach((element) => { element.inert = true; });

    function handleKeyDown(event: KeyboardEvent) {
      if (modalId !== Math.max(...activeModalIds)) return;
      if (event.key === "Escape") onCloseRef.current();
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    const focusFrame = window.requestAnimationFrame(() => {
      if (modalId !== Math.max(...activeModalIds)) return;
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      (firstFocusable ?? dialogRef.current)?.focus();
    });
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.cancelAnimationFrame(focusFrame);
      activeModalIds.delete(modalId);
      releaseDocumentLocksIfIdle();
      previousFocusRef.current?.focus();
    };
  }, [modalId, mounted]);

  if (!mounted) return null;

  const surface = (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cn(
        variant === "sheet" ? "t-panel-slide" : "t-modal",
        variant === "modal" && visuallyOpen && "is-open",
        variant === "modal" && !open && "is-closing",
        className,
      )}
      data-open={variant === "sheet" ? String(visuallyOpen) : undefined}
    >
      {children}
    </div>
  );

  return createPortal(
    <div ref={modalRootRef} className={cn("fixed inset-0 isolate", zIndexClassName, portalClassName)} data-animated-modal-root="true">
      <button
        type="button"
        className={cn("modal-backdrop fixed inset-0 cursor-default", backdropZIndexClassName, visuallyOpen && "is-open")}
        onClick={() => onCloseRef.current()}
        aria-label="Close dialog"
        tabIndex={-1}
      />
      {variant === "modal" ? (
        <div className={cn("pointer-events-none fixed inset-0 flex items-center justify-center px-6", zIndexClassName)}>
          {surface}
        </div>
      ) : (
        <div className={zIndexClassName}>{surface}</div>
      )}
    </div>,
    document.body,
  );
}
