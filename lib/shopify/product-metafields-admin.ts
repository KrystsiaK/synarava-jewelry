import "server-only";

import { shopifyAdminRequest } from "@/lib/shopify/admin";
import {
  isManagedProductMetafieldNamespace,
  slugifyMetafieldKey,
  type ProductMetafieldDefinition,
  type ProductMetafieldValueInput,
} from "@/lib/shopify/product-metafields-shared";

export type { ProductMetafieldDefinition, ProductMetafieldValueInput } from "@/lib/shopify/product-metafields-shared";
export {
  isManagedProductMetafieldNamespace,
  listCustomProductMetafieldDefinitions,
  metafieldValueFromSnapshot,
  slugifyMetafieldKey,
} from "@/lib/shopify/product-metafields-shared";

type UserError = { field?: string[] | null; message: string };

function userErrors(errors: UserError[] | undefined) {
  if (!errors?.length) return;
  throw new Error(errors.map((error) => error.message).join("; "));
}

/**
 * Shop-wide PRODUCT metafield definitions.
 * @see https://shopify.dev/docs/apps/build/metafields/definitions
 */
export async function listProductMetafieldDefinitions(): Promise<ProductMetafieldDefinition[]> {
  const data = await shopifyAdminRequest<{
    metafieldDefinitions: {
      nodes: Array<{
        id: string;
        namespace: string;
        key: string;
        name: string;
        description: string | null;
        type: { name: string };
      }>;
    };
  }>(`query SynaravaProductMetafieldDefinitions {
    metafieldDefinitions(first: 100, ownerType: PRODUCT) {
      nodes {
        id
        namespace
        key
        name
        description
        type { name }
      }
    }
  }`);

  return (data.metafieldDefinitions.nodes ?? []).map((node) => ({
    id: node.id,
    namespace: node.namespace,
    key: node.key,
    name: node.name,
    type: node.type.name,
    description: node.description,
  }));
}

/**
 * Create a merchant-owned PRODUCT metafield definition (Shopify “Add definition”).
 * @see https://shopify.dev/docs/api/admin-graphql/latest/mutations/metafieldDefinitionCreate
 */
export async function createProductMetafieldDefinition(input: {
  name: string;
  key?: string;
  namespace?: string;
  type?: string;
  description?: string;
}): Promise<ProductMetafieldDefinition> {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");
  const namespace = (input.namespace?.trim() || "custom").replace(/^\$+/, "");
  if (isManagedProductMetafieldNamespace(namespace)) {
    throw new Error(`Namespace “${namespace}” is reserved. Use custom or another merchant namespace.`);
  }
  const key = (input.key?.trim() || slugifyMetafieldKey(name)).replace(/[^a-zA-Z0-9_]/g, "_");
  const type = input.type?.trim() || "single_line_text_field";

  const data = await shopifyAdminRequest<{
    metafieldDefinitionCreate: {
      createdDefinition: {
        id: string;
        namespace: string;
        key: string;
        name: string;
        description: string | null;
        type: { name: string };
      } | null;
      userErrors: UserError[];
    };
  }>(
    `mutation SynaravaMetafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition {
          id
          namespace
          key
          name
          description
          type { name }
        }
        userErrors { field message }
      }
    }`,
    {
      definition: {
        name,
        namespace,
        key,
        type,
        ownerType: "PRODUCT",
        description: input.description?.trim() || undefined,
        access: { storefront: "PUBLIC_READ" },
      },
    },
  );

  userErrors(data.metafieldDefinitionCreate.userErrors);
  const created = data.metafieldDefinitionCreate.createdDefinition;
  if (!created) throw new Error("Shopify did not return the new metafield definition.");
  return {
    id: created.id,
    namespace: created.namespace,
    key: created.key,
    name: created.name,
    type: created.type.name,
    description: created.description,
  };
}

/**
 * Set product metafield values (create or update). Max 25 per request.
 * @see https://shopify.dev/docs/api/admin-graphql/latest/mutations/metafieldsSet
 */
export async function setProductMetafieldValues(input: {
  shopifyProductId: string;
  values: ProductMetafieldValueInput[];
}) {
  if (input.values.length === 0) return;
  const chunks: ProductMetafieldValueInput[][] = [];
  for (let index = 0; index < input.values.length; index += 25) {
    chunks.push(input.values.slice(index, index + 25));
  }
  for (const chunk of chunks) {
    const data = await shopifyAdminRequest<{
      metafieldsSet: { userErrors: UserError[] };
    }>(
      `mutation SynaravaProductMetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) { userErrors { field message } }
      }`,
      {
        metafields: chunk.map((item) => ({
          ownerId: input.shopifyProductId,
          namespace: item.namespace,
          key: item.key,
          type: item.type,
          value: item.value,
        })),
      },
    );
    userErrors(data.metafieldsSet.userErrors);
  }
}
