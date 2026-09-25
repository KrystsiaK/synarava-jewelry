/**
 * Survives a hard reload after Admin version skew: PageEditor snapshots the
 * in-progress locale draft before "Reload latest version", then rehydrates
 * once so a long FAQ/legal fill is not lost.
 */

export type PageEditorDraftSnapshot = {
  version: 1;
  pageId: string;
  draftByLocale: Record<string, unknown>;
  handleByLocale: Record<string, string>;
  editProductIds: string[];
  finalCtaProductIds: string[];
  archiveCollectionIds: string[];
  contactEnabled: boolean;
  savedAt: number;
};

const STORAGE_PREFIX = "adm-page-draft:";
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

function storageKey(pageId: string) {
  return `${STORAGE_PREFIX}${pageId}`;
}

export function writePageEditorDraftSnapshot(
  pageId: string,
  snapshot: Omit<PageEditorDraftSnapshot, "version" | "pageId" | "savedAt">,
): boolean {
  try {
    const payload: PageEditorDraftSnapshot = {
      version: 1,
      pageId,
      savedAt: Date.now(),
      ...snapshot,
    };
    sessionStorage.setItem(storageKey(pageId), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/** Read and clear a still-fresh snapshot for this page, or null. */
export function takePageEditorDraftSnapshot(pageId: string): PageEditorDraftSnapshot | null {
  try {
    const raw = sessionStorage.getItem(storageKey(pageId));
    if (!raw) return null;
    sessionStorage.removeItem(storageKey(pageId));
    const parsed = JSON.parse(raw) as PageEditorDraftSnapshot;
    if (parsed?.version !== 1 || parsed.pageId !== pageId) return null;
    if (typeof parsed.savedAt !== "number" || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      return null;
    }
    if (!parsed.draftByLocale || typeof parsed.draftByLocale !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPageEditorDraftSnapshot(pageId: string) {
  try {
    sessionStorage.removeItem(storageKey(pageId));
  } catch {
    // private browsing / disabled storage
  }
}
