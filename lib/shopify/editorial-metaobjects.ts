import "server-only";

import { ShopifyAdminError, shopifyAdminRequest } from "@/lib/shopify/admin";
import { SHOPIFY_PORTUGUESE_ADMIN_LOCALE } from "@/lib/shopify/locales";
import { registerTranslations } from "@/lib/shopify/translations";

type EditorialValue = unknown;

type MetaobjectDefinition = {
  id: string;
  capabilities: { translatable?: { enabled: boolean } | null };
  fieldDefinitions: Array<{ key: string }>;
};

type UserError = { field?: string[] | null; message: string };

export function metaobjectFieldKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9_]+/g, "__")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function serializeValue(value: EditorialValue): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}

export function serializeEditorialFields(values: Record<string, EditorialValue>) {
  return Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [metaobjectFieldKey(key), serializeValue(value)] as const)
      .filter(([, value]) => value.length > 0),
  );
}

function appType(definition: string) {
  return definition.startsWith("$app:") ? definition : `$app:${definition}`;
}

function throwOnUserErrors(operation: string, errors: UserError[]) {
  if (errors.length > 0) {
    throw new ShopifyAdminError(`${operation}: ${errors.map((error) => error.message).join("; ")}`);
  }
}

async function ensureDefinition({
  definition,
  name,
  fieldKeys,
}: {
  definition: string;
  name: string;
  fieldKeys: string[];
}) {
  const type = appType(definition);
  const existing = await shopifyAdminRequest<{ metaobjectDefinitionByType: MetaobjectDefinition | null }>(
    `query SynaravaEditorialMetaobjectDefinition($type: String!) {
      metaobjectDefinitionByType(type: $type) {
        id
        capabilities { translatable { enabled } }
        fieldDefinitions { key }
      }
    }`,
    { type },
  );

  if (existing.metaobjectDefinitionByType) {
    const definitionRecord = existing.metaobjectDefinitionByType;
    if (!definitionRecord.capabilities.translatable?.enabled) {
      throw new ShopifyAdminError(
        `Metaobject definition ${type} exists but its translatable capability is disabled. Enable it before syncing.`,
      );
    }
    const available = new Set(definitionRecord.fieldDefinitions.map((field) => field.key));
    const missing = fieldKeys.filter((key) => !available.has(key));
    if (missing.length > 0) {
      const update = await shopifyAdminRequest<{
        metaobjectDefinitionUpdate: {
          metaobjectDefinition: { id: string } | null;
          userErrors: UserError[];
        };
      }>(
        `mutation SynaravaEditorialMetaobjectDefinitionUpdate($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
          metaobjectDefinitionUpdate(id: $id, definition: $definition) {
            metaobjectDefinition { id }
            userErrors { field message }
          }
        }`,
        {
          id: definitionRecord.id,
          definition: {
            fieldDefinitions: missing.map((key) => ({
              create: {
                key,
                name: key.replaceAll("_", " "),
                type: "multi_line_text_field",
              },
            })),
          },
        },
      );
      throwOnUserErrors("Unable to extend editorial metaobject definition", update.metaobjectDefinitionUpdate.userErrors);
      if (!update.metaobjectDefinitionUpdate.metaobjectDefinition) {
        throw new ShopifyAdminError(`Shopify did not return the updated metaobject definition ${type}.`);
      }
    }
    return definitionRecord.id;
  }

  const result = await shopifyAdminRequest<{
    metaobjectDefinitionCreate: {
      metaobjectDefinition: { id: string } | null;
      userErrors: UserError[];
    };
  }>(
    `mutation SynaravaEditorialMetaobjectDefinitionCreate($definition: MetaobjectDefinitionCreateInput!) {
      metaobjectDefinitionCreate(definition: $definition) {
        metaobjectDefinition { id }
        userErrors { field message }
      }
    }`,
    {
      definition: {
        name,
        type,
        access: { storefront: "PUBLIC_READ" },
        capabilities: { translatable: { enabled: true } },
        fieldDefinitions: fieldKeys.map((key) => ({
          key,
          name: key.replaceAll("_", " "),
          type: "multi_line_text_field",
        })),
      },
    },
  );
  throwOnUserErrors("Unable to create editorial metaobject definition", result.metaobjectDefinitionCreate.userErrors);
  if (!result.metaobjectDefinitionCreate.metaobjectDefinition) {
    throw new ShopifyAdminError("Shopify did not return the created editorial metaobject definition.");
  }
  return result.metaobjectDefinitionCreate.metaobjectDefinition.id;
}

export async function ensureEditorialMetaobject({
  definition,
  name,
  handle,
  values,
  fieldKeys,
}: {
  definition: string;
  name: string;
  handle: string;
  values: Record<string, EditorialValue>;
  fieldKeys?: string[];
}) {
  const serialized = serializeEditorialFields(values);
  const definitionFieldKeys = (fieldKeys ?? Object.keys(values)).map(metaobjectFieldKey);
  await ensureDefinition({ definition, name, fieldKeys: [...new Set(definitionFieldKeys)] });

  const result = await shopifyAdminRequest<{
    metaobjectUpsert: {
      metaobject: { id: string; handle: string } | null;
      userErrors: UserError[];
    };
  }>(
    `mutation SynaravaEditorialMetaobjectUpsert($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
      metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
        metaobject { id handle }
        userErrors { field message }
      }
    }`,
    {
      handle: { type: appType(definition), handle },
      metaobject: {
        fields: Object.entries(serialized).map(([key, value]) => ({ key, value })),
      },
    },
  );
  throwOnUserErrors("Unable to upsert editorial metaobject", result.metaobjectUpsert.userErrors);
  if (!result.metaobjectUpsert.metaobject) {
    throw new ShopifyAdminError("Shopify did not return the upserted editorial metaobject.");
  }
  return result.metaobjectUpsert.metaobject;
}

export async function registerEditorialMetaobjectTranslation(
  resourceId: string,
  values: Record<string, EditorialValue>,
) {
  return registerTranslations({
    resourceId,
    locale: SHOPIFY_PORTUGUESE_ADMIN_LOCALE,
    values: serializeEditorialFields(values),
  });
}
