import {
  defaultListState,
  isDefaultListState,
  parseListStateRecord,
  type ListStateSchema,
} from "@/lib/list-state";

const STORAGE_PREFIX = "synarava:list-state";

export function listStateStorageKey(listId: string, version: number): string {
  return `${STORAGE_PREFIX}:v${version}:${listId}`;
}

export type ListStateStorage<TState extends Record<string, unknown>> = {
  readonly key: string;
  load(): TState | null;
  save(state: TState): void;
  clear(): void;
  /** Raw string snapshot for useSyncExternalStore (null when missing/unreadable). */
  getSnapshot(): string | null;
  subscribe(onStoreChange: () => void): () => void;
};

type Listener = () => void;

const listenersByKey = new Map<string, Set<Listener>>();

function emit(key: string) {
  const listeners = listenersByKey.get(key);
  if (!listeners) return;
  for (const listener of listeners) listener();
}

function safeGetItem(key: string): string | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): boolean {
  try {
    if (typeof sessionStorage === "undefined") return false;
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveItem(key: string): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.removeItem(key);
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Versioned sessionStorage port. All access is try/catch; unavailable storage is a no-op.
 * Pagination cursors must never be passed into `save`.
 */
export function createListStateStorage<TState extends Record<string, unknown>>(options: {
  listId: string;
  schema: ListStateSchema<TState>;
  version?: number;
}): ListStateStorage<TState> {
  const version = options.version ?? 1;
  const key = listStateStorageKey(options.listId, version);
  const { schema } = options;

  return {
    key,
    getSnapshot() {
      return safeGetItem(key);
    },
    subscribe(onStoreChange) {
      let set = listenersByKey.get(key);
      if (!set) {
        set = new Set();
        listenersByKey.set(key, set);
      }
      set.add(onStoreChange);

      const onWindowStorage = (event: StorageEvent) => {
        if (event.storageArea === sessionStorage && event.key === key) {
          onStoreChange();
        }
      };
      if (typeof window !== "undefined") {
        window.addEventListener("storage", onWindowStorage);
      }

      return () => {
        set!.delete(onStoreChange);
        if (set!.size === 0) listenersByKey.delete(key);
        if (typeof window !== "undefined") {
          window.removeEventListener("storage", onWindowStorage);
        }
      };
    },
    load() {
      const raw = safeGetItem(key);
      if (raw == null) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        const state = parseListStateRecord(schema, parsed);
        if (isDefaultListState(schema, state)) return null;
        return state;
      } catch {
        return null;
      }
    },
    save(state) {
      if (isDefaultListState(schema, state)) {
        safeRemoveItem(key);
        emit(key);
        return;
      }
      // Persist only schema keys (never cursor / limit / unknown).
      const bag: Record<string, unknown> = {};
      for (const fieldKey of Object.keys(schema.fields) as Array<keyof TState>) {
        const field = schema.fields[fieldKey];
        const serialized = field.serialize(state[fieldKey]);
        if (serialized != null) bag[field.key] = serialized;
      }
      if (Object.keys(bag).length === 0) {
        safeRemoveItem(key);
        emit(key);
        return;
      }
      if (safeSetItem(key, JSON.stringify(bag))) emit(key);
    },
    clear() {
      safeRemoveItem(key);
      emit(key);
    },
  };
}

/** Test helper: empty typed defaults without touching storage. */
export function emptyListState<TState extends Record<string, unknown>>(
  schema: ListStateSchema<TState>,
): TState {
  return defaultListState(schema);
}
