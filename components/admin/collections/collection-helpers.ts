import type { AdminCollection, CollectionDraft, CollectionLocaleDraft, CollectionRowAction } from "@/components/admin/collections/collection-types";

function emptyCollectionLocaleDraft(): CollectionLocaleDraft {
  return {
    localizedHandle: "", name: "", subtitle: "", description: "", manifesto: "", searchSummary: "",
    symbolismLabel: "", symbolismTitle: "", symbolismBody: "", symbolismBody2: "",
    reviewed: false, syncStatus: "NOT_APPLICABLE", syncError: "",
  };
}

/** `translationLocales` is every non-source (non-English) locale to render a tab for. */
export function emptyCollectionDraft(translationLocales: string[] = ["pt"]): CollectionDraft {
  return {
    name: "", subtitle: "", slug: "", code: "", description: "",
    manifesto: "", searchSummary: "", symbolismLabel: "", symbolismTitle: "",
    symbolismBody: "", symbolismBody2: "", workflowState: "DRAFT",
    translations: Object.fromEntries(translationLocales.map((locale) => [locale, emptyCollectionLocaleDraft()])),
  };
}

export function generateCollectionCode(value: string) {
  const normalized = value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  const joined = words.join("");

  let prefix = "";
  if (words.length >= 2) {
    prefix = `${words[0]?.slice(0, 2) ?? ""}${words[1]?.slice(0, 2) ?? ""}`;
  } else {
    prefix = joined.slice(0, 4);
  }

  const safePrefix = `${prefix}${joined}`.slice(0, 4).padEnd(3, "X");
  const checksum =
    Array.from(joined).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 100;

  return `${safePrefix}-${String(checksum).padStart(2, "0")}`;
}

export function normalizeCollections(items: AdminCollection[]) {
  return [...items].sort((left, right) => {
    const orderDiff = (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return left.name.localeCompare(right.name);
  });
}

export function workflowStateFromCollection(
  collection: AdminCollection,
): CollectionDraft["workflowState"] {
  return collection.status === "ACTIVE" && collection.visibility === "PUBLIC"
    ? "PUBLISHED"
    : "DRAFT";
}

export function collectionStatusLabel(collection: AdminCollection) {
  if (collection.status === "ARCHIVED") return "ARCHIVED";
  return collection.status === "ACTIVE" && collection.visibility === "PUBLIC" ? "PUBLISHED" : "DRAFT";
}

export function collectionActionCopy(target: CollectionRowAction) {
  if (target.action === "publish") {
    return {
      title: `Publish ${target.collection.name}`,
      description:
        "This makes the collection visible on the collections index and its detail page. Products assigned to it may become reachable through collection filters.",
      confirmLabel: "Publish collection",
      tone: "default" as const,
    };
  }
  if (target.action === "draft") {
    return {
      title: `Move ${target.collection.name} to draft`,
      description:
        "This hides the collection page and removes it from public collection lists. Every ACTIVE or UNLISTED product in this collection also moves to Draft locally (Shopify commerce status is not pushed).",
      confirmLabel: "Move to draft",
      tone: "default" as const,
    };
  }
  if (target.action === "archive") {
    return {
      title: `Archive ${target.collection.name}`,
      description:
        "This hides the collection and keeps the record available in admin. Products remain in the catalog, but this collection will no longer appear publicly.",
      confirmLabel: "Archive collection",
      tone: "danger" as const,
    };
  }
  return {
    title: `Permanently delete ${target.collection.name}`,
    description:
      "This permanently removes the collection and its collection sections. Products are not deleted, but their link to this collection is removed, which affects collection pages and filters. Prefer Archive unless you are certain.",
    confirmLabel: "Delete permanently",
    tone: "danger" as const,
  };
}

/** `translationLocales` is every non-source locale to render a tab for, regardless of whether a translation row exists yet. */
export function collectionToDraft(collection: AdminCollection, translationLocales: string[] = ["pt"]): CollectionDraft {
  const byLocale = new Map(collection.translations?.map((translation) => [translation.locale, translation]));
  return {
    name: collection.name,
    subtitle: collection.subtitle ?? "",
    slug: collection.slug,
    code: collection.code ?? "",
    description: collection.description ?? "",
    manifesto: collection.manifesto ?? "",
    searchSummary: collection.searchSummary ?? "",
    symbolismLabel: collection.symbolismLabel ?? "",
    symbolismTitle: collection.symbolismTitle ?? "",
    symbolismBody: collection.symbolismBody ?? "",
    symbolismBody2: collection.symbolismBody2 ?? "",
    workflowState: workflowStateFromCollection(collection),
    translations: Object.fromEntries(translationLocales.map((locale) => {
      const row = byLocale.get(locale);
      const draft: CollectionLocaleDraft = {
        localizedHandle: row?.localizedHandle ?? "",
        name: row?.name ?? "",
        subtitle: row?.subtitle ?? "",
        description: row?.description ?? "",
        manifesto: row?.manifesto ?? "",
        searchSummary: row?.searchSummary ?? "",
        symbolismLabel: row?.symbolismLabel ?? "",
        symbolismTitle: row?.symbolismTitle ?? "",
        symbolismBody: row?.symbolismBody ?? "",
        symbolismBody2: row?.symbolismBody2 ?? "",
        reviewed: row?.reviewStatus === "REVIEWED",
        syncStatus: row?.syncStatus ?? "NOT_APPLICABLE",
        syncError: row?.syncError ?? "",
      };
      return [locale, draft];
    })),
  };
}

export { fieldClass } from "@/components/admin/shared/admin-field-shell";

export function submitLabel(base: string, pending: boolean, pendingLabel: string) {
  return pending ? pendingLabel : base;
}
