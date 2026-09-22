import type { ShopListingProduct } from "@/lib/content/shop-listing";

export type CatalogViewAnchor = { productId: string; offsetPx: number };

export type CatalogViewSnapshot = {
  viewKey: string;
  savedAt: number;
  nodes: ShopListingProduct[];
  endCursor: string | null;
  hasNextPage: boolean;
  totalCount: number;
  anchor: CatalogViewAnchor | null;
};

const TTL_MS = 30 * 60 * 1000;
// ponytail: bounds how many distinct filter/sort views this tab persists to
// IndexedDB, not how many cards one view can hold — a deep scroll on a
// single view is still one record. Raise if users routinely juggle more
// than this many different filter combinations in one session.
const MAX_PERSISTED_VIEWS = 20;
const DB_NAME = "synarava-catalog-view";
const STORE = "views";

// A tab-lifetime cache: the primary restore path. Next.js `<Link>` navigation
// to a PDP and back is a client-side transition — this component unmounts
// and remounts, but the JS module (and this Map) survives, so a same-tab
// Back restores instantly with zero network requests.
const memoryCache = new Map<string, CatalogViewSnapshot>();

function isFresh(snapshot: CatalogViewSnapshot): boolean {
  return Date.now() - snapshot.savedAt < TTL_MS
    && Array.isArray(snapshot.nodes)
    && snapshot.nodes.every((node) => typeof node?.id === "string");
}

/** Test-only: the module-level cache otherwise outlives every component mount for the tab's lifetime, by design. */
export function clearCatalogViewCacheForTests(): void {
  memoryCache.clear();
}

export function getMemoryView(viewKey: string): CatalogViewSnapshot | null {
  const snapshot = memoryCache.get(viewKey);
  if (!snapshot) return null;
  if (!isFresh(snapshot)) {
    memoryCache.delete(viewKey);
    return null;
  }
  return snapshot;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: "viewKey" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

/** Same-tab reload/remount fallback, once the in-memory cache has already missed. Never rejects — a corrupt or unavailable store just means "nothing to restore". */
export async function getPersistedView(viewKey: string): Promise<CatalogViewSnapshot | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(viewKey);
    request.onsuccess = () => {
      const snapshot = request.result as CatalogViewSnapshot | undefined;
      if (snapshot && isFresh(snapshot)) {
        memoryCache.set(viewKey, snapshot);
        resolve(snapshot);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => resolve(null);
  });
}

async function pruneOldViews(db: IDBDatabase): Promise<void> {
  const store = db.transaction(STORE, "readwrite").objectStore(STORE);
  const all = await new Promise<CatalogViewSnapshot[]>((resolve) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as CatalogViewSnapshot[]);
    request.onerror = () => resolve([]);
  });
  const stale = all.filter((view) => !isFresh(view));
  const fresh = all.filter(isFresh).sort((a, b) => b.savedAt - a.savedAt);
  const overflow = fresh.slice(MAX_PERSISTED_VIEWS);
  for (const view of [...stale, ...overflow]) store.delete(view.viewKey);
}

/** Fire-and-forget: updates the memory cache synchronously, writes through to IndexedDB in the background. */
export function saveView(snapshot: CatalogViewSnapshot): void {
  memoryCache.set(snapshot.viewKey, snapshot);
  openDb().then((db) => {
    if (!db) return;
    db.transaction(STORE, "readwrite").objectStore(STORE).put(snapshot);
    pruneOldViews(db).catch(() => {});
  }).catch(() => {});
}
