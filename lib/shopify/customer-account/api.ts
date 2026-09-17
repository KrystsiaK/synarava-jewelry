import "server-only";

import { z } from "zod";

import { getCustomerApiDiscovery } from "./discovery";
import {
  getShopifyCustomerSession,
  type ActiveShopifyCustomerSession,
} from "./session";
import { deleteStoredCustomerSession } from "./session-store";

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

const trackingInformationSchema = z.object({
  company: z.string().nullable(),
  number: z.string().nullable(),
  url: z.string().nullable(),
});

const fulfillmentSchema = z.object({
  status: z.string().nullable(),
  latestShipmentStatus: z.string().nullable(),
  estimatedDeliveryAt: z.string().nullable(),
  trackingInformation: z.array(trackingInformationSchema),
});

const returnableLineItemSchema = z.object({
  quantity: z.number().int(),
  lineItem: z.object({ id: z.string(), name: z.string() }),
});

const pageInfoSchema = z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() });

// Shared between the initial profile fetch and getShopifyCustomerOrdersPage()
// (REV-13's "load more orders") so both read the exact same order shape.
const orderSchema = z.object({
  id: z.string(),
  name: z.string(),
  processedAt: z.string(),
  financialStatus: z.string().nullable(),
  fulfillmentStatus: z.string(),
  statusPageUrl: z.string(),
  totalPrice: moneySchema,
  // totalPrice already nets out formally-returned line items, but not a
  // manual/non-return refund — totalRefunded lets "Total spent" subtract those
  // too (REV-14) without mixing currencies together.
  totalRefunded: moneySchema,
  fulfillments: z.object({ nodes: z.array(fulfillmentSchema), pageInfo: pageInfoSchema }),
  returnInformation: z.object({
    returnableLineItems: z.object({ nodes: z.array(returnableLineItemSchema), pageInfo: pageInfoSchema }),
  }),
  lineItems: z.object({
    nodes: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        productId: z.string().nullable(),
        quantity: z.number().int(),
        image: z
          .object({ altText: z.string().nullable(), url: z.string() })
          .nullable(),
        totalPrice: moneySchema.nullable(),
      }),
    ),
    pageInfo: pageInfoSchema,
  }),
});

const ORDER_FIELDS = `#graphql
  id
  name
  processedAt
  financialStatus
  fulfillmentStatus
  statusPageUrl
  totalPrice { amount currencyCode }
  totalRefunded { amount currencyCode }
  fulfillments(first: 5) {
    pageInfo { hasNextPage endCursor }
    nodes {
      status
      latestShipmentStatus
      estimatedDeliveryAt
      trackingInformation { company number url }
    }
  }
  returnInformation {
    returnableLineItems(first: 20) {
      pageInfo { hasNextPage endCursor }
      nodes {
        quantity
        lineItem { id name }
      }
    }
  }
  lineItems(first: 20) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id productId
      name
      quantity
      image { altText url }
      totalPrice { amount currencyCode }
    }
  }
`;

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
    addresses: z.object({ nodes: z.array(addressSchema), pageInfo: pageInfoSchema }),
    orders: z.object({ nodes: z.array(orderSchema), pageInfo: pageInfoSchema }),
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
        pageInfo { hasNextPage endCursor }
        nodes {
          id name company address1 address2 city province zip country
          territoryCode phoneNumber formatted(withName: true, withCompany: true)
        }
      }
      orders(first: 50, sortKey: PROCESSED_AT, reverse: true) {
        pageInfo { hasNextPage endCursor }
        nodes { ${ORDER_FIELDS} }
      }
    }
  }
`;

export type ShopifyCustomerProfile = z.infer<typeof profileSchema>["customer"];

const purchaseLookupSchema = z.object({
  data: z.object({
    customer: z.object({
      orders: z.object({
        nodes: z.array(z.object({
          id: z.string(),
          lineItems: z.object({
            nodes: z.array(z.object({ productId: z.string().nullable() })),
            pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
          }),
        })),
        pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
      }),
    }),
  }).optional(),
  errors: z.array(z.object({ message: z.string() }).passthrough()).optional(),
});

const lineItemLookupSchema = z.object({
  data: z.object({
    order: z.object({
      lineItems: z.object({
        nodes: z.array(z.object({ productId: z.string().nullable() })),
        pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
      }),
    }).nullable(),
  }).optional(),
  errors: z.array(z.object({ message: z.string() }).passthrough()).optional(),
});

export async function getShopifyCustomerProfile(
  resolvedSession?: ActiveShopifyCustomerSession,
): Promise<ShopifyCustomerProfile | null> {
  const session = resolvedSession ?? await getShopifyCustomerSession();
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

  if (response.status === 401) {
    await deleteStoredCustomerSession(session.id).catch(() => undefined);
    return null;
  }
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

const identitySchema = z.object({
  data: z.object({ customer: z.object({ id: z.string() }).nullable() }).optional(),
  errors: z.array(z.object({ message: z.string() }).passthrough()).optional(),
});

/**
 * Just the signed-in customer's id — for callers (REV-16: the wishlist toggle)
 * that only need to confirm identity, not the full profile query's orders,
 * addresses, and returns.
 */
export async function getShopifyCustomerId(
  resolvedSession?: ActiveShopifyCustomerSession,
): Promise<string | null> {
  const session = resolvedSession ?? await getShopifyCustomerSession();
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
      operationName: "SynaravaCustomerIdentity",
      query: `query SynaravaCustomerIdentity { customer { id } }`,
      variables: {},
    }),
    cache: "no-store",
  });

  if (response.status === 401) {
    await deleteStoredCustomerSession(session.id).catch(() => undefined);
    return null;
  }
  if (!response.ok) {
    throw new Error(`Shopify Customer Account API failed (${response.status}).`);
  }

  const payload = identitySchema.parse(await response.json());
  if (payload.errors?.length || !payload.data) {
    throw new Error(
      payload.errors?.map((error) => error.message).join("; ") ??
        "Shopify returned no customer data.",
    );
  }

  return payload.data.customer?.id ?? null;
}

async function customerAccountQuery(
  operationName: string,
  query: string,
  variables: Record<string, unknown>,
) {
  const session = await getShopifyCustomerSession();
  if (!session) throw new Error("Shopify customer session is unavailable.");
  const { graphql_api } = await getCustomerApiDiscovery();
  const response = await fetch(graphql_api, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: session.accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ operationName, query, variables }),
    cache: "no-store",
  });
  if (response.status === 401) {
    await deleteStoredCustomerSession(session.id).catch(() => undefined);
  }
  if (!response.ok) throw new Error(`Shopify Customer Account API failed (${response.status}).`);
  return response.json() as Promise<unknown>;
}

const ordersPageSchema = z.object({
  data: z.object({
    customer: z.object({ orders: z.object({ nodes: z.array(orderSchema), pageInfo: pageInfoSchema }) }),
  }).optional(),
  errors: z.array(z.object({ message: z.string() }).passthrough()).optional(),
});

export type ShopifyCustomerOrder = z.infer<typeof orderSchema>;

/** The next page of orders past the profile's initial 50 (REV-13's "load more orders"). */
export async function getShopifyCustomerOrdersPage(after: string) {
  const payload = ordersPageSchema.parse(await customerAccountQuery(
    "SynaravaCustomerOrdersPage",
    `query SynaravaCustomerOrdersPage($after: String) {
      customer {
        orders(first: 50, after: $after, sortKey: PROCESSED_AT, reverse: true) {
          pageInfo { hasNextPage endCursor }
          nodes { ${ORDER_FIELDS} }
        }
      }
    }`,
    { after },
  ));
  if (payload.errors?.length || !payload.data) {
    throw new Error(payload.errors?.map((error) => error.message).join("; ") || "Shopify returned no order data.");
  }
  return payload.data.customer.orders;
}

/** Exhaustively checks the signed-in buyer's orders without treating connection pages as complete. */
export async function findShopifyCustomerOrderForProduct(productId: string): Promise<string | null> {
  let ordersAfter: string | null = null;
  do {
    const payload = purchaseLookupSchema.parse(await customerAccountQuery(
      "SynaravaReviewPurchaseLookup",
      `query SynaravaReviewPurchaseLookup($ordersAfter: String) {
        customer {
          orders(first: 50, after: $ordersAfter, sortKey: PROCESSED_AT, reverse: true) {
            nodes {
              id
              lineItems(first: 250) {
                nodes { productId }
                pageInfo { hasNextPage endCursor }
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }`,
      { ordersAfter },
    ));
    if (payload.errors?.length || !payload.data) {
      throw new Error(payload.errors?.map((error) => error.message).join("; ") || "Shopify returned no order data.");
    }

    for (const order of payload.data.customer.orders.nodes) {
      if (order.lineItems.nodes.some((lineItem) => lineItem.productId === productId)) return order.id;
      let lineItemsAfter = order.lineItems.pageInfo.hasNextPage
        ? order.lineItems.pageInfo.endCursor
        : null;
      while (lineItemsAfter) {
        const lineItemPayload = lineItemLookupSchema.parse(await customerAccountQuery(
          "SynaravaReviewOrderLineItems",
          `query SynaravaReviewOrderLineItems($orderId: ID!, $lineItemsAfter: String) {
            order(id: $orderId) {
              lineItems(first: 250, after: $lineItemsAfter) {
                nodes { productId }
                pageInfo { hasNextPage endCursor }
              }
            }
          }`,
          { orderId: order.id, lineItemsAfter },
        ));
        if (lineItemPayload.errors?.length || !lineItemPayload.data?.order) {
          throw new Error(lineItemPayload.errors?.map((error) => error.message).join("; ") || "Shopify returned no order line items.");
        }
        const connection = lineItemPayload.data.order.lineItems;
        if (connection.nodes.some((lineItem) => lineItem.productId === productId)) return order.id;
        lineItemsAfter = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
      }
    }
    ordersAfter = payload.data.customer.orders.pageInfo.hasNextPage
      ? payload.data.customer.orders.pageInfo.endCursor
      : null;
  } while (ordersAfter);
  return null;
}

const returnRequestSchema = z.object({
  data: z.object({
    orderRequestReturn: z.object({
      return: z.object({ id: z.string(), status: z.string(), name: z.string() }).nullable(),
      userErrors: z.array(z.object({ field: z.array(z.string()).nullable(), message: z.string() })),
    }),
  }).optional(),
  errors: z.array(z.object({ message: z.string() }).passthrough()).optional(),
});

/** Requests a return for the given order line items through Shopify's own return flow. */
export async function requestShopifyOrderReturn(
  orderId: string,
  requestedLineItems: Array<{ lineItemId: string; quantity: number }>,
) {
  const payload = returnRequestSchema.parse(await customerAccountQuery(
    "SynaravaRequestOrderReturn",
    `mutation SynaravaRequestOrderReturn($orderId: ID!, $requestedLineItems: [RequestedLineItemInput!]!) {
      orderRequestReturn(orderId: $orderId, requestedLineItems: $requestedLineItems) {
        return { id status name }
        userErrors { field message }
      }
    }`,
    { orderId, requestedLineItems },
  ));
  if (payload.errors?.length || !payload.data) {
    throw new Error(payload.errors?.map((error) => error.message).join("; ") || "Shopify did not process the return request.");
  }

  const result = payload.data.orderRequestReturn;
  if (result.userErrors.length) {
    throw new Error(result.userErrors.map((error) => error.message).join("; "));
  }
  if (!result.return) throw new Error("Shopify did not create the return.");
  return result.return;
}
