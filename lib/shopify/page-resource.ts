import "server-only";

import { ShopifyAdminError, shopifyAdminRequest } from "@/lib/shopify/admin";
import { plainTextFromRichText } from "@/lib/content/rich-text";

type ShopifyPageInput = {
  title: string;
  body: string;
  handle: string;
  isPublished: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

type UserError = { field?: string[] | null; message: string };

function assertPageResult(
  operation: string,
  payload: { page: { id: string; handle: string } | null; userErrors: UserError[] },
) {
  if (payload.userErrors.length > 0) {
    throw new ShopifyAdminError(`${operation}: ${payload.userErrors.map((error) => error.message).join("; ")}`);
  }
  if (!payload.page) throw new ShopifyAdminError(`${operation}: Shopify returned no page.`);
  return payload.page;
}

function toShopifyPagePayload(page: ShopifyPageInput) {
  const seoTitle = page.seoTitle?.trim();
  const seoDescription = plainTextFromRichText(page.seoDescription ?? "") || undefined;
  return {
    title: page.title,
    body: page.body,
    handle: page.handle,
    isPublished: page.isPublished,
    ...(seoTitle || seoDescription
      ? {
          seo: {
            ...(seoTitle ? { title: seoTitle } : {}),
            ...(seoDescription ? { description: seoDescription } : {}),
          },
        }
      : {}),
  };
}

export async function upsertShopifyPage({
  resourceId,
  ...page
}: ShopifyPageInput & { resourceId?: string | null }) {
  const payload = toShopifyPagePayload(page);

  if (resourceId) {
    const result = await shopifyAdminRequest<{
      pageUpdate: { page: { id: string; handle: string } | null; userErrors: UserError[] };
    }>(
      `mutation SynaravaPageUpdate($id: ID!, $page: PageUpdateInput!) {
        pageUpdate(id: $id, page: $page) {
          page { id handle }
          userErrors { field message }
        }
      }`,
      { id: resourceId, page: payload },
    );
    return assertPageResult("Unable to update Shopify page", result.pageUpdate);
  }

  const result = await shopifyAdminRequest<{
    pageCreate: { page: { id: string; handle: string } | null; userErrors: UserError[] };
  }>(
    `mutation SynaravaPageCreate($page: PageCreateInput!) {
      pageCreate(page: $page) {
        page { id handle }
        userErrors { field message }
      }
    }`,
    { page: payload },
  );
  return assertPageResult("Unable to create Shopify page", result.pageCreate);
}
