"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const emptySubscribe = () => () => undefined;

type AdminToastTone = "success" | "error" | "info";

type AdminToastItem = {
  id: string;
  message: string;
  tone: AdminToastTone;
};

type AdminToastContextValue = {
  pushToast: (input: { message: string; tone: AdminToastTone }) => void;
};

const AdminToastContext = createContext<AdminToastContextValue>({
  pushToast: () => undefined,
});

const TOAST_DISMISS_MS = 22_000;

function toastStyles(tone: AdminToastTone) {
  if (tone === "error") {
    return {
      borderColor: "rgba(255, 177, 171, 0.55)",
      background:
        "linear-gradient(180deg, rgba(116, 38, 38, 0.94) 0%, rgba(76, 24, 24, 0.97) 100%)",
      color: "#fff7f5",
      shadow: "0 1px 1px rgba(40, 8, 8, 0.12), 0 10px 24px rgba(40, 8, 8, 0.22)",
    };
  }

  if (tone === "success") {
    return {
      borderColor: "rgba(220, 239, 181, 0.55)",
      background:
        "linear-gradient(180deg, rgba(62, 84, 38, 0.94) 0%, rgba(34, 48, 20, 0.97) 100%)",
      color: "#fffdf8",
      shadow: "0 1px 1px rgba(14, 24, 8, 0.1), 0 10px 24px rgba(14, 24, 8, 0.2)",
    };
  }

  return {
    borderColor: "rgba(244, 223, 167, 0.58)",
    background:
      "linear-gradient(180deg, rgba(87, 69, 30, 0.94) 0%, rgba(58, 43, 15, 0.97) 100%)",
    color: "#fffdf8",
    shadow: "0 1px 1px rgba(27, 18, 4, 0.1), 0 10px 24px rgba(27, 18, 4, 0.2)",
  };
}

function AdminToastCard({
  toast,
  onClose,
}: {
  toast: AdminToastItem;
  onClose: (id: string) => void;
}) {
  const timerIdRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const remainingMsRef = useRef<number>(TOAST_DISMISS_MS);

  const clearTimer = useCallback(() => {
    if (timerIdRef.current !== null) {
      window.clearTimeout(timerIdRef.current);
      timerIdRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    startedAtRef.current = Date.now();
    timerIdRef.current = window.setTimeout(() => onClose(toast.id), remainingMsRef.current);
  }, [clearTimer, onClose, toast.id]);

  const pauseTimer = useCallback(() => {
    if (timerIdRef.current === null) return;
    const elapsed = Date.now() - startedAtRef.current;
    remainingMsRef.current = Math.max(0, remainingMsRef.current - elapsed);
    clearTimer();
  }, [clearTimer]);

  useEffect(() => {
    startTimer();
    return clearTimer;
  }, [clearTimer, startTimer]);

  const toneStyles = toastStyles(toast.tone);

  return (
    <div data-component="AdminToastCard"
      className="adm-toast-card pointer-events-auto rounded-[12px] border px-3 py-2.5 backdrop-blur"
      role={toast.tone === "error" ? "alert" : "status"}
      aria-live={toast.tone === "error" ? "assertive" : "polite"}
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
      onFocus={pauseTimer}
      onBlur={startTimer}
      style={{
        borderColor: toneStyles.borderColor,
        background: toneStyles.background,
        color: toneStyles.color,
        boxShadow: toneStyles.shadow,
      }}
    >
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <p
            className="mb-0.5 text-[0.68rem] font-semibold capitalize tracking-[0.02em]"
            style={{ color: "rgba(255,255,255,0.76)" }}
          >
            {toast.tone}
          </p>
          <p className="min-w-0 text-sm leading-5" style={{ color: toneStyles.color }}>
            {toast.message}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close notification"
          className="rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold tracking-[0.01em] transition-opacity hover:opacity-100"
          style={{
            borderColor: "rgba(255,255,255,0.24)",
            color: "#fffdf8",
            background: "rgba(255,255,255,0.08)",
            opacity: 0.92,
          }}
          onClick={() => onClose(toast.id)}
        >
          Close
        </button>
      </div>
    </div>
  );
}

export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<AdminToastItem[]>([]);
  // Client-only portal mount without setState-in-effect (React docs: useSyncExternalStore).
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const pushToast = useCallback((input: { message: string; tone: AdminToastTone }) => {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current, { id, ...input }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  const stack = (
    <div
      data-admin-toast-root="true"
      className="adm-toast-stack pointer-events-none fixed left-1/2 top-4 z-[var(--adm-z-toast,600)] grid w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 gap-2 md:top-6"
    >
      {toasts.map((toast) => (
        <AdminToastCard key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </div>
  );

  return (
    <AdminToastContext.Provider value={value}>
      {children}
      {/* Portal above conflict modals (z-200…500). Stay outside inert app-shell. */}
      {mounted ? createPortal(stack, document.body) : null}
    </AdminToastContext.Provider>
  );
}

export function useAdminToast() {
  return useContext(AdminToastContext);
}
