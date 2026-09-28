"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "@/lib/ui";
import { TOAST_DURATION_MS, type EphemeralToastItem, type EphemeralToastTone } from "./ephemeral-toast-queue";
import {
  dismissToastFromStore,
  getToastStoreServerSnapshot,
  getToastStoreSnapshot,
  pushToastToStore,
  registerAdminToastSurface,
  subscribeToastStore,
  type PushToastInput,
  type ToastSurface,
} from "./ephemeral-toast-store";

export type { EphemeralToastItem, EphemeralToastTone };
export { MAX_VISIBLE_TOASTS, TOAST_DURATION_MS, enqueueToast } from "./ephemeral-toast-queue";
export { pushToastToStore as enqueueToastToStore } from "./ephemeral-toast-store";

const emptySubscribe = () => () => undefined;

/** Close open help/action tooltips so they do not compete with Save feedback. */
export const EPHEMERAL_TOAST_EVENT = "synarava:ephemeral-toast";

type EphemeralToastContextValue = {
  pushToast: (input: PushToastInput) => void;
};

const EphemeralToastContext = createContext<EphemeralToastContextValue>({
  pushToast: () => undefined,
});

function announceToast() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EPHEMERAL_TOAST_EVENT));
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

function EphemeralToastHost() {
  const { toasts, surface } = useSyncExternalStore(
    subscribeToastStore,
    getToastStoreSnapshot,
    getToastStoreServerSnapshot,
  );
  // Client-only portal mount without setState-in-effect (React docs: useSyncExternalStore).
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const removeToast = useCallback((id: string) => {
    dismissToastFromStore(id);
  }, []);

  if (!mounted) return null;

  const stack = (
    <div
      data-ephemeral-toast-root="true"
      data-admin-toast-root={surface === "admin" ? "true" : undefined}
      data-surface={surface}
      className={cn(
        "ephemeral-toast-stack pointer-events-none",
        surface === "admin" ? "ephemeral-toast-stack--admin" : "ephemeral-toast-stack--storefront",
      )}
    >
      <div className="ephemeral-toast-stack__inner">
        {toasts.map((toast) => (
          <EphemeralToastCard key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>
    </div>
  );

  return createPortal(stack, document.body);
}

/**
 * @param host — Only the root provider should host the portal. Nested admin
 *   adapters pass `host={false}` so soft refresh remounts do not duplicate or
 *   orphan the stack; the module store keeps the queue alive.
 */
export function EphemeralToastProvider({
  children,
  surface = "storefront",
  host = true,
}: {
  children: ReactNode;
  surface?: ToastSurface;
  /** When false, only registers surface + context (no portal). */
  host?: boolean;
}) {
  useEffect(() => {
    if (surface !== "admin") return;
    return registerAdminToastSurface();
  }, [surface]);

  const pushToast = useCallback((input: PushToastInput) => {
    const message = input.message.trim();
    if (!message) return;
    // Dismiss Save/icon tooltips first — confirm-modal focus return otherwise
    // opens the button tooltip and steals attention from the toast.
    announceToast();
    pushToastToStore(input);
  }, []);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <EphemeralToastContext.Provider value={value}>
      {children}
      {/* Portal above modals / sticky chrome. Stay outside inert app-shell. */}
      {host ? <EphemeralToastHost /> : null}
    </EphemeralToastContext.Provider>
  );
}

export function useEphemeralToast() {
  return useContext(EphemeralToastContext);
}
