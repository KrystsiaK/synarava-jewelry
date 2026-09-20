import "server-only";

import type { TranslationResourceType } from "@prisma/client";

import type { LocalizedFieldDefinition } from "@/lib/i18n/admin-field-registry";
import { ShopifyAdminError, shopifyAdminRequest } from "@/lib/shopify/admin";
import { metaobjectFieldKey } from "@/lib/shopify/metaobject-field-key";
import type { TranslatableContent } from "@/lib/shopify/translations";

type UserError = { field?: string[] | null; message: string };

export function sourceContentAsRemoteValues(content: TranslatableContent[]) {
  const sourceLocales = new Set(content.flatMap(({ locale }) => locale ? [locale.toLowerCase()] : []));
  if (sourceLocales.size > 0 && ![...sourceLocales].every((locale) => locale.startsWith("en"))) {
    throw new Error(
      `Shopify's primary language is ${[...sourceLocales].join(", ")}, not English. Change the store primary language before reconciling EN.`,
    );
  }
  return content.map(({ key, value }) => ({ key, value: value ?? "", updatedAt: null, outdated: null }));
}

function wireValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function assertWritable(field: LocalizedFieldDefinition, value: unknown) {
  if (field.required === "always" && !wireValue(value).trim()) {
    throw new Error(`${field.label} is required and cannot be cleared in Shopify.`);
  }
}

function throwOnErrors(operation: string, errors: UserError[]) {
  if (errors.length > 0) {
    throw new ShopifyAdminError(`${operation}: ${errors.map(({ message }) => message).join("; ")}`);
  }
}

/**
 * Patches exactly one primary-language Shopify field. Source copy cannot be
 * written through translationsRegister, so native resources and app-owned
 * metaobjects use their narrow update mutations instead.
 */
export async function updateShopifySourceField({
  resourceType,
  resourceId,
  field,
  value,
}: {
  resourceType: TranslationResourceType;
  resourceId: string;
  field: LocalizedFieldDefinition;
  value: unknown;
}) {
  const target = field.shopifyTarget;
  if (!target) throw new Error("This field does not have a Shopify source target.");
  assertWritable(field, value);
  const serialized = wireValue(value);

  if (resourceType === "METAOBJECT" && target.kind === "metaobject") {
    const result = await shopifyAdminRequest<{
      metaobjectUpdate: { metaobject: { id: string } | null; userErrors: UserError[] };
    }>(`mutation SynaravaUpdateSourceMetaobject($id: ID!, $metaobject: MetaobjectUpdateInput!) {
      metaobjectUpdate(id: $id, metaobject: $metaobject) {
        metaobject { id }
        userErrors { field message }
      }
    }`, {
      id: resourceId,
      metaobject: { fields: [{ key: metaobjectFieldKey(target.key), value: serialized }] },
    });
    throwOnErrors("Unable to update Shopify source content", result.metaobjectUpdate.userErrors);
    if (!result.metaobjectUpdate.metaobject) throw new ShopifyAdminError("Shopify did not return the updated metaobject.");
    return { mutation: "metaobjectUpdate", key: metaobjectFieldKey(target.key) };
  }

  if (target.kind !== "native") throw new Error("This Shopify source target is not supported.");
  const key = target.key;

  if (resourceType === "PRODUCT") {
    const product: Record<string, unknown> = {};
    if (key === "title") product.title = serialized;
    else if (key === "handle") {
      product.handle = serialized;
      product.redirectNewHandle = true;
    } else if (key === "body_html") product.descriptionHtml = serialized;
    else if (key === "meta_title") product.seo = { title: serialized };
    else if (key === "meta_description") product.seo = { description: serialized };
    else throw new Error(`Shopify Product source field ${key} is not supported.`);

    const result = await shopifyAdminRequest<{
      productUpdate: { product: { id: string } | null; userErrors: UserError[] };
    }>(`mutation SynaravaUpdateSourceProduct($product: ProductUpdateInput!) {
      productUpdate(product: $product) {
        product { id }
        userErrors { field message }
      }
    }`, { product: { id: resourceId, ...product } });
    throwOnErrors("Unable to update Shopify Product source content", result.productUpdate.userErrors);
    if (!result.productUpdate.product) throw new ShopifyAdminError("Shopify did not return the updated Product.");
    return { mutation: "productUpdate", key };
  }

  if (resourceType === "COLLECTION") {
    const input: Record<string, unknown> = { id: resourceId };
    if (key === "title") input.title = serialized;
    else if (key === "handle") {
      input.handle = serialized;
      input.redirectNewHandle = true;
    } else if (key === "body_html") input.descriptionHtml = serialized;
    else if (key === "meta_title") input.seo = { title: serialized };
    else if (key === "meta_description") input.seo = { description: serialized };
    else throw new Error(`Shopify Collection source field ${key} is not supported.`);

    const result = await shopifyAdminRequest<{
      collectionUpdate: { collection: { id: string } | null; userErrors: UserError[] };
    }>(`mutation SynaravaUpdateSourceCollection($input: CollectionInput!) {
      collectionUpdate(input: $input) {
        collection { id }
        userErrors { field message }
      }
    }`, { input });
    throwOnErrors("Unable to update Shopify Collection source content", result.collectionUpdate.userErrors);
    if (!result.collectionUpdate.collection) throw new ShopifyAdminError("Shopify did not return the updated Collection.");
    return { mutation: "collectionUpdate", key };
  }

  if (resourceType === "PAGE") {
    const page: Record<string, unknown> = {};
    if (key === "title") page.title = serialized;
    else if (key === "handle") page.handle = serialized;
    else if (key === "body_html") page.body = serialized;
    else if (key === "meta_title") page.seo = { title: serialized };
    else if (key === "meta_description") page.seo = { description: serialized };
    else throw new Error(`Shopify Page source field ${key} is not supported.`);

    const result = await shopifyAdminRequest<{
      pageUpdate: { page: { id: string } | null; userErrors: UserError[] };
    }>(`mutation SynaravaUpdateSourcePage($id: ID!, $page: PageUpdateInput!) {
      pageUpdate(id: $id, page: $page) {
        page { id }
        userErrors { field message }
      }
    }`, { id: resourceId, page });
    throwOnErrors("Unable to update Shopify Page source content", result.pageUpdate.userErrors);
    if (!result.pageUpdate.page) throw new ShopifyAdminError("Shopify did not return the updated Page.");
    return { mutation: "pageUpdate", key };
  }

  throw new Error(`Shopify source updates are not supported for ${resourceType}.`);
}
