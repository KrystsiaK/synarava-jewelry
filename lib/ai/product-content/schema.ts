import { z } from "zod";

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
          properties: {
            shortDescription: { type: "string" },
            description: { type: "string" },
            seoTitle: { type: "string" },
            seoDescription: { type: "string" },
          },
        },
        pt: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            shortDescription: { type: "string" },
            description: { type: "string" },
            seoTitle: { type: "string" },
            seoDescription: { type: "string" },
          },
        },
        ru: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            shortDescription: { type: "string" },
            description: { type: "string" },
            seoTitle: { type: "string" },
            seoDescription: { type: "string" },
          },
        },
      },
    },
  },
} as const;

const localeFieldsSchema = z
  .object({
    title: z.string().optional(),
    shortDescription: z.string().optional(),
    description: z.string().optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
  })
  .strict();

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
