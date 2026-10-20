import "server-only";

import { createHash } from "node:crypto";

import { db } from "@/lib/db";

export const LANGUAGE_BUNDLE_SCHEMA_VERSION = 1;

export type LanguageBundlePayload = {
  schemaVersion: number;
  locale: string;
  exportedAt: string;
  registry: {
    code: string;
    routeSegment: string;
    shopifyLocale: string;
    intlLocale: string;
    name: string;
    nativeName: string;
    isDefault: boolean;
    status: string;
    sortOrder: number;
  } | null;
  productTranslations: unknown[];
  collectionTranslations: unknown[];
  pageTranslations: unknown[];
  handleRedirects: unknown[];
  translationSnapshots: unknown[];
  translationCache: unknown | null;
  shopifyTranslations: unknown[];
};

export type LanguageBundle = LanguageBundlePayload & { checksum: string };

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

export function computeLanguageBundleChecksum(payload: LanguageBundlePayload): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export function attachLanguageBundleChecksum(payload: LanguageBundlePayload): LanguageBundle {
  return { ...payload, checksum: computeLanguageBundleChecksum(payload) };
}

export function verifyLanguageBundle(bundle: LanguageBundle): { ok: true } | { ok: false; error: string } {
  if (bundle.schemaVersion !== LANGUAGE_BUNDLE_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Unsupported bundle schema version ${bundle.schemaVersion}; expected ${LANGUAGE_BUNDLE_SCHEMA_VERSION}.`,
    };
  }
  if (!bundle.locale?.trim()) return { ok: false, error: "Bundle is missing a locale code." };
  const { checksum, ...payload } = bundle;
  const expected = computeLanguageBundleChecksum(payload);
  if (checksum !== expected) {
    return { ok: false, error: "Bundle checksum mismatch — file may be corrupted or altered." };
  }
  return { ok: true };
}

function stripIds<T extends Record<string, unknown>>(row: T, keys: string[]): Record<string, unknown> {
  const next: Record<string, unknown> = { ...row };
  for (const key of keys) delete next[key];
  return next;
}

export async function exportLanguageBundle(locale: string): Promise<LanguageBundle> {
  const code = locale.trim().toLowerCase();
  const [
    registry,
    productTranslations,
    collectionTranslations,
    pageTranslations,
    handleRedirects,
    translationSnapshots,
    translationCache,
  ] = await Promise.all([
    db.storefrontLocale.findUnique({ where: { code } }),
    db.productTranslation.findMany({ where: { locale: code } }),
    db.collectionTranslation.findMany({ where: { locale: code } }),
    db.pageTranslation.findMany({ where: { locale: code } }),
    db.localizedHandleRedirect.findMany({ where: { locale: code } }),
    db.shopifyTranslationSnapshot.findMany({ where: { locale: code } }),
    db.translationCache.findUnique({ where: { locale: code } }),
  ]);

  const shopifyTranslations = translationSnapshots.map((snapshot) => ({
    bindingId: snapshot.bindingId,
    locale: snapshot.locale,
    values: snapshot.values,
    syncedAt: snapshot.syncedAt.toISOString(),
  }));

  const payload: LanguageBundlePayload = {
    schemaVersion: LANGUAGE_BUNDLE_SCHEMA_VERSION,
    locale: code,
    exportedAt: new Date().toISOString(),
    registry: registry
      ? {
          code: registry.code,
          routeSegment: registry.routeSegment,
          shopifyLocale: registry.shopifyLocale,
          intlLocale: registry.intlLocale,
          name: registry.name,
          nativeName: registry.nativeName,
          isDefault: registry.isDefault,
          status: registry.status,
          sortOrder: registry.sortOrder,
        }
      : null,
    productTranslations: productTranslations.map((row) =>
      stripIds(row as unknown as Record<string, unknown>, ["id", "createdAt", "updatedAt"]),
    ),
    collectionTranslations: collectionTranslations.map((row) =>
      stripIds(row as unknown as Record<string, unknown>, ["id", "createdAt", "updatedAt"]),
    ),
    pageTranslations: pageTranslations.map((row) =>
      stripIds(row as unknown as Record<string, unknown>, ["id", "createdAt", "updatedAt"]),
    ),
    handleRedirects: handleRedirects.map((row) =>
      stripIds(row as unknown as Record<string, unknown>, ["id", "createdAt", "updatedAt"]),
    ),
    translationSnapshots: translationSnapshots.map((row) =>
      stripIds(row as unknown as Record<string, unknown>, ["id", "createdAt", "updatedAt"]),
    ),
    translationCache: translationCache
      ? stripIds(translationCache as unknown as Record<string, unknown>, ["createdAt", "updatedAt"])
      : null,
    shopifyTranslations,
  };

  return attachLanguageBundleChecksum(payload);
}

export type ImportLanguageBundleResult = {
  locale: string;
  products: number;
  collections: number;
  pages: number;
  redirects: number;
  snapshots: number;
};

/**
 * Idempotent upsert of a verified bundle. Refuses a bundle whose locale does
 * not match `expectedLocale` when provided.
 */
export async function importLanguageBundle(
  bundle: LanguageBundle,
  expectedLocale?: string,
): Promise<ImportLanguageBundleResult> {
  const verified = verifyLanguageBundle(bundle);
  if (!verified.ok) throw new Error(verified.error);

  const locale = bundle.locale.trim().toLowerCase();
  if (expectedLocale && expectedLocale.trim().toLowerCase() !== locale) {
    throw new Error(`Bundle locale "${locale}" does not match expected "${expectedLocale}".`);
  }

  let products = 0;
  for (const raw of bundle.productTranslations) {
    const row = raw as {
      productId: string;
      title: string;
      localizedHandle?: string | null;
      shortDescription?: string | null;
      description?: string | null;
      materialLine?: string | null;
      symbolismLabel?: string | null;
      symbolismTitle?: string | null;
      symbolismBody?: string | null;
      symbolismBody2?: string | null;
      details?: unknown;
      seoTitle?: string | null;
      seoDescription?: string | null;
      reviewStatus?: "DRAFT" | "REVIEWED";
      reviewedAt?: string | null;
      syncStatus?: "NOT_APPLICABLE" | "PENDING" | "SYNCED" | "ERROR";
      syncError?: string | null;
      contentHash?: string | null;
      lastSyncedAt?: string | null;
    };
    if (!row.productId) continue;
    await db.productTranslation.upsert({
      where: { productId_locale: { productId: row.productId, locale } },
      create: {
        productId: row.productId,
        locale,
        title: row.title ?? "",
        localizedHandle: row.localizedHandle ?? null,
        shortDescription: row.shortDescription ?? null,
        description: row.description ?? null,
        materialLine: row.materialLine ?? null,
        symbolismLabel: row.symbolismLabel ?? null,
        symbolismTitle: row.symbolismTitle ?? null,
        symbolismBody: row.symbolismBody ?? null,
        symbolismBody2: row.symbolismBody2 ?? null,
        details: row.details as object | undefined,
        seoTitle: row.seoTitle ?? null,
        seoDescription: row.seoDescription ?? null,
        reviewStatus: row.reviewStatus ?? "DRAFT",
        reviewedAt: row.reviewedAt ? new Date(row.reviewedAt) : null,
        syncStatus: row.syncStatus ?? "NOT_APPLICABLE",
        syncError: row.syncError ?? null,
        contentHash: row.contentHash ?? null,
        lastSyncedAt: row.lastSyncedAt ? new Date(row.lastSyncedAt) : null,
      },
      update: {
        title: row.title ?? "",
        localizedHandle: row.localizedHandle ?? null,
        shortDescription: row.shortDescription ?? null,
        description: row.description ?? null,
        materialLine: row.materialLine ?? null,
        symbolismLabel: row.symbolismLabel ?? null,
        symbolismTitle: row.symbolismTitle ?? null,
        symbolismBody: row.symbolismBody ?? null,
        symbolismBody2: row.symbolismBody2 ?? null,
        details: row.details as object | undefined,
        seoTitle: row.seoTitle ?? null,
        seoDescription: row.seoDescription ?? null,
        reviewStatus: row.reviewStatus ?? "DRAFT",
        reviewedAt: row.reviewedAt ? new Date(row.reviewedAt) : null,
        syncStatus: row.syncStatus ?? "NOT_APPLICABLE",
        syncError: row.syncError ?? null,
        contentHash: row.contentHash ?? null,
        lastSyncedAt: row.lastSyncedAt ? new Date(row.lastSyncedAt) : null,
      },
    });
    products += 1;
  }

  let collections = 0;
  for (const raw of bundle.collectionTranslations) {
    const row = raw as {
      collectionId: string;
      name: string;
      localizedHandle?: string | null;
      subtitle?: string | null;
      description?: string | null;
      manifesto?: string | null;
      storyTitle?: string | null;
      storyBody?: string | null;
      symbolismLabel?: string | null;
      symbolismTitle?: string | null;
      symbolismBody?: string | null;
      symbolismBody2?: string | null;
      searchSummary?: string | null;
      ctaLabel?: string | null;
      heroImageAlt?: string | null;
      seoTitle?: string | null;
      seoDescription?: string | null;
      reviewStatus?: "DRAFT" | "REVIEWED";
      reviewedAt?: string | null;
      syncStatus?: "NOT_APPLICABLE" | "PENDING" | "SYNCED" | "ERROR";
      syncError?: string | null;
      contentHash?: string | null;
      lastSyncedAt?: string | null;
    };
    if (!row.collectionId) continue;
    await db.collectionTranslation.upsert({
      where: { collectionId_locale: { collectionId: row.collectionId, locale } },
      create: {
        collectionId: row.collectionId,
        locale,
        name: row.name ?? "",
        localizedHandle: row.localizedHandle ?? null,
        subtitle: row.subtitle ?? null,
        description: row.description ?? null,
        manifesto: row.manifesto ?? null,
        storyTitle: row.storyTitle ?? null,
        storyBody: row.storyBody ?? null,
        symbolismLabel: row.symbolismLabel ?? null,
        symbolismTitle: row.symbolismTitle ?? null,
        symbolismBody: row.symbolismBody ?? null,
        symbolismBody2: row.symbolismBody2 ?? null,
        searchSummary: row.searchSummary ?? null,
        ctaLabel: row.ctaLabel ?? null,
        heroImageAlt: row.heroImageAlt ?? null,
        seoTitle: row.seoTitle ?? null,
        seoDescription: row.seoDescription ?? null,
        reviewStatus: row.reviewStatus ?? "DRAFT",
        reviewedAt: row.reviewedAt ? new Date(row.reviewedAt) : null,
        syncStatus: row.syncStatus ?? "NOT_APPLICABLE",
        syncError: row.syncError ?? null,
        contentHash: row.contentHash ?? null,
        lastSyncedAt: row.lastSyncedAt ? new Date(row.lastSyncedAt) : null,
      },
      update: {
        name: row.name ?? "",
        localizedHandle: row.localizedHandle ?? null,
        subtitle: row.subtitle ?? null,
        description: row.description ?? null,
        manifesto: row.manifesto ?? null,
        storyTitle: row.storyTitle ?? null,
        storyBody: row.storyBody ?? null,
        symbolismLabel: row.symbolismLabel ?? null,
        symbolismTitle: row.symbolismTitle ?? null,
        symbolismBody: row.symbolismBody ?? null,
        symbolismBody2: row.symbolismBody2 ?? null,
        searchSummary: row.searchSummary ?? null,
        ctaLabel: row.ctaLabel ?? null,
        heroImageAlt: row.heroImageAlt ?? null,
        seoTitle: row.seoTitle ?? null,
        seoDescription: row.seoDescription ?? null,
        reviewStatus: row.reviewStatus ?? "DRAFT",
        reviewedAt: row.reviewedAt ? new Date(row.reviewedAt) : null,
        syncStatus: row.syncStatus ?? "NOT_APPLICABLE",
        syncError: row.syncError ?? null,
        contentHash: row.contentHash ?? null,
        lastSyncedAt: row.lastSyncedAt ? new Date(row.lastSyncedAt) : null,
      },
    });
    collections += 1;
  }

  let pages = 0;
  for (const raw of bundle.pageTranslations) {
    const row = raw as {
      pageId: string;
      title: string;
      localizedHandle?: string | null;
      excerpt?: string | null;
      content?: unknown;
      seoTitle?: string | null;
      seoDescription?: string | null;
      reviewStatus?: "DRAFT" | "REVIEWED";
      reviewedAt?: string | null;
      syncStatus?: "NOT_APPLICABLE" | "PENDING" | "SYNCED" | "ERROR";
      syncError?: string | null;
      contentHash?: string | null;
      lastSyncedAt?: string | null;
    };
    if (!row.pageId) continue;
    await db.pageTranslation.upsert({
      where: { pageId_locale: { pageId: row.pageId, locale } },
      create: {
        pageId: row.pageId,
        locale,
        title: row.title ?? "",
        localizedHandle: row.localizedHandle ?? null,
        excerpt: row.excerpt ?? null,
        content: row.content as object | undefined,
        seoTitle: row.seoTitle ?? null,
        seoDescription: row.seoDescription ?? null,
        reviewStatus: row.reviewStatus ?? "DRAFT",
        reviewedAt: row.reviewedAt ? new Date(row.reviewedAt) : null,
        syncStatus: row.syncStatus ?? "NOT_APPLICABLE",
        syncError: row.syncError ?? null,
        contentHash: row.contentHash ?? null,
        lastSyncedAt: row.lastSyncedAt ? new Date(row.lastSyncedAt) : null,
      },
      update: {
        title: row.title ?? "",
        localizedHandle: row.localizedHandle ?? null,
        excerpt: row.excerpt ?? null,
        content: row.content as object | undefined,
        seoTitle: row.seoTitle ?? null,
        seoDescription: row.seoDescription ?? null,
        reviewStatus: row.reviewStatus ?? "DRAFT",
        reviewedAt: row.reviewedAt ? new Date(row.reviewedAt) : null,
        syncStatus: row.syncStatus ?? "NOT_APPLICABLE",
        syncError: row.syncError ?? null,
        contentHash: row.contentHash ?? null,
        lastSyncedAt: row.lastSyncedAt ? new Date(row.lastSyncedAt) : null,
      },
    });
    pages += 1;
  }

  let redirects = 0;
  for (const raw of bundle.handleRedirects) {
    const row = raw as {
      entityType: string;
      entityId: string;
      fromHandle: string;
      toHandle: string;
    };
    if (!row.entityType || !row.fromHandle || !row.toHandle) continue;
    await db.localizedHandleRedirect.upsert({
      where: {
        entityType_locale_fromHandle: {
          entityType: row.entityType,
          locale,
          fromHandle: row.fromHandle,
        },
      },
      create: {
        entityType: row.entityType,
        entityId: row.entityId,
        locale,
        fromHandle: row.fromHandle,
        toHandle: row.toHandle,
      },
      update: {
        entityId: row.entityId,
        toHandle: row.toHandle,
      },
    });
    redirects += 1;
  }

  let snapshots = 0;
  for (const raw of bundle.translationSnapshots) {
    const row = raw as { bindingId: string; values: unknown; syncedAt?: string };
    if (!row.bindingId) continue;
    await db.shopifyTranslationSnapshot.upsert({
      where: { bindingId_locale: { bindingId: row.bindingId, locale } },
      create: {
        bindingId: row.bindingId,
        locale,
        values: row.values as object,
        syncedAt: row.syncedAt ? new Date(row.syncedAt) : new Date(),
      },
      update: {
        values: row.values as object,
        syncedAt: row.syncedAt ? new Date(row.syncedAt) : new Date(),
      },
    });
    snapshots += 1;
  }

  if (bundle.translationCache && typeof bundle.translationCache === "object") {
    const cache = bundle.translationCache as { messages?: unknown };
    await db.translationCache.upsert({
      where: { locale },
      create: { locale, messages: (cache.messages ?? {}) as object },
      update: { messages: (cache.messages ?? {}) as object },
    });
  }

  if (bundle.registry && !bundle.registry.isDefault) {
    const reg = bundle.registry;
    await db.storefrontLocale.upsert({
      where: { code: locale },
      create: {
        code: locale,
        routeSegment: reg.routeSegment,
        shopifyLocale: reg.shopifyLocale,
        intlLocale: reg.intlLocale,
        name: reg.name,
        nativeName: reg.nativeName,
        isDefault: false,
        status: reg.status === "PUBLISHED" || reg.status === "RETIRED" ? reg.status : "DRAFT",
        isPublished: reg.status === "PUBLISHED",
        sortOrder: reg.sortOrder,
      },
      update: {
        routeSegment: reg.routeSegment,
        shopifyLocale: reg.shopifyLocale,
        intlLocale: reg.intlLocale,
        name: reg.name,
        nativeName: reg.nativeName,
        sortOrder: reg.sortOrder,
      },
    });
  }

  return { locale, products, collections, pages, redirects, snapshots };
}
