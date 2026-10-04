import "server-only";

import { shopifyAdminRequest, ShopifyAdminError } from "@/lib/shopify/admin";
import {
  isManagedProductMetafieldNamespace,
  type ProductMetafieldValueInput,
} from "@/lib/shopify/product-metafields-shared";

type UserError = { message: string };

function assertNoErrors(errors: UserError[]) {
  if (errors.length) throw new ShopifyAdminError(errors.map((error) => error.message).join("; "));
}

/** Push the editable window; a blank/absent custom value means delete, not skip. */
export async function pushProductMetafields({
  ownerId,
  desired,
  remote,
  hasCustomWindow,
  managedPassportKeys,
}: {
  ownerId: string;
  desired: ProductMetafieldValueInput[];
  remote: Array<{ namespace: string; key: string }>;
  hasCustomWindow: boolean;
  managedPassportKeys: ReadonlySet<string>;
}) {
  const refs: Array<{ id: string; namespace: string; key: string; type: string }> = [];
  const values = desired.filter((item) => item.value.trim());
  // Shopify metafieldsSet accepts at most 25 entries per mutation.
  // https://shopify.dev/docs/api/admin-graphql/latest/mutations/metafieldsSet
  for (let offset = 0; offset < values.length; offset += 25) {
    const data = await shopifyAdminRequest<{ metafieldsSet: { userErrors: UserError[]; metafields?: Array<{ id: string; namespace: string; key: string; type: string } | null> } }>(
      `mutation SynaravaMetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) { metafields { id namespace key type } userErrors { field message } }
      }`,
      { metafields: values.slice(offset, offset + 25).map((item) => ({ ...item, ownerId })) },
    );
    assertNoErrors(data.metafieldsSet.userErrors);
    for (const ref of data.metafieldsSet.metafields ?? []) if (ref) refs.push(ref);
  }
  const identity = (item: { namespace: string; key: string }) => `${item.namespace}:${item.key}`;
  const desiredKeys = new Set(values.map(identity));
  const deletions = remote.filter((item) => !desiredKeys.has(identity(item)) && (
    item.namespace === "synarava" && managedPassportKeys.has(item.key)
    || hasCustomWindow && !isManagedProductMetafieldNamespace(item.namespace)
  ));
  for (let offset = 0; offset < deletions.length; offset += 25) {
    const data = await shopifyAdminRequest<{ metafieldsDelete: { userErrors: UserError[] } }>(
      `mutation SynaravaMetafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
        metafieldsDelete(metafields: $metafields) { userErrors { field message } }
      }`,
      { metafields: deletions.slice(offset, offset + 25).map(({ namespace, key }) => ({ ownerId, namespace, key })) },
    );
    assertNoErrors(data.metafieldsDelete.userErrors);
  }
  return refs;
}
