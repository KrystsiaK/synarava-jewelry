import "server-only";

import { z } from "zod";

import { getCustomerApiDiscovery } from "./discovery";
import { getShopifyCustomerSession } from "./session";

const moneySchema = z.object({
  amount: z.string(),
  currencyCode: z.string(),
});

const addressSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  company: z.string().nullable(),
  address1: z.string().nullable(),
  address2: z.string().nullable(),
  city: z.string().nullable(),
  province: z.string().nullable(),
  zip: z.string().nullable(),
  country: z.string().nullable(),
  territoryCode: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  formatted: z.array(z.string()),
});

const profileSchema = z.object({
  customer: z.object({
    id: z.string(),
    displayName: z.string(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    creationDate: z.string(),
    imageUrl: z.string(),
    emailAddress: z
      .object({ emailAddress: z.string().nullable() })
      .nullable(),
    defaultAddress: addressSchema.nullable(),
    addresses: z.object({ nodes: z.array(addressSchema) }),
    orders: z.object({
      nodes: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          processedAt: z.string(),
          financialStatus: z.string().nullable(),
          fulfillmentStatus: z.string(),
          statusPageUrl: z.string(),
          totalPrice: moneySchema,
          lineItems: z.object({
            nodes: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                quantity: z.number().int(),
                image: z
                  .object({ altText: z.string().nullable(), url: z.string() })
                  .nullable(),
                totalPrice: moneySchema.nullable(),
              }),
            ),
          }),
        }),
      ),
    }),
  }),
});

const graphqlResponseSchema = z.object({
  data: profileSchema.optional(),
  errors: z
    .array(z.object({ message: z.string() }).passthrough())
    .optional(),
});

const CUSTOMER_PROFILE_QUERY = `#graphql
  query SynaravaCustomerProfile {
    customer {
      id
      displayName
      firstName
      lastName
      creationDate
      imageUrl
      emailAddress { emailAddress }
      defaultAddress {
        id name company address1 address2 city province zip country
        territoryCode phoneNumber formatted(withName: true, withCompany: true)
      }
      addresses(first: 20) {
        nodes {
          id name company address1 address2 city province zip country
          territoryCode phoneNumber formatted(withName: true, withCompany: true)
        }
      }
      orders(first: 50, sortKey: PROCESSED_AT, reverse: true) {
        nodes {
          id
          name
          processedAt
          financialStatus
          fulfillmentStatus
          statusPageUrl
          totalPrice { amount currencyCode }
          lineItems(first: 20) {
            nodes {
              id
              name
              quantity
              image { altText url }
              totalPrice { amount currencyCode }
            }
          }
        }
      }
    }
  }
`;

export type ShopifyCustomerProfile = z.infer<typeof profileSchema>["customer"];

export async function getShopifyCustomerProfile(): Promise<ShopifyCustomerProfile | null> {
  const session = await getShopifyCustomerSession();
  if (!session) return null;

  const { graphql_api } = await getCustomerApiDiscovery();
  const response = await fetch(graphql_api, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: session.accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      operationName: "SynaravaCustomerProfile",
      query: CUSTOMER_PROFILE_QUERY,
      variables: {},
    }),
    cache: "no-store",
  });

  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`Shopify Customer Account API failed (${response.status}).`);
  }

  const payload = graphqlResponseSchema.parse(await response.json());
  if (payload.errors?.length || !payload.data) {
    throw new Error(
      payload.errors?.map((error) => error.message).join("; ") ??
        "Shopify returned no customer data.",
    );
  }

  return payload.data.customer;
}
