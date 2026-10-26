"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

/**
 * Client state that FOLLOWS server data.
 *
 * `useState(serverProp)` copies the prop once: after router.refresh() (top-bar check, Apply, Save) the
 * server sends fresh data but the copy ignores it until a hard reload — banners, counters and lists
 * look "not updated". This keeps local edits (optimistic updates, reorder) but resets to the server
 * value whenever the server hands us a NEW value (identity change).
 *
 * Pass a referentially stable value (the RSC prop itself, or a `useMemo` of it).
 */
export function useSyncedState<T>(serverValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState(serverValue);
  const [seen, setSeen] = useState(serverValue);
  if (!Object.is(seen, serverValue)) {
    setSeen(serverValue);
    setState(serverValue);
  }
  return [state, setState];
}
