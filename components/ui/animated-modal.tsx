"use client";

import { useEffect, useState } from "react";

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
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  const surface = (
    <div
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
