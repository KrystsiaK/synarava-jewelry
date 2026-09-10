import "server-only";

import { shopifyAdminRequest, ShopifyAdminError } from "@/lib/shopify/admin";
import { SHOPIFY_PORTUGUESE_ADMIN_LOCALE } from "@/lib/shopify/locales";

type TranslatableContent = { key: string; digest: string };
type TranslationUserError = { field?: string[] | null; message: string };
type RemoteTranslation = { key: string; value: string; updatedAt: string; outdated: boolean };

export type ShopifyProductTranslationCopy = {
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
    descriptionHtml: values.get("body_html") ?? "",
    seoTitle: values.get("meta_title") ?? "",
    seoDescription: values.get("meta_description") ?? "",
    updatedAt,
    outdated: translations.some((translation) => translation.outdated),
  };
}

const PRODUCT_TRANSLATION_KEYS = {
  title: "title",
  descriptionHtml: "body_html",
  seoTitle: "meta_title",
  seoDescription: "meta_description",
} as const;

export function buildProductTranslationInputs({
  locale,
  values,
  translatableContent,
}: {
  locale: typeof SHOPIFY_PORTUGUESE_ADMIN_LOCALE;
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

async function fetchProductTranslatableContent(resourceId: string) {
  const data = await shopifyAdminRequest<{
    translatableResource: { translatableContent: TranslatableContent[] } | null;
  }>(`query SynaravaProductTranslatableContent($resourceId: ID!) {
    translatableResource(resourceId: $resourceId) {
      translatableContent { key digest }
    }
  }`, { resourceId });

  if (!data.translatableResource) {
    throw new ShopifyAdminError("Shopify did not expose this product as a translatable resource.");
  }
  return data.translatableResource.translatableContent;
}

function isDigestError(errors: TranslationUserError[]) {
  return errors.some((error) => /digest|outdated|stale/i.test(error.message));
}

async function removeProductTranslationKeys(resourceId: string, translationKeys: string[]) {
  if (translationKeys.length === 0) return;

  const locales = [SHOPIFY_PORTUGUESE_ADMIN_LOCALE];
  const data = await shopifyAdminRequest<{
    translationsRemove: {
      userErrors: TranslationUserError[];
    };
  }>(`mutation SynaravaRemoveProductTranslations(
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
  }`, { resourceId, locales, translationKeys });

  const errors = data.translationsRemove.userErrors;
  if (errors.length > 0) {
    throw new ShopifyAdminError(errors.map((error) => error.message).join("; "));
  }
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
  const clearedKeys = Object.entries(values)
    .filter(([, value]) => !value.trim())
    .map(([key]) => key);

  await removeProductTranslationKeys(resourceId, clearedKeys);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const translatableContent = await fetchProductTranslatableContent(resourceId);
    const translations = buildProductTranslationInputs({ locale: SHOPIFY_PORTUGUESE_ADMIN_LOCALE, values, translatableContent });
    if (translations.length === 0) return { registeredKeys: [] as string[] };

    const data = await shopifyAdminRequest<{
      translationsRegister: {
        userErrors: TranslationUserError[];
        translations: Array<{ key: string; value: string }>;
      };
    }>(`mutation SynaravaProductTranslations($resourceId: ID!, $translations: [TranslationInput!]!) {
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

export async function fetchProductTranslation(resourceId: string) {
  const data = await shopifyAdminRequest<{
    translatableResource: {
      translations: RemoteTranslation[];
    } | null;
  }>(`query SynaravaProductPortugueseTranslation($resourceId: ID!) {
    translatableResource(resourceId: $resourceId) {
      translations(locale: "${SHOPIFY_PORTUGUESE_ADMIN_LOCALE}") { key value updatedAt outdated }
    }
  }`, { resourceId });

  if (!data.translatableResource) return null;
  return productTranslationSnapshot(data.translatableResource.translations);
}

export async function fetchProductTranslationIndex() {
  const result = new Map<string, ShopifyProductTranslationSnapshot | null>();
  let cursor: string | null = null;
  do {
    const data: {
      translatableResources: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: Array<{ resourceId: string; translations: RemoteTranslation[] }>;
      };
    } = await shopifyAdminRequest(`query SynaravaProductTranslationIndex($after: String) {
      translatableResources(first: 100, after: $after, resourceType: PRODUCT) {
        pageInfo { hasNextPage endCursor }
        nodes {
          resourceId
          translations(locale: "${SHOPIFY_PORTUGUESE_ADMIN_LOCALE}") { key value updatedAt outdated }
        }
      }
    }`, { after: cursor });
    for (const resource of data.translatableResources.nodes) {
      result.set(resource.resourceId, productTranslationSnapshot(resource.translations));
    }
    cursor = data.translatableResources.pageInfo.hasNextPage
      ? data.translatableResources.pageInfo.endCursor
      : null;
  } while (cursor);
  return result;
}
