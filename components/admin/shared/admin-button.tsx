"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/ui";

export type AdminButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASS: Record<AdminButtonVariant, string> = {
  primary: "adm-btn-primary",
  secondary: "adm-btn-secondary",
  ghost: "adm-btn-ghost",
  danger: "adm-btn-danger",
};

export type AdminButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AdminButtonVariant;
  /** Disables the control and sets `aria-busy`. Callers own busy label copy. */
  busy?: boolean;
  /** Optional glyph before the label (gap comes from `.adm-btn-*`). */
  leadingIcon?: ReactNode;
  children?: ReactNode;
};

/**
 * Shared admin text button — reuses `.adm-btn-*` chrome (no new styles).
 * Icon-only square actions stay on `AdminIconButton`.
 */
export function AdminButton({
  variant = "primary",
  busy = false,
  leadingIcon,
  className,
  type = "button",
  disabled,
  children,
  ...props
}: AdminButtonProps) {
  const isDisabled = Boolean(disabled || busy);

  return (
    <button
      type={type}
      data-component="AdminButton"
      data-variant={variant}
      data-busy={busy ? "true" : undefined}
      disabled={isDisabled}
      aria-busy={busy || undefined}
      className={cn(VARIANT_CLASS[variant], className)}
      {...props}
    >
      {leadingIcon}
      {children}
    </button>
  );
}
