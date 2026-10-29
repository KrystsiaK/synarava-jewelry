import type { ShopListingProduct } from "@/lib/content/shop-listing";

export type CatalogViewAnchor = { productId: string; offsetPx: number };

/**
 * Schema v2: every snapshot is self-describing — fingerprint of its nodes,
 * schema version, and savedAt. v1 rows (no fingerprint / schemaVersion) are
 * rejected on read; IndexedDB upgrade also drops the old object store.
 */
export const CATALOG_VIEW_SCHEMA_VERSION = 2;

export type CatalogViewSnapshot = {
  viewKey: string;
  /** Ownership: fingerprint of the filter/sort that produced `nodes`. */
  fingerprint: string;
  schemaVersion: number;
  savedAt: number;
  nodes: ShopListingProduct[];
  endCursor: string | null;
  hasNextPage: boolean;
  totalCount: number;
  anchor: CatalogViewAnchor | null;
};

const TTL_MS = 30 * 60 * 1000;
// Bounds how many distinct filter/sort views this tab persists to IndexedDB,
// not how many cards one view can hold — a deep scroll on a single view is
// still one record.
const MAX_PERSISTED_VIEWS = 20;
const DB_NAME = "synarava-catalog-view";
const DB_VERSION = 2;
const STORE = "views";

// Tab-lifetime cache: primary restore path. Next.js `<Link>` to a PDP and back
// unmounts/remounts the catalog, but this module Map survives.
const memoryCache = new Map<string, CatalogViewSnapshot>();

export function buildCatalogViewKey(locale: string, fingerprint: string): string {
  return `${locale}|${fingerprint}`;
}

/** Filter fingerprint embedded in `locale|fingerprint` view keys. */
export function fingerprintFromViewKey(viewKey: string): string {
  const sep = viewKey.indexOf("|");
  return sep === -1 ? viewKey : viewKey.slice(sep + 1);
}

function hasValidNodes(nodes: unknown): nodes is ShopListingProduct[] {
  return Array.isArray(nodes) && nodes.every((node) => typeof (node as { id?: unknown })?.id === "string");
}

function isFresh(snapshot: { savedAt: number }): boolean {
  return Date.now() - snapshot.savedAt < TTL_MS;
}

/**
 * Ownership + schema + freshness gate used by both write and read.
 * A snapshot may be stored under viewKey K only when its fingerprint owns
 * the nodes AND matches the fingerprint encoded in K.
 */
export function isOwnedCatalogView(
  snapshot: CatalogViewSnapshot,
  expectedViewKey?: string,
  expectedFingerprint?: string,
): boolean {
  if (snapshot.schemaVersion !== CATALOG_VIEW_SCHEMA_VERSION) return false;
  if (!isFresh(snapshot)) return false;
  if (!hasValidNodes(snapshot.nodes) || snapshot.nodes.length === 0) return false;
  if (typeof snapshot.viewKey !== "string" || typeof snapshot.fingerprint !== "string") return false;
  if (snapshot.fingerprint !== fingerprintFromViewKey(snapshot.viewKey)) return false;
  if (expectedViewKey !== undefined && snapshot.viewKey !== expectedViewKey) return false;
  if (expectedFingerprint !== undefined && snapshot.fingerprint !== expectedFingerprint) return false;
  return true;
}

/** Test-only: the module-level cache otherwise outlives every component mount. */
export function clearCatalogViewCacheForTests(): void {
  memoryCache.clear();
}

export function getMemoryView(
  viewKey: string,
  fingerprint: string,
): CatalogViewSnapshot | null {
  const snapshot = memoryCache.get(viewKey);
  if (!snapshot) return null;
  // Drop intrinsically invalid rows (schema / TTL / self-ownership).
  if (!isOwnedCatalogView(snapshot, viewKey)) {
    memoryCache.delete(viewKey);
    return null;
  }
  // Caller expected a different fingerprint — miss without destroying the row.
  if (snapshot.fingerprint !== fingerprint) return null;
  return snapshot;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      // Drop any prior store so v1 (unowned) rows cannot be read back.
      if (db.objectStoreNames.contains(STORE)) {
        db.deleteObjectStore(STORE);
      }
      db.createObjectStore(STORE, { keyPath: "viewKey" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

/** Same-tab reload fallback after a memory miss. Never rejects. */
export async function getPersistedView(
  viewKey: string,
  fingerprint: string,
): Promise<CatalogViewSnapshot | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(viewKey);
    request.onsuccess = () => {
      const snapshot = request.result as CatalogViewSnapshot | undefined;
      if (snapshot && isOwnedCatalogView(snapshot, viewKey, fingerprint)) {
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
  // Read and write must not share one IDB transaction across an await —
  // the tx autocommits once getAll's onsuccess returns with no pending ops.
  const all = await new Promise<CatalogViewSnapshot[]>((resolve) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as CatalogViewSnapshot[]);
    request.onerror = () => resolve([]);
  });
  const stale = all.filter((view) => !isOwnedCatalogView(view));
  const fresh = all
    .filter((view) => isOwnedCatalogView(view))
    .sort((a, b) => b.savedAt - a.savedAt);
  const overflow = fresh.slice(MAX_PERSISTED_VIEWS);
  const toDelete = [...stale, ...overflow];
  if (toDelete.length === 0) return;
  const store = db.transaction(STORE, "readwrite").objectStore(STORE);
  for (const view of toDelete) store.delete(view.viewKey);
}

/**
 * Single write entry point. Returns false (and does not store) when the
 * snapshot fails the ownership / schema / node invariant — callers must not
 * bypass this gate.
 */
export function saveView(snapshot: CatalogViewSnapshot): boolean {
  if (!isOwnedCatalogView(snapshot)) return false;
  memoryCache.set(snapshot.viewKey, snapshot);
  openDb().then((db) => {
    if (!db) return;
    db.transaction(STORE, "readwrite").objectStore(STORE).put(snapshot);
    pruneOldViews(db).catch(() => {});
  }).catch(() => {});
  return true;
}
