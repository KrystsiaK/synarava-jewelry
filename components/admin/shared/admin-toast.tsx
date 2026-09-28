"use client";

/**
 * Admin adapter for the shared ephemeral toast (`components/ui/ephemeral-toast`).
 * Prefer `useEphemeralToast` / `EphemeralToastProvider` for new cross-surface work.
 * Keep this module so existing admin mutation call sites stay stable.
 */

import type { ReactNode } from "react";

import {
  EphemeralToastProvider,
  useEphemeralToast,
  type EphemeralToastTone,
} from "@/components/ui/ephemeral-toast";

export type AdminToastTone = EphemeralToastTone;

export function AdminToastProvider({ children }: { children: ReactNode }) {
  // host=false: root `EphemeralToastProvider` in app/layout.tsx owns the portal.
  // This adapter only flips placement to admin while mounted and wires pushToast
  // to the module store — so Save → router.refresh() remounts cannot wipe toasts.
  return (
    <EphemeralToastProvider surface="admin" host={false}>
      {children}
    </EphemeralToastProvider>
  );
}

export function useAdminToast() {
  return useEphemeralToast();
}
