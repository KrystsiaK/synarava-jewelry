"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/ui";

type AnimatedModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  variant?: "modal" | "sheet";
  className?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  zIndexClassName?: string;
  backdropZIndexClassName?: string;
};

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
  ariaLabel,
  ariaLabelledBy,
  zIndexClassName = "z-50",
  backdropZIndexClassName = "z-40",
}: AnimatedModalProps) {
  const [mounted, setMounted] = useState(open);
  const [visuallyOpen, setVisuallyOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

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
    const previousOverflow = document.body.style.overflow;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
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
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      (firstFocusable ?? dialogRef.current)?.focus();
    });
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      window.cancelAnimationFrame(focusFrame);
      previousFocusRef.current?.focus();
    };
  }, [mounted, onClose]);

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

  return (
    <>
      <button
        type="button"
        className={cn("modal-backdrop fixed inset-0 cursor-default", backdropZIndexClassName, visuallyOpen && "is-open")}
        onClick={onClose}
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
    </>
  );
}
