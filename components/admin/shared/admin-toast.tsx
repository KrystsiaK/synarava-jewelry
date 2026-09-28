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
  return <EphemeralToastProvider surface="admin">{children}</EphemeralToastProvider>;
}

export function useAdminToast() {
  return useEphemeralToast();
}
