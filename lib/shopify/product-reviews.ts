import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

import { shopifyAdminRequest, ShopifyAdminError } from "@/lib/shopify/admin";

const PRODUCT_REVIEWS_CACHE_TAG = "shopify-product-reviews";

type FieldValue = { value: string } | null;

export type ShopifyProductReview = {
  id: string;
  handle: string;
  rating: number;
  title: string;
  body: string;
  authorDisplayName: string;
  submittedAt: string;
  verificationStatus: "verified_buyer" | "verified_reviewer" | "unverified";
  merchantReply: string;
  merchantRepliedAt: string | null;
};

export type ShopifyProductReviews = {
  reviews: ShopifyProductReview[];
  average: number | null;
  count: number;
};

export type ShopifyReviewMetaobject = {
  id: string;
  handle: string;
  capabilities: { publishable: { status: string } | null };
  rating: FieldValue;
  title: FieldValue;
  body: FieldValue;
  product: FieldValue;
  authorDisplayName: FieldValue;
  submittedAt: FieldValue;
  appVerificationStatus: FieldValue;
  merchantReply: FieldValue;
  merchantRepliedAt: FieldValue;
};

function field(value: string, key: string) {
  return { key, value };
}

function optionalField(value: string | null | undefined, key: string) {
  const normalized = value?.trim();
  return normalized ? [field(normalized, key)] : [];
}

export function buildProductReviewInput(input: {
  rating: number;
  title?: string | null;
  body?: string | null;
  productId: string;
  customerId?: string | null;
  authorDisplayName?: string | null;
  orderId?: string | null;
  language?: string | null;
  submittedAt: string;
}) {
  const verified = Boolean(input.orderId);
  return {
    fields: [
      field(JSON.stringify({
        scale_min: "1.0",
        scale_max: "5.0",
        value: `${input.rating.toFixed(1)}`,
      }), "rating"),
      ...optionalField(input.title, "title"),
      ...optionalField(input.body, "body"),
      field(input.submittedAt, "submitted_at"),
      field(input.submittedAt, "published_at"),
      field("synarava_storefront", "source"),
      ...optionalField(input.customerId, "author"),
      ...optionalField(input.authorDisplayName, "author_display_name"),
      ...optionalField(input.orderId, "order"),
      field(input.productId, "product"),
      ...optionalField(input.language, "language"),
      field(verified ? "verified_buyer" : "unverified", "app_verification_status"),
    ],
    capabilities: { publishable: { status: "ACTIVE" as const } },
  };
}

function parseRating(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { value?: unknown; rating?: unknown };
    const rating = Number(parsed.value ?? parsed.rating);
    return Number.isFinite(rating) && rating >= 1 && rating <= 5 ? rating : null;
  } catch {
    return null;
  }
}

export function parseProductReviewMetaobject(
  metaobject: ShopifyReviewMetaobject,
  productId: string,
): ShopifyProductReview | null {
  if (metaobject.capabilities.publishable?.status !== "ACTIVE") return null;
  if (metaobject.product?.value !== productId) return null;
  const rating = parseRating(metaobject.rating?.value);
  if (rating == null || !metaobject.submittedAt?.value) return null;
  const verification = metaobject.appVerificationStatus?.value;

  return {
    id: metaobject.id,
    handle: metaobject.handle,
    rating,
    title: metaobject.title?.value ?? "",
    body: metaobject.body?.value ?? "",
    authorDisplayName: metaobject.authorDisplayName?.value ?? "Shopify customer",
    submittedAt: metaobject.submittedAt.value,
    verificationStatus: verification === "verified_buyer" || verification === "verified_reviewer"
      ? verification
      : "unverified",
    merchantReply: metaobject.merchantReply?.value ?? "",
    merchantRepliedAt: metaobject.merchantRepliedAt?.value ?? null,
  };
}

export function productReviewAggregate(reviews: Array<{ rating: number }>) {
  const count = reviews.length;
  const average = count
    ? reviews.reduce((total, review) => total + review.rating, 0) / count
    : 0;
  const roundedAverage = Math.round(average * 10) / 10;
  return {
    average: roundedAverage,
    count,
    ratingValue: JSON.stringify({
      value: roundedAverage.toFixed(1),
      scale_min: "1.0",
      scale_max: "5.0",
    }),
    countValue: String(count),
  };
}

async function fetchProductReviewMetaobjects() {
  const metaobjects: ShopifyReviewMetaobject[] = [];
  let after: string | null = null;
  do {
    type ReviewPage = {
      metaobjects: {
        nodes: ShopifyReviewMetaobject[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    };
    const data: ReviewPage = await shopifyAdminRequest<ReviewPage>(
      `query SynaravaProductReviews($after: String) {
        metaobjects(first: 250, after: $after, type: "product_review", sortKey: "updated_at", reverse: true) {
          nodes {
            id handle
            capabilities { publishable { status } }
            rating: field(key: "rating") { value }
            title: field(key: "title") { value }
            body: field(key: "body") { value }
            product: field(key: "product") { value }
            authorDisplayName: field(key: "author_display_name") { value }
            submittedAt: field(key: "submitted_at") { value }
            appVerificationStatus: field(key: "app_verification_status") { value }
            merchantReply: field(key: "merchant_reply") { value }
            merchantRepliedAt: field(key: "merchant_replied_at") { value }
          }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { after },
    );
    metaobjects.push(...data.metaobjects.nodes);
    after = data.metaobjects.pageInfo.hasNextPage ? data.metaobjects.pageInfo.endCursor : null;
  } while (after);
  return metaobjects;
}

const fetchCachedProductReviewMetaobjects = unstable_cache(
  fetchProductReviewMetaobjects,
  [PRODUCT_REVIEWS_CACHE_TAG],
  { tags: [PRODUCT_REVIEWS_CACHE_TAG], revalidate: 300 },
);

function invalidateProductReviewCache() {
  revalidateTag(PRODUCT_REVIEWS_CACHE_TAG, { expire: 0 });
}

export async function getShopifyProductReviews(productId: string): Promise<ShopifyProductReviews> {
  const [metaobjects, productData] = await Promise.all([
    fetchCachedProductReviewMetaobjects(),
    shopifyAdminRequest<{
      product: {
        rating: FieldValue;
        ratingCount: FieldValue;
      } | null;
    }>(
      `query SynaravaProductReviewAggregate($id: ID!) {
        product(id: $id) {
          rating: metafield(namespace: "reviews", key: "rating") { value }
          ratingCount: metafield(namespace: "reviews", key: "rating_count") { value }
        }
      }`,
      { id: productId },
    ),
  ]);
  const reviews = metaobjects
    .flatMap((metaobject) => {
      const review = parseProductReviewMetaobject(metaobject, productId);
      return review ? [review] : [];
    })
    .sort((left, right) => Date.parse(right.submittedAt) - Date.parse(left.submittedAt));
  const fallback = productReviewAggregate(reviews);
  const average = parseRating(productData.product?.rating?.value) ?? (fallback.count ? fallback.average : null);
  const storedCount = Number(productData.product?.ratingCount?.value);
  const count = Number.isInteger(storedCount) && storedCount >= 0 ? storedCount : fallback.count;
  return { reviews, average, count };
}

let standardDefinitionEnabled = false;

async function ensureStandardProductReviewDefinition() {
  if (standardDefinitionEnabled) return;
  const result = await shopifyAdminRequest<{
    standardMetaobjectDefinitionEnable: {
      metaobjectDefinition: { id: string } | null;
      userErrors: Array<{ code?: string; message: string }>;
    };
  }>(
    `mutation SynaravaEnableProductReviewDefinition {
      standardMetaobjectDefinitionEnable(type: "product_review") {
        metaobjectDefinition { id }
        userErrors { code message }
      }
    }`,
  );
  const payload = result.standardMetaobjectDefinitionEnable;
  const blockingErrors = payload.userErrors.filter((error) => (
    !/already|enabled|taken|exists/i.test(error.message)
  ));
  if (!payload.metaobjectDefinition && blockingErrors.length) {
    throw new ShopifyAdminError(blockingErrors.map((error) => error.message).join("; "));
  }
  standardDefinitionEnabled = true;
}

export async function ensureProductReviewWebhookSubscriptions(callbackBaseUrl: string) {
  await ensureStandardProductReviewDefinition();
  const uri = `${callbackBaseUrl.replace(/\/$/, "")}/api/shopify/webhooks/reviews`;
  const topics = ["METAOBJECTS_CREATE", "METAOBJECTS_UPDATE", "METAOBJECTS_DELETE"] as const;
  const results: Array<{ topic: (typeof topics)[number]; created: boolean }> = [];

  for (const topic of topics) {
    const data = await shopifyAdminRequest<{
      webhookSubscriptionCreate: {
        webhookSubscription: { id: string } | null;
        userErrors: Array<{ message: string }>;
      };
    }>(
      `mutation SynaravaProductReviewWebhook($topic: WebhookSubscriptionTopic!, $subscription: WebhookSubscriptionInput!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $subscription) {
          webhookSubscription { id }
          userErrors { field message }
        }
      }`,
      { topic, subscription: { uri, format: "JSON", filter: "type:product_review" } },
    );
    const errors = data.webhookSubscriptionCreate.userErrors;
    const blocking = errors.filter((error) => !/already|taken|exists/i.test(error.message));
    if (blocking.length) {
      throw new ShopifyAdminError(blocking.map((error) => error.message).join("; "));
    }
    results.push({ topic, created: Boolean(data.webhookSubscriptionCreate.webhookSubscription) });
  }

  return results;
}

async function setProductReviewAggregates(
  aggregates: Array<{ productId: string; aggregate: ReturnType<typeof productReviewAggregate> }>,
) {
  for (let index = 0; index < aggregates.length; index += 12) {
    const metafields = aggregates.slice(index, index + 12).flatMap(({ productId, aggregate }) => [
      {
        ownerId: productId,
        namespace: "reviews",
        key: "rating",
        type: "rating",
        value: aggregate.ratingValue,
      },
      {
        ownerId: productId,
        namespace: "reviews",
        key: "rating_count",
        type: "number_integer",
        value: aggregate.countValue,
      },
    ]);
    const result = await shopifyAdminRequest<{
      metafieldsSet: { userErrors: Array<{ message: string }> };
    }>(
      `mutation SynaravaUpdateProductReviewAggregate($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) { userErrors { message } }
      }`,
      { metafields },
    );
    if (result.metafieldsSet.userErrors.length) {
      throw new ShopifyAdminError(
        result.metafieldsSet.userErrors.map((error) => error.message).join("; "),
      );
    }
  }
}

export async function refreshShopifyProductReviewAggregates(productIds?: string[]) {
  const metaobjects = await fetchProductReviewMetaobjects();
  // ponytail: when productIds is omitted (Shopify's metaobjects/delete payload carries no
  // product reference), we only refresh products that still have a review. A product whose
  // last review was just deleted keeps its stale rating metafield until its next review event
  // or a full Reconcile — add a periodic sweep if that staleness becomes a real complaint.
  const uniqueProductIds = productIds
    ? [...new Set(productIds)]
    : [...new Set(metaobjects.flatMap((metaobject) => (
        metaobject.capabilities.publishable?.status === "ACTIVE" && metaobject.product?.value
          ? [metaobject.product.value]
          : []
      )))];
  if (!uniqueProductIds.length) return [];
  const aggregates = uniqueProductIds.map((productId) => ({
    productId,
    aggregate: productReviewAggregate(metaobjects.flatMap((metaobject) => {
      const review = parseProductReviewMetaobject(metaobject, productId);
      return review ? [review] : [];
    })),
  }));
  await setProductReviewAggregates(aggregates);
  invalidateProductReviewCache();
  return aggregates;
}

export async function upsertShopifyProductReview(input: {
  handle: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  productId: string;
  customerId?: string | null;
  authorDisplayName?: string | null;
  orderId?: string | null;
  language?: string | null;
  submittedAt: string;
}) {
  await ensureStandardProductReviewDefinition();
  const metaobject = buildProductReviewInput(input);
  const result = await shopifyAdminRequest<{
    metaobjectUpsert: {
      metaobject: { id: string } | null;
      userErrors: Array<{ message: string }>;
    };
  }>(
    `mutation SynaravaUpsertProductReview($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
      metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
        metaobject { id }
        userErrors { message }
      }
    }`,
    { handle: { type: "product_review", handle: input.handle }, metaobject },
  );
  if (result.metaobjectUpsert.userErrors.length || !result.metaobjectUpsert.metaobject) {
    throw new ShopifyAdminError(
      result.metaobjectUpsert.userErrors.map((error) => error.message).join("; ")
      || "Shopify did not create the product review.",
    );
  }

  const metaobjects = await fetchProductReviewMetaobjects();
  const reviews = metaobjects.flatMap((metaobject) => {
    const review = parseProductReviewMetaobject(metaobject, input.productId);
    return review ? [review] : [];
  });
  const aggregate = productReviewAggregate(reviews);
  await setProductReviewAggregates([{ productId: input.productId, aggregate }]);
  invalidateProductReviewCache();
  return {
    reviews,
    average: aggregate.count ? aggregate.average : null,
    count: aggregate.count,
  };
}
