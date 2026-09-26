/**
 * Shopify Admin GraphQL `resourcePublicationsV2` nodes.
 *
 * `publication` is typed as non-null in some schema snapshots, but live Admin
 * responses can return `null` (deleted/inaccessible channel). Always guard
 * before reading `.name`.
 *
 * @see https://shopify.dev/docs/api/admin-graphql/latest/objects/ResourcePublicationV2
 */
export type ShopifyResourcePublication = {
  isPublished: boolean;
  publishDate: string | null;
  publication: { id: string; name: string } | null;
};

export function findOnlineStorePublication(
  nodes: Array<ShopifyResourcePublication | null | undefined>,
): ShopifyResourcePublication | undefined {
  return nodes.find((item): item is ShopifyResourcePublication =>
    Boolean(item && /online store/i.test(item.publication?.name ?? "")),
  );
}

export function publishedPublicationNames(
  nodes: Array<ShopifyResourcePublication | null | undefined>,
): string[] {
  return nodes
    .flatMap((item) => (item?.isPublished && item.publication?.name ? [item.publication.name] : []))
    .toSorted();
}

export function isPublishedToOnlineStore(
  nodes: Array<ShopifyResourcePublication | null | undefined>,
): boolean {
  return Boolean(findOnlineStorePublication(nodes)?.isPublished);
}
