import { z } from "zod";

import { AI_FIELDS } from "@/lib/ai/product-content/contract";

/** String properties for every AI field except EN title (never generated). */
function localeProperties(includeTitle: boolean): Record<string, { type: "string" }> {
  const properties: Record<string, { type: "string" }> = {};
  for (const key of AI_FIELDS) {
    if (!includeTitle && key === "title") continue;
    properties[key] = { type: "string" };
  }
  return properties;
}

/** Shared JSON Schema for structured product-content output (provider-agnostic). */
export const PRODUCT_CONTENT_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["locales"],
  properties: {
    locales: {
      type: "object",
      additionalProperties: false,
      properties: {
        en: {
          type: "object",
          additionalProperties: false,
          properties: localeProperties(false),
        },
        pt: {
          type: "object",
          additionalProperties: false,
          properties: localeProperties(true),
        },
        ru: {
          type: "object",
          additionalProperties: false,
          properties: localeProperties(true),
        },
      },
    },
  },
} as const;

const localeFieldShape = Object.fromEntries(AI_FIELDS.map((key) => [key, z.string().optional()]));

const localeFieldsSchema = z.object(localeFieldShape).strict();

/** Zod mirror of PRODUCT_CONTENT_RESPONSE_SCHEMA. */
export const productContentLocalesSchema = z
  .object({
    locales: z
      .object({
        en: localeFieldsSchema.optional(),
        pt: localeFieldsSchema.optional(),
        ru: localeFieldsSchema.optional(),
      })
      .strict(),
  })
  .strict();

/** @deprecated Use productContentLocalesSchema */
export const geminiLocalesSchema = productContentLocalesSchema;
