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

/** Optimistic search after site `router.replace` — avoids a second history write. */
let pendingRouterSearch: string | null = null;

export type UseListStateOptions<TState extends Record<string, unknown>> = {
  /** SSR-parsed state so the first paint matches the server. */
  initialState?: TState;
  /** Keys that update a local draft immediately and commit to the URL after debounce. */
  debounceKeys?: ReadonlyArray<keyof TState>;
  debounceMs?: number;
  /**
   * Override `usePathname()` for surfaces that build locale-aware paths
   * (e.g. storefront `localePath(locale, basePath)`).
   */
  pathname?: string;
  /**
   * Forced values always present in state but omitted from the URL
   * (e.g. collection pinned on `/collections/[slug]`).
   */
  pinned?: Partial<TState>;
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
  const onPopState = () => {
    pendingRouterSearch = null;
    onStoreChange();
  };
  const onUrlEvent = () => onStoreChange();
  window.addEventListener("popstate", onPopState);
  window.addEventListener(URL_EVENT, onUrlEvent);
  return () => {
    window.removeEventListener("popstate", onPopState);
    window.removeEventListener(URL_EVENT, onUrlEvent);
  };
}

/** Test helper — clear optimistic router search between cases. */
export function resetListStateUrlPendingForTests(): void {
  pendingRouterSearch = null;
}

function getUrlSearchSnapshot(): string {
  if (typeof window === "undefined") return "";
  const live = window.location.search;
  if (pendingRouterSearch !== null) {
    if (live === pendingRouterSearch) {
      pendingRouterSearch = null;
      return live;
    }
    return pendingRouterSearch;
  }
  return live;
}

function paramsFromSearch(search: string): URLSearchParams {
  const trimmed = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(trimmed);
}

/**
 * Shared list-state hook. URL is the source of truth.
 * Write path is adapter-owned: admin → `history.replaceState` only; site → `router.replace` only.
 * Never both (no double URL write). Admin may restore the last session when the URL is bare.
 * Committed state is derived with useSyncExternalStore — no local mirror, no render storms.
 */
export function useListState<TState extends Record<string, unknown>>(
  schema: ListStateSchema<TState>,
  adapter: ListStateAdapter<TState>,
  options: UseListStateOptions<TState> = {},
): UseListStateResult<TState> {
  const router = useRouter();
  const routerPathname = usePathname() || "/";
  const pathname = options.pathname ?? routerPathname;
  const pinned = options.pinned;
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const debounceKeySet = useMemo(
    () => new Set(options.debounceKeys ?? []),
    [options.debounceKeys],
  );
  const pinnedKeySet = useMemo(
    () => new Set(pinned ? (Object.keys(pinned) as Array<keyof TState>) : []),
    [pinned],
  );

  const defaults = useMemo(() => defaultListState(schema), [schema]);
  const initial = options.initialState ?? defaults;

  const applyPinned = useCallback(
    (base: TState): TState => (pinned ? { ...base, ...pinned } : base),
    [pinned],
  );

  /** Force pinned keys to defaults so they are omitted from the shareable query string. */
  const stripPinnedForUrl = useCallback(
    (base: TState): TState => {
      if (!pinned || pinnedKeySet.size === 0) return base;
      const next = { ...base };
      for (const key of pinnedKeySet) {
        next[key] = defaults[key];
      }
      return next;
    },
    [defaults, pinned, pinnedKeySet],
  );

  const serverSearch = useMemo(() => {
    const query = listStateToSearchString(schema, stripPinnedForUrl(initial));
    return query ? `?${query}` : "";
  }, [schema, initial, stripPinnedForUrl]);

  const urlSearch = useSyncExternalStore(subscribeUrl, getUrlSearchSnapshot, () => serverSearch);

  const storage = adapter.storage;
  const urlWrite = adapter.urlWrite;
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
    () => applyPinned(parseListState(schema, paramsFromSearch(urlSearch))),
    [schema, urlSearch, applyPinned],
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
      const forUrl = stripPinnedForUrl(applyPinned(next));
      const query = listStateToSearchString(schema, forUrl);
      const href = hrefFor(pathname, query);

      if (urlWrite === "history") {
        pendingRouterSearch = null;
        if (typeof window !== "undefined") {
          const current = `${window.location.pathname}${window.location.search}`;
          if (current !== href) {
            window.history.replaceState(window.history.state, "", href);
          }
          window.dispatchEvent(new Event(URL_EVENT));
        }
      } else {
        // Site: router.replace only — never history.replaceState (no double write).
        pendingRouterSearch = query ? `?${query}` : "";
        router.replace(href, { scroll: false });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event(URL_EVENT));
        }
      }
<<<<<<< HEAD

      storage?.save(next);
    },
    [pathname, router, schema, storage, urlWrite],
=======
      // Persist the effective (pinned) state for admin adapters; site has no storage.
      storage?.save(applyPinned(next));
    },
    [applyPinned, pathname, router, schema, storage, stripPinnedForUrl],
>>>>>>> 4e5a7051 (feat: migrate shop filter-bar onto shared list-state)
  );

  const commit = useCallback(
    (next: TState) => {
      const resolved = applyPinned(next);
      if (areListStatesEqual(schema, stateRef.current, resolved)) return;
      replaceUrl(resolved);
    },
    [applyPinned, replaceUrl, schema],
  );

  // One-shot admin restore / URL persist. Mutates URL + storage only (no React setState).
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const params = readWindowParams();
    if (hasListStateParams(schema, params)) {
      storage?.save(applyPinned(parseListState(schema, params)));
      return;
    }

    const saved = storage?.load();
    if (saved) {
      replaceUrl(applyPinned(saved));
    }
  }, [schema, storage, replaceUrl, applyPinned]);

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
      if (pinnedKeySet.has(key)) return;
      const timer = debounceTimers.current.get(key);
      if (timer) {
        clearTimeout(timer);
        debounceTimers.current.delete(key);
      }
      setDraftOverrides((prev) => omitDraftKey(prev, key));
      commit({ ...stateRef.current, [key]: value });
    },
    [commit, pinnedKeySet],
  );

  const setFieldDebounced = useCallback(
    <K extends keyof TState>(key: K, value: TState[K]) => {
      if (pinnedKeySet.has(key)) return;
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
    [commit, debounceKeySet, debounceMs, pinnedKeySet, setField],
  );

  const clear = useCallback(() => {
    for (const timer of debounceTimers.current.values()) clearTimeout(timer);
    debounceTimers.current.clear();
    setDraftOverrides({});
    storage?.clear();
    commit(applyPinned(defaults));
  }, [applyPinned, commit, defaults, storage]);

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
