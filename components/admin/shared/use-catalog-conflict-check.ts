"use client";

import { useCallback, useState, useTransition } from "react";

import { useAdminToast } from "@/components/admin/shared/admin-toast";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

export type CatalogConflictStoreMismatch = {
  boundShopDomain: string;
  currentShopDomain: string;
};

export type CatalogConflictCheckResult =
  | {
      signals: CatalogConflictSignals;
      success?: string;
      warning?: string;
    }
  | {
      error: string;
      storeMismatch?: CatalogConflictStoreMismatch | null;
    };

type UseCatalogConflictCheckOptions = {
  initialSignals: CatalogConflictSignals;
  runCheck: () => Promise<CatalogConflictCheckResult>;
  /** Optional: products list handles store-binding mismatch UI. */
  onStoreMismatch?: (mismatch: CatalogConflictStoreMismatch | null) => void;
  /** Optional: e.g. router.refresh after signals update. */
  onAfterCheck?: () => void;
};

/**
 * Shared conflict-check flow for Products and Collections list/editor banners.
 * Updates signals (banner) only — never opens the conflict modal.
 * At most one error toast; success is silent (banner is the result).
 */
export function useCatalogConflictCheck({
  initialSignals,
  runCheck,
  onStoreMismatch,
  onAfterCheck,
}: UseCatalogConflictCheckOptions) {
  const [isChecking, startCheckTransition] = useTransition();
  const [signalsOverride, setSignalsOverride] = useState({
    base: initialSignals,
    value: initialSignals,
  });
  const signals =
    signalsOverride.base === initialSignals ? signalsOverride.value : initialSignals;
  const { pushToast } = useAdminToast();

  const setSignals = useCallback(
    (value: CatalogConflictSignals) => {
      setSignalsOverride({ base: initialSignals, value });
    },
    [initialSignals],
  );

  const runConflictCheck = useCallback(() => {
    startCheckTransition(async () => {
      const result = await runCheck();
      if (!("signals" in result)) {
        pushToast({ message: result.error, tone: "error" });
        onStoreMismatch?.(
          "storeMismatch" in result ? (result.storeMismatch ?? null) : null,
        );
        return;
      }
      onStoreMismatch?.(null);
      setSignals(result.signals);
      onAfterCheck?.();
    });
  }, [onAfterCheck, onStoreMismatch, pushToast, runCheck, setSignals]);

  return {
    signals,
    setSignals,
    isChecking,
    runConflictCheck,
  };
}
