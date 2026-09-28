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
import { X } from "lucide-react";

import { cn } from "@/lib/ui";
import {
  dismissToast,
  enqueueToast,
  TOAST_DURATION_MS,
  type EphemeralToastItem,
  type EphemeralToastTone,
} from "./ephemeral-toast-queue";

export type { EphemeralToastItem, EphemeralToastTone };
export { MAX_VISIBLE_TOASTS, TOAST_DURATION_MS, enqueueToast } from "./ephemeral-toast-queue";

const emptySubscribe = () => () => undefined;

type PushToastInput = {
  message: string;
  tone: EphemeralToastTone;
};

type EphemeralToastContextValue = {
  pushToast: (input: PushToastInput) => void;
};

const EphemeralToastContext = createContext<EphemeralToastContextValue>({
  pushToast: () => undefined,
});

type Surface = "storefront" | "admin";

function createToastId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function EphemeralToastCard({
  toast,
  onClose,
}: {
  toast: EphemeralToastItem;
  onClose: (id: string) => void;
}) {
  const timerIdRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const remainingMsRef = useRef(TOAST_DURATION_MS[toast.tone]);

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
    remainingMsRef.current = Math.max(0, remainingMsRef.current - (Date.now() - startedAtRef.current));
    clearTimer();
  }, [clearTimer]);

  useEffect(() => {
    remainingMsRef.current = TOAST_DURATION_MS[toast.tone];
    startTimer();
    return clearTimer;
  }, [clearTimer, startTimer, toast.id, toast.tone]);

  return (
    <div
      data-component="EphemeralToastCard"
      data-tone={toast.tone}
      className="ephemeral-toast pointer-events-auto"
      role={toast.tone === "error" ? "alert" : "status"}
      aria-live={toast.tone === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
      onFocus={pauseTimer}
      onBlur={startTimer}
    >
      <span className="ephemeral-toast__accent" aria-hidden="true" />
      <p className="ephemeral-toast__message">{toast.message}</p>
      <button
        type="button"
        className="ephemeral-toast__dismiss"
        aria-label="Close notification"
        onClick={() => onClose(toast.id)}
      >
        <X className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}

export function EphemeralToastProvider({
  children,
  surface = "storefront",
}: {
  children: ReactNode;
  surface?: Surface;
}) {
  const [toasts, setToasts] = useState<EphemeralToastItem[]>([]);
  // Client-only portal mount without setState-in-effect (React docs: useSyncExternalStore).
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const pushToast = useCallback((input: PushToastInput) => {
    const message = input.message.trim();
    if (!message) return;
    const item: EphemeralToastItem = {
      id: createToastId(),
      message,
      tone: input.tone,
    };
    setToasts((current) => enqueueToast(current, item));
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => dismissToast(current, id));
  }, []);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  const stack = (
    <div
      data-ephemeral-toast-root="true"
      data-admin-toast-root={surface === "admin" ? "true" : undefined}
      data-surface={surface}
      className={cn(
        "ephemeral-toast-stack pointer-events-none fixed inset-x-0 z-[var(--z-toast,60)]",
        surface === "admin" && "ephemeral-toast-stack--admin",
      )}
    >
      <div className="ephemeral-toast-stack__inner">
        {toasts.map((toast) => (
          <EphemeralToastCard key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>
    </div>
  );

  return (
    <EphemeralToastContext.Provider value={value}>
      {children}
      {/* Portal above modals / sticky chrome. Stay outside inert app-shell. */}
      {mounted ? createPortal(stack, document.body) : null}
    </EphemeralToastContext.Provider>
  );
}

export function useEphemeralToast() {
  return useContext(EphemeralToastContext);
}
