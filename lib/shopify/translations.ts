import "server-only";

import { shopifyAdminRequest, ShopifyAdminError } from "@/lib/shopify/admin";
import { SHOPIFY_PORTUGUESE_ADMIN_LOCALE } from "@/lib/shopify/locales";

export type TranslatableContent = { key: string; digest: string };
type TranslationUserError = { field?: string[] | null; message: string };
export type RemoteTranslation = { key: string; value: string; updatedAt: string; outdated: boolean };

// Shopify's TranslatableResourceType enum has ~30 members; kept as a plain
// string here rather than re-declaring the whole enum, since callers only
// ever pass one they already know is valid (Shopify errors otherwise).
export type TranslatableResourceType = string;

export type ShopifyProductTranslationCopy = {
  handle?: string;
  title: string;
  descriptionHtml: string;
  seoTitle: string;
  seoDescription: string;
};

export type ShopifyProductTranslationSnapshot = ShopifyProductTranslationCopy & {
  updatedAt: string | null;
  outdated: boolean;
};

type ProductTranslationPullDecision = "APPLY_REMOTE" | "KEEP_LOCAL" | "CONFLICT" | "UNCHANGED";

function normalizedCopy(copy: ShopifyProductTranslationCopy | null) {
  if (!copy) return null;
  return {
    title: copy.title.trim(),
    handle: copy.handle?.trim() ?? "",
    descriptionHtml: copy.descriptionHtml
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim(),
    seoTitle: copy.seoTitle.trim(),
    seoDescription: copy.seoDescription.trim(),
  };
}

export function decideProductTranslationPull({
  local,
  localSyncStatus,
  localLastSyncedAt,
  remote,
  force = false,
}: {
  local: ShopifyProductTranslationCopy | null;
  localSyncStatus: "NOT_APPLICABLE" | "PENDING" | "SYNCED" | "FAILED" | "CONFLICT";
  localLastSyncedAt: Date | null;
  remote: ShopifyProductTranslationSnapshot | null;
  force?: boolean;
}): ProductTranslationPullDecision {
  if (force) return "APPLY_REMOTE";
  if (!local && !remote) return "UNCHANGED";
  if (JSON.stringify(normalizedCopy(local)) === JSON.stringify(normalizedCopy(remote))) {
    return "UNCHANGED";
  }

  const localIsDirty = ["PENDING", "FAILED", "CONFLICT"].includes(localSyncStatus);
  if (!localIsDirty) return "APPLY_REMOTE";

  const remoteChangedSinceLastSync = remote
    ? !localLastSyncedAt
      || !remote.updatedAt
      || new Date(remote.updatedAt).getTime() > localLastSyncedAt.getTime()
    : Boolean(localLastSyncedAt);
  return remoteChangedSinceLastSync ? "CONFLICT" : "KEEP_LOCAL";
}

function productTranslationSnapshot(translations: RemoteTranslation[]): ShopifyProductTranslationSnapshot | null {
  const values = new Map(translations.map((translation) => [translation.key, translation.value]));
  if (values.size === 0) return null;
  const updatedAt = translations.reduce<string | null>((latest, translation) => {
    if (!latest || new Date(translation.updatedAt).getTime() > new Date(latest).getTime()) {
      return new Date(translation.updatedAt).toISOString();
    }
    return latest;
  }, null);
  return {
    title: values.get("title") ?? "",
    handle: values.get("handle") ?? "",
    descriptionHtml: values.get("body_html") ?? "",
    seoTitle: values.get("meta_title") ?? "",
    seoDescription: values.get("meta_description") ?? "",
    updatedAt,
    outdated: translations.some((translation) => translation.outdated),
  };
}

const PRODUCT_TRANSLATION_KEYS = {
  handle: "handle",
  title: "title",
  descriptionHtml: "body_html",
  seoTitle: "meta_title",
  seoDescription: "meta_description",
} as const;

/** Joins field values to the Shopify content digest each needs to be registered against; drops fields with no value or no matching translatable content. */
export function buildTranslationInputs({
  locale,
  values,
  translatableContent,
}: {
  locale: string;
  values: Partial<Record<string, string>>;
  translatableContent: TranslatableContent[];
}) {
  const digests = new Map(translatableContent.map((content) => [content.key, content.digest]));
  return Object.entries(values).flatMap(([key, rawValue]) => {
    const value = rawValue?.trim();
    const digest = digests.get(key);
    return value && digest
      ? [{ locale, key, value, translatableContentDigest: digest }]
      : [];
  });
}

export async function fetchTranslatableContent(resourceId: string): Promise<TranslatableContent[]> {
  const data = await shopifyAdminRequest<{
    translatableResource: { translatableContent: TranslatableContent[] } | null;
  }>(`query SynaravaTranslatableContent($resourceId: ID!) {
    translatableResource(resourceId: $resourceId) {
      translatableContent { key digest }
    }
  }`, { resourceId });

  if (!data.translatableResource) {
    throw new ShopifyAdminError("Shopify did not expose this resource as translatable.");
  }
  return data.translatableResource.translatableContent;
}

function isDigestError(errors: TranslationUserError[]) {
  return errors.some((error) => /digest|outdated|stale/i.test(error.message));
}

export async function removeTranslationKeys(resourceId: string, locale: string, translationKeys: string[]) {
  if (translationKeys.length === 0) return;

  const data = await shopifyAdminRequest<{
    translationsRemove: {
      userErrors: TranslationUserError[];
    };
  }>(`mutation SynaravaRemoveTranslations(
    $resourceId: ID!
    $translationKeys: [String!]!
    $locales: [String!]!
  ) {
    translationsRemove(
      resourceId: $resourceId
      translationKeys: $translationKeys
      locales: $locales
    ) {
      userErrors { field message }
    }
  }`, { resourceId, locales: [locale], translationKeys });

  const errors = data.translationsRemove.userErrors;
  if (errors.length > 0) {
    throw new ShopifyAdminError(errors.map((error) => error.message).join("; "));
  }
}

/**
 * Registers non-blank values against `resourceId` for `locale` and clears
 * (via translationsRemove) any key whose value is blank. Fetches a fresh
 * digest right before writing and retries once — only once — on a
 * stale-digest userError; any other error, or a second stale digest, throws
 * rather than force-writing. This is the primitive Task 7's reconcile
 * engine and every non-Product resource adapter (Collection, Page,
 * metaobjects) builds on.
 */
export async function registerTranslations({
  resourceId,
  locale,
  values,
}: {
  resourceId: string;
  locale: string;
  values: Partial<Record<string, string>>;
}) {
  const clearedKeys = Object.entries(values)
    .filter(([, value]) => !value?.trim())
    .map(([key]) => key);

  await removeTranslationKeys(resourceId, locale, clearedKeys);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const translatableContent = await fetchTranslatableContent(resourceId);
    const translations = buildTranslationInputs({ locale, values, translatableContent });
    if (translations.length === 0) return { registeredKeys: [] as string[] };

    const data = await shopifyAdminRequest<{
      translationsRegister: {
        userErrors: TranslationUserError[];
        translations: Array<{ key: string; value: string }>;
      };
    }>(`mutation SynaravaRegisterTranslations($resourceId: ID!, $translations: [TranslationInput!]!) {
      translationsRegister(resourceId: $resourceId, translations: $translations) {
        translations { key value }
        userErrors { field message }
      }
    }`, { resourceId, translations });

    const errors = data.translationsRegister.userErrors;
    if (errors.length === 0) {
      return { registeredKeys: data.translationsRegister.translations.map((translation) => translation.key) };
    }
    if (attempt === 0 && isDigestError(errors)) continue;
    throw new ShopifyAdminError(errors.map((error) => error.message).join("; "));
  }

  throw new ShopifyAdminError("Shopify translation registration failed after refreshing content digests.");
}

export async function fetchResourceTranslation(resourceId: string, locale: string): Promise<RemoteTranslation[] | null> {
  const data = await shopifyAdminRequest<{
    translatableResource: {
      translations: RemoteTranslation[];
    } | null;
  }>(`query SynaravaResourceTranslation($resourceId: ID!) {
    translatableResource(resourceId: $resourceId) {
      translations(locale: "${locale}") { key value updatedAt outdated }
    }
  }`, { resourceId });

  return data.translatableResource ? data.translatableResource.translations : null;
}

/** Paginates every resource of `resourceType` and its current translations for `locale`. Used for reconcile sweeps that must cover more than one already-known resource id. */
export async function fetchTranslatableResourceIndex(resourceType: TranslatableResourceType, locale: string) {
  const result = new Map<string, RemoteTranslation[]>();
  let cursor: string | null = null;
  do {
    const data: {
      translatableResources: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: Array<{ resourceId: string; translations: RemoteTranslation[] }>;
      };
    } = await shopifyAdminRequest(`query SynaravaTranslatableResourceIndex($after: String, $resourceType: TranslatableResourceType!) {
      translatableResources(first: 100, after: $after, resourceType: $resourceType) {
        pageInfo { hasNextPage endCursor }
        nodes {
          resourceId
          translations(locale: "${locale}") { key value updatedAt outdated }
        }
      }
    }`, { after: cursor, resourceType });
    for (const resource of data.translatableResources.nodes) {
      result.set(resource.resourceId, resource.translations);
    }
    cursor = data.translatableResources.pageInfo.hasNextPage
      ? data.translatableResources.pageInfo.endCursor
      : null;
  } while (cursor);
  return result;
}

export async function registerProductTranslation(
  resourceId: string,
  copy: ShopifyProductTranslationCopy,
) {
  const values = Object.fromEntries(
    Object.entries(PRODUCT_TRANSLATION_KEYS).map(([localKey, shopifyKey]) => [
      shopifyKey,
      copy[localKey as keyof ShopifyProductTranslationCopy],
    ]),
  );
  return registerTranslations({ resourceId, locale: SHOPIFY_PORTUGUESE_ADMIN_LOCALE, values });
}

export async function fetchProductTranslation(resourceId: string) {
  const translations = await fetchResourceTranslation(resourceId, SHOPIFY_PORTUGUESE_ADMIN_LOCALE);
  return translations ? productTranslationSnapshot(translations) : null;
}

export async function fetchProductTranslationIndex() {
  const raw = await fetchTranslatableResourceIndex("PRODUCT", SHOPIFY_PORTUGUESE_ADMIN_LOCALE);
  const result = new Map<string, ShopifyProductTranslationSnapshot | null>();
  for (const [resourceId, translations] of raw) {
    result.set(resourceId, productTranslationSnapshot(translations));
  }
  return result;
}
