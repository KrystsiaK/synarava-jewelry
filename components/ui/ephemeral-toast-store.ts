/**
 * Module-level toast queue.
 *
 * Admin Save calls `pushToast` then `router.refresh()`. The nested
 * `AdminToastProvider` under the async RSC layout remounts on soft refresh and
 * would wipe React `useState` — so the queue lives outside the component tree.
 */

import {
  dismissToast as dismissFromQueue,
  enqueueToast,
  type EphemeralToastItem,
  type EphemeralToastTone,
} from "./ephemeral-toast-queue";

export type PushToastInput = {
  message: string;
  tone: EphemeralToastTone;
};

export type ToastSurface = "storefront" | "admin";

type ToastStoreSnapshot = {
  toasts: readonly EphemeralToastItem[];
  /** Prefer admin chrome while any admin surface provider is mounted. */
  surface: ToastSurface;
};

const EMPTY: ToastStoreSnapshot = { toasts: [], surface: "storefront" };

let toasts: EphemeralToastItem[] = [];
let adminMountCount = 0;
/** Cached for useSyncExternalStore — must be referentially stable until mutate. */
let cachedSnapshot: ToastStoreSnapshot = EMPTY;
const listeners = new Set<() => void>();

function createToastId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function rebuildSnapshot() {
  cachedSnapshot = {
    toasts,
    surface: adminMountCount > 0 ? "admin" : "storefront",
  };
}

function emit() {
  rebuildSnapshot();
  for (const listener of listeners) listener();
}

export function subscribeToastStore(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getToastStoreSnapshot(): ToastStoreSnapshot {
  return cachedSnapshot;
}

export function getToastStoreServerSnapshot(): ToastStoreSnapshot {
  return EMPTY;
}

/** While mounted, toast stack uses admin placement (top / admin z-index). */
export function registerAdminToastSurface() {
  adminMountCount += 1;
  emit();
  return () => {
    adminMountCount = Math.max(0, adminMountCount - 1);
    emit();
  };
}

export function pushToastToStore(input: PushToastInput) {
  const message = input.message.trim();
  if (!message) return;
  const item: EphemeralToastItem = {
    id: createToastId(),
    message,
    tone: input.tone,
  };
  toasts = enqueueToast(toasts, item);
  emit();
}

export function dismissToastFromStore(id: string) {
  toasts = dismissFromQueue(toasts, id);
  emit();
}

/** Test helper — clear queue and surface registration between cases. */
export function resetToastStoreForTests() {
  toasts = [];
  adminMountCount = 0;
  emit();
}
