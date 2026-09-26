"use client";

import type { ReactNode } from "react";

import { AnimatedModal } from "@/components/ui/animated-modal";
import { cn } from "@/lib/ui";

export type AdminModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
};

/**
 * Admin dialog. Dims the page, centers a 14px sheet, and settles without bounce.
 * Storefront `.t-modal` timing is unchanged.
 */
export function AdminModal({
  open,
  onClose,
  children,
  className,
  ariaLabel,
  ariaLabelledBy,
}: AdminModalProps) {
  return (
    <AnimatedModal
      open={open}
      onClose={onClose}
      chrome="admin"
      className={cn(className)}
      portalClassName="admin-modal-root"
      zIndexClassName="z-[200]"
      backdropZIndexClassName="z-[190]"
      ariaLabel={ariaLabel}
      ariaLabelledBy={ariaLabelledBy}
    >
      {children}
    </AnimatedModal>
  );
}
