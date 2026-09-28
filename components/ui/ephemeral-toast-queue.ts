export type EphemeralToastTone = "success" | "error" | "info";

export type EphemeralToastItem = {
  id: string;
  message: string;
  tone: EphemeralToastTone;
};

/** Cap concurrent visible toasts — never a vertical wall. */
export const MAX_VISIBLE_TOASTS = 2;

/** Short for status; longer when the reader may need the error copy. */
export const TOAST_DURATION_MS: Record<EphemeralToastTone, number> = {
  success: 3_200,
  info: 4_000,
  error: 7_000,
};

function toastKey(toast: Pick<EphemeralToastItem, "message" | "tone">) {
  return `${toast.tone}::${toast.message}`;
}

/**
 * Newest wins. Same message+tone replaces the existing card (timer resets via new id).
 * At capacity, the oldest distinct toast is dropped.
 */
export function enqueueToast(
  current: readonly EphemeralToastItem[],
  next: EphemeralToastItem,
): EphemeralToastItem[] {
  const key = toastKey(next);
  const withoutDup = current.filter((toast) => toastKey(toast) !== key);
  return [...withoutDup, next].slice(-MAX_VISIBLE_TOASTS);
}

export function dismissToast(
  current: readonly EphemeralToastItem[],
  id: string,
): EphemeralToastItem[] {
  return current.filter((toast) => toast.id !== id);
}
