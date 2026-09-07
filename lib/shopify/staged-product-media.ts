export type StagedProductMedia = {
  assetId: string;
  filename: string;
  key: string;
};

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
