"use client";

import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AdminShopifyCheckContextValue = {
  /** Server-backed: a ShopifyReconcileRun is QUEUED/RUNNING (within lease). */
  checkRunning: boolean;
  setCheckRunning: (running: boolean) => void;
};

const AdminShopifyCheckContext = createContext<AdminShopifyCheckContextValue | null>(null);

export function AdminShopifyCheckProvider({
  initialRunning,
  children,
}: {
  initialRunning: boolean;
  children: ReactNode;
}) {
  const [checkRunning, setCheckRunningState] = useState(initialRunning);
  const [prevInitialRunning, setPrevInitialRunning] = useState(initialRunning);
  // Sync layout prop after reload / RSC refresh without an effect (react-hooks cascading-renders).
  if (initialRunning !== prevInitialRunning) {
    setPrevInitialRunning(initialRunning);
    setCheckRunningState(initialRunning);
  }

  const setCheckRunning = useCallback((running: boolean) => {
    setCheckRunningState(running);
  }, []);

  const value = useMemo(
    () => ({ checkRunning, setCheckRunning }),
    [checkRunning, setCheckRunning],
  );

  return (
    <AdminShopifyCheckContext.Provider value={value}>
      {children}
    </AdminShopifyCheckContext.Provider>
  );
}

/** True while a full catalog check is in flight (survives reload via initialRunning). */
export function useAdminShopifyCheckRunning(): boolean {
  const ctx = use(AdminShopifyCheckContext);
  return ctx?.checkRunning ?? false;
}

export function useAdminShopifyCheckControls(): AdminShopifyCheckContextValue {
  const ctx = use(AdminShopifyCheckContext);
  if (!ctx) {
    return {
      checkRunning: false,
      setCheckRunning: () => undefined,
    };
  }
  return ctx;
}
