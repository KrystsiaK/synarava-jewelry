export type StagedProductMedia = {
  assetId: string;
  filename: string;
  key: string;
};

// Shopify Admin GraphQL 2026-07: MediaImage has originalSource, not filename.
// https://shopify.dev/docs/api/admin-graphql/latest/objects/mediaimage
export const SHOPIFY_PRODUCT_MEDIA_FRAGMENT = `
  media(first: 250) {
    nodes {
      id alt mediaContentType status preview { image { url width height } }
      ... on MediaImage { originalSource { url } image { url width height } }
    }
  }
`;

export type ShopifyMediaState = {
  id: string;
  filename: string | null;
  status: string;
  imageUrl: string | null;
};

export type ReadyStagedProductMedia = StagedProductMedia & {
  shopifyMediaId: string;
  shopifyUrl: string;
};

export function shopifyMediaFilename({
  originalSourceUrl,
  imageUrl,
}: {
  originalSourceUrl: string | null | undefined;
  imageUrl: string | null | undefined;
}) {
  for (const candidate of [originalSourceUrl, imageUrl]) {
    if (!candidate) continue;
    try {
      const filename = new URL(candidate).pathname.split("/").pop();
      if (filename) return decodeURIComponent(filename);
    } catch {
      // Try the next supported Shopify URL projection.
    }
  }
  return null;
}

/**
 * A local object is disposable only after the matching Shopify file is READY.
 * Filename is safe as the correlation key because locally uploaded filenames
 * include a UUID and are sent to Shopify unchanged.
 */
export function matchReadyShopifyMedia(
  staged: StagedProductMedia[],
  remote: ShopifyMediaState[],
): ReadyStagedProductMedia[] | null {
  const byFilename = new Map(remote.map((item) => [item.filename, item]));
  const matched = staged.map((item) => {
    const remoteItem = byFilename.get(item.filename);
    if (!remoteItem || remoteItem.status !== "READY" || !remoteItem.imageUrl) return null;
    return {
      ...item,
      shopifyMediaId: remoteItem.id,
      shopifyUrl: remoteItem.imageUrl,
    };
  });

  return matched.every((item): item is ReadyStagedProductMedia => item !== null)
    ? matched
    : null;
}
