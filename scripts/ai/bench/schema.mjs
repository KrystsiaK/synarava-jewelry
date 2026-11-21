/** Shared product-content JSON schema for all bench adapters. */
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
};

export const LOCALES = ["en", "pt", "ru"];

export function buildSystemInstruction() {
  return [
    "You write Synarava jewelry product copy for an admin draft preview.",
    "Brand voice: quiet, ceremonial, precise — editorial and museum-like, never salesy or hyperbolic.",
    "English is the commerce base language. Portuguese must be European Portuguese (PT-PT), never Brazilian Portuguese.",
    "Russian must be natural, formal-editorial register.",
    "Only state facts present in the provided product facts. If a fact is missing, omit that claim — do not invent.",
    "Forbidden inventions: materials, sizes, stones, methods, certifications, hypoallergenic, waterproof, durability, rankings, reviews, customer quotes.",
    "Never generate an English title (en.title). Titles are allowed only for pt and/or ru when those locales are requested.",
    "description may use HTML with only: p, strong, em, ul, ol, li, br.",
    "seoTitle should be concise (aim ≤60 characters). seoDescription aim ≤160 characters.",
    "Generate copy only for these locales: en, pt, ru.",
    "Return JSON matching the schema. Empty string means omit that field.",
  ].join("\n");
}

export function buildUserPrompt(facts) {
  return [
    "Product facts (authoritative — do not invent beyond this):",
    JSON.stringify(facts, null, 2),
    "",
    'Locales to fill: ["en","pt","ru"]',
    "Omit en.title always. Prefer leaving a field empty over inventing.",
  ].join("\n");
}
