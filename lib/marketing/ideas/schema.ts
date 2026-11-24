export const MARKETING_IDEAS_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ideas"],
  properties: {
    ideas: {
      type: "array",
      minItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "productIds",
          "signalIds",
          "whyRu",
          "hook",
          "script",
          "shotList",
          "caption",
          "weekSlot",
        ],
        properties: {
          productIds: { type: "array", items: { type: "string" } },
          signalIds: { type: "array", items: { type: "string" } },
          whyRu: { type: "string" },
          hook: {
            type: "object",
            additionalProperties: false,
            required: ["en", "pt"],
            properties: {
              en: { type: "string" },
              pt: { type: "string" },
            },
          },
          script: { type: "string" },
          shotList: { type: "array", items: { type: "string" } },
          caption: {
            type: "object",
            additionalProperties: false,
            required: ["en", "pt"],
            properties: {
              en: { type: "string" },
              pt: { type: "string" },
            },
          },
          weekSlot: { type: "integer", minimum: 1, maximum: 4 },
        },
      },
    },
  },
} as const;

export type RawMarketingIdea = {
  productIds: string[];
  signalIds: string[];
  whyRu: string;
  hook: { en: string; pt: string };
  script: string;
  shotList: string[];
  caption: { en: string; pt: string };
  weekSlot: number;
};
