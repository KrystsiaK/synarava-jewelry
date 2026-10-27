"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  areListStatesEqual,
  defaultListState,
  hasListStateParams,
  listStateToSearchString,
  parseListState,
  type ListStateSchema,
} from "@/lib/list-state";

import type { ListStateAdapter } from "./adapters";

const URL_EVENT = "list-state:url";
const DEFAULT_DEBOUNCE_MS = 280;

export type UseListStateOptions<TState extends Record<string, unknown>> = {
  /** SSR-parsed state so the first paint matches the server. */
  initialState?: TState;
  /** Keys that update a local draft immediately and commit to the URL after debounce. */
  debounceKeys?: ReadonlyArray<keyof TState>;
  debounceMs?: number;
};

export type UseListStateResult<TState extends Record<string, unknown>> = {
  state: TState;
  /** Immediate draft values for debounced keys (falls back to committed state). */
  draft: TState;
  setState: (next: TState | ((prev: TState) => TState)) => void;
  setField: <K extends keyof TState>(key: K, value: TState[K]) => void;
  setFieldDebounced: <K extends keyof TState>(key: K, value: TState[K]) => void;
  /** Reset to schema defaults, clear storage (admin), replace URL. */
  clear: () => void;
};

function omitDraftKey<TState extends Record<string, unknown>>(
  prev: Partial<TState>,
  key: keyof TState,
): Partial<TState> {
  if (!(key in prev)) return prev;
  const next = { ...prev };
  delete next[key];
  return next;
}

function hrefFor(pathname: string, query: string): string {
  return query ? `${pathname}?${query}` : pathname;
}

function readWindowParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function subscribeUrl(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => onStoreChange();
  window.addEventListener("popstate", handler);
  window.addEventListener(URL_EVENT, handler);
  return () => {
    window.removeEventListener("popstate", handler);
    window.removeEventListener(URL_EVENT, handler);
  };
}

function getUrlSearchSnapshot(): string {
  if (typeof window === "undefined") return "";
  return window.location.search;
}

function paramsFromSearch(search: string): URLSearchParams {
  const trimmed = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(trimmed);
}

/**
 * Shared list-state hook. URL is the source of truth via `router.replace({ scroll: false })`.
 * Admin adapters may restore the last session when the URL has no schema params.
 * Committed state is derived with useSyncExternalStore — no local mirror, no render storms.
 */
export function useListState<TState extends Record<string, unknown>>(
  schema: ListStateSchema<TState>,
  adapter: ListStateAdapter<TState>,
  options: UseListStateOptions<TState> = {},
): UseListStateResult<TState> {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const debounceKeySet = useMemo(
    () => new Set(options.debounceKeys ?? []),
    [options.debounceKeys],
  );

  const defaults = useMemo(() => defaultListState(schema), [schema]);
  const initial = options.initialState ?? defaults;

  const serverSearch = useMemo(() => {
    const query = listStateToSearchString(schema, initial);
    return query ? `?${query}` : "";
  }, [schema, initial]);

  const urlSearch = useSyncExternalStore(subscribeUrl, getUrlSearchSnapshot, () => serverSearch);

  const storage = adapter.storage;
  const storageSubscribe = useCallback(
    (onChange: () => void) => (storage ? storage.subscribe(onChange) : () => {}),
    [storage],
  );
  const storageSnapshot = useSyncExternalStore(
    storageSubscribe,
    () => storage?.getSnapshot() ?? null,
    () => null,
  );
  void storageSnapshot;

  const state = useMemo(
    () => parseListState(schema, paramsFromSearch(urlSearch)),
    [schema, urlSearch],
  );
  const stateRef = useRef(state);
  const [draftOverrides, setDraftOverrides] = useState<Partial<TState>>({});
  const restoredRef = useRef(false);
  const debounceTimers = useRef<Map<keyof TState, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const replaceUrl = useCallback(
    (next: TState) => {
      const query = listStateToSearchString(schema, next);
      const href = hrefFor(pathname, query);
      router.replace(href, { scroll: false });
      if (typeof window !== "undefined") {
        const current = `${window.location.pathname}${window.location.search}`;
        if (current !== href) {
          window.history.replaceState(window.history.state, "", href);
        }
        window.dispatchEvent(new Event(URL_EVENT));
      }
      storage?.save(next);
    },
    [pathname, router, schema, storage],
  );

  const commit = useCallback(
    (next: TState) => {
      if (areListStatesEqual(schema, stateRef.current, next)) return;
      replaceUrl(next);
    },
    [replaceUrl, schema],
  );

  // One-shot admin restore / URL persist. Mutates URL + storage only (no React setState).
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const params = readWindowParams();
    if (hasListStateParams(schema, params)) {
      storage?.save(parseListState(schema, params));
      return;
    }

    const saved = storage?.load();
    if (saved) {
      replaceUrl(saved);
    }
  }, [schema, storage, replaceUrl]);

  useEffect(() => () => {
    for (const timer of debounceTimers.current.values()) clearTimeout(timer);
    debounceTimers.current.clear();
  }, []);

  const setState = useCallback(
    (next: TState | ((prev: TState) => TState)) => {
      const resolved = typeof next === "function" ? (next as (prev: TState) => TState)(stateRef.current) : next;
      setDraftOverrides({});
      commit(resolved);
    },
    [commit],
  );

  const setField = useCallback(
    <K extends keyof TState>(key: K, value: TState[K]) => {
      const timer = debounceTimers.current.get(key);
      if (timer) {
        clearTimeout(timer);
        debounceTimers.current.delete(key);
      }
      setDraftOverrides((prev) => omitDraftKey(prev, key));
      commit({ ...stateRef.current, [key]: value });
    },
    [commit],
  );

  const setFieldDebounced = useCallback(
    <K extends keyof TState>(key: K, value: TState[K]) => {
      if (!debounceKeySet.has(key)) {
        setField(key, value);
        return;
      }
      setDraftOverrides((prev) => ({ ...prev, [key]: value }));
      const existing = debounceTimers.current.get(key);
      if (existing) clearTimeout(existing);
      debounceTimers.current.set(
        key,
        setTimeout(() => {
          debounceTimers.current.delete(key);
          setDraftOverrides((prev) => omitDraftKey(prev, key));
          commit({ ...stateRef.current, [key]: value });
        }, debounceMs),
      );
    },
    [commit, debounceKeySet, debounceMs, setField],
  );

  const clear = useCallback(() => {
    for (const timer of debounceTimers.current.values()) clearTimeout(timer);
    debounceTimers.current.clear();
    setDraftOverrides({});
    storage?.clear();
    commit(defaults);
  }, [commit, defaults, storage]);

  const draft = useMemo(
    () => ({ ...state, ...draftOverrides }),
    [state, draftOverrides],
  );

  return {
    state,
    draft,
    setState,
    setField,
    setFieldDebounced,
    clear,
  };
}
